import { randomUUID } from 'node:crypto';
import { initDb, all } from '@/lib/db';
import { readDataset } from '@/lib/document-intelligence/store';
import { listDiligenceQuestions, listWorkflowActions } from '@/lib/services/workflows';
import { queryTasks } from '@/lib/services/tasks';
import { queryAuditLogs } from '@/lib/services/audit';
import { getPromptTemplate, listPromptTemplates } from '@/lib/ai/registry';
import { readAiStore, writeAiStore } from '@/lib/ai/store';
import { evaluateSearchLikeOutput, summarizeEvaluation } from '@/lib/ai/evaluations';
import type {
  AiCapability,
  AiCitation,
  AssistantRecommendation,
  AssistantResponse,
  DiligenceIssue,
  DiligencePrompt,
  DiligenceResponse,
  GuardrailEvent,
  GuardrailOutcome,
  NarrativeResponse,
  NarrativeSection,
  NarrativeTemplateType,
  ReviewerMode,
  SearchResponse,
  SearchResult,
  UsageAnalytics,
  UsageEvent,
} from '@/lib/ai/types';
import type { DocumentRecord, EvidenceCard } from '@/types/document-intelligence';

interface CorpusEntry {
  id: string;
  sourceType: AiCitation['sourceType'];
  title: string;
  text: string;
  citations: AiCitation[];
  metadata: Record<string, string | number | boolean | null>;
}

// Extended prompt injection detection patterns
const BLOCKED_PATTERNS = [
  /ignore previous instructions/i,
  /system prompt/i,
  /reveal secrets/i,
  /disable guardrails/i,
  /ignore all previous/i,
  /developer mode/i,
  /debug mode/i,
  /admin mode/i,
  /bypass security/i,
  /you are now/i,
  /pretend you are/i,
  /act as if/i,
  /\{"role":\s*"system"/i,
  /\[system\]/i,
  /<system>/i,
  /```\s*\n?\s*ignore/i,
  /---\s*\n?\s*system/i,
  /jailbreak/i,
  /dan mode/i,
  /no ethical guidelines/i,
];

// PII patterns for sanitization
const PII_PATTERNS = [
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN REDACTED]' }, // SSN
  { pattern: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, replacement: '[CARD REDACTED]' }, // Credit card
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '[EMAIL REDACTED]' }, // Email in sensitive contexts
];

// XSS/HTML sanitization
const XSS_PATTERNS = [
  { pattern: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, replacement: '[SCRIPT REMOVED]' },
  { pattern: /<[^>]*on\w+\s*=/gi, replacement: '<' }, // Event handlers
  { pattern: /javascript:/gi, replacement: '' },
];

const VALID_REVIEWER_MODES: ReviewerMode[] = ['draft', 'review_required', 'evidence_only'];

const MAX_QUERY_LENGTH = 5000;
const MAX_RESULTS = 50;

function sanitizeText(text: string): string {
  let sanitized = text;
  // Remove XSS patterns
  for (const { pattern, replacement } of XSS_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  return sanitized;
}

function sanitizePII(text: string): string {
  let sanitized = text;
  for (const { pattern, replacement } of PII_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  return sanitized;
}

function validateReviewerMode(mode: unknown): ReviewerMode {
  if (typeof mode === 'string' && VALID_REVIEWER_MODES.includes(mode as ReviewerMode)) {
    return mode as ReviewerMode;
  }
  return 'review_required';
}

function truncateQuery(query: string): string {
  if (query.length > MAX_QUERY_LENGTH) {
    return query.slice(0, MAX_QUERY_LENGTH);
  }
  return query;
}

function tokenize(value: string): string[] {
  return Array.from(new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2)));
}

function overlapScore(query: string, text: string): number {
  const q = tokenize(query);
  if (q.length === 0) return 0;
  const hay = tokenize(text);
  const set = new Set(hay);
  const matches = q.filter((token) => set.has(token)).length;
  const phraseBoost = text.toLowerCase().includes(query.toLowerCase()) ? 1.5 : 0;
  return matches / q.length + phraseBoost;
}

function summarizeExcerpt(text: string, query: string) {
  // First sanitize the text to remove any dangerous content
  let normalized = sanitizeText(text);
  normalized = sanitizePII(normalized);
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  // Remove potential prompt injection patterns from document content
  for (const pattern of BLOCKED_PATTERNS) {
    normalized = normalized.replace(pattern, '[FILTERED]');
  }
  
  if (normalized.length <= 220) return normalized;
  const idx = normalized.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return `${normalized.slice(0, 217)}...`;
  const start = Math.max(0, idx - 70);
  const end = Math.min(normalized.length, idx + 150);
  return `${start > 0 ? '...' : ''}${normalized.slice(start, end)}${end < normalized.length ? '...' : ''}`;
}

function normalizeGuardrails(input: string, reviewerMode: ReviewerMode): GuardrailOutcome {
  // Normalize input: remove zero-width characters, normalize whitespace
  const normalizedInput = input
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width chars
    .replace(/\s+/g, ' '); // Normalize whitespace

  const violations = BLOCKED_PATTERNS.filter((pattern) => pattern.test(normalizedInput)).map((pattern) => pattern.source);
  const redactions: string[] = [];
  
  // Check for sensitive terms
  if (/password|secret|private.?key|api.?key|credential/i.test(normalizedInput)) {
    redactions.push('sensitive_term');
  }
  
  // Check for PII
  if (/\b\d{3}-\d{2}-\d{4}\b/.test(normalizedInput)) {
    redactions.push('ssn');
  }
  if (/\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/.test(normalizedInput)) {
    redactions.push('credit_card');
  }
  
  return {
    reviewerMode: validateReviewerMode(reviewerMode),
    violations,
    redactions,
    approved: violations.length === 0,
  };
}

function mapDocumentChunk(document: DocumentRecord): CorpusEntry[] {
  return document.chunks.map((chunk) => ({
    id: chunk.id,
    sourceType: 'document_chunk',
    title: document.name,
    text: chunk.text,
    citations: chunk.citations.map((citation) => ({
      id: citation.chunkId,
      sourceType: 'document_chunk',
      sourceId: citation.documentId,
      title: `${citation.documentName} · lines ${citation.lineRange[0]}-${citation.lineRange[1]}`,
      excerpt: citation.excerpt,
      lineRange: citation.lineRange,
      metadata: {
        documentId: citation.documentId,
        documentName: citation.documentName,
        version: citation.version,
      },
    })),
    metadata: {
      category: document.category,
      reviewStatus: document.review.status,
      redFlagCount: document.redFlags.length,
    },
  }));
}

function mapEvidenceCard(card: EvidenceCard): CorpusEntry {
  return {
    id: card.id,
    sourceType: 'evidence_card',
    title: card.title,
    text: `${card.statement} ${card.tags.join(' ')}`,
    citations: card.citations.map((citation) => ({
      id: `${card.id}:${citation.chunkId}`,
      sourceType: 'evidence_card',
      sourceId: card.id,
      title: card.title,
      excerpt: citation.excerpt,
      lineRange: citation.lineRange,
      metadata: { riskLevel: card.riskLevel },
    })),
    metadata: {
      riskLevel: card.riskLevel,
      documentCount: card.documentIds.length,
    },
  };
}

function safeDbRows<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[] {
  try {
    initDb();
    return all<T>(sql, ...params);
  } catch {
    return [];
  }
}

async function buildCorpus(orgId?: string) {
  const dataset = await readDataset();
  const corpus: CorpusEntry[] = dataset.documents.flatMap(mapDocumentChunk);
  corpus.push(...dataset.evidenceCards.map(mapEvidenceCard));

  const dataRoomDocs = safeDbRows<{
    id: string;
    title: string;
    category: string;
    collection_name: string;
    source_url: string | null;
    evidence_links: string | null;
  }>(
    orgId
      ? `SELECT d.id, d.title, d.category, d.collection_name, d.source_url, d.evidence_links
         FROM data_room_documents d
         JOIN data_rooms r ON r.id = d.data_room_id
         WHERE r.org_id = ?`
      : 'SELECT id, title, category, collection_name, source_url, evidence_links FROM data_room_documents',
    ...(orgId ? [orgId] : []),
  );

  corpus.push(
    ...dataRoomDocs.map((row): CorpusEntry => ({
      id: row.id,
      sourceType: 'data_room_document',
      title: row.title,
      text: `${row.title} ${row.category} ${row.collection_name} ${(row.evidence_links ?? '').toString()}`,
      citations: [
        {
          id: row.id,
          sourceType: 'data_room_document',
          sourceId: row.id,
          title: `${row.collection_name} · ${row.title}`,
          excerpt: `${row.category} document in collection ${row.collection_name}`,
          url: row.source_url ?? undefined,
        },
      ],
      metadata: {
        category: row.category,
        collection: row.collection_name,
      },
    })),
  );

  if (orgId) {
    corpus.push(
      ...listDiligenceQuestions({ orgId }).map((question): CorpusEntry => ({
        id: question.id,
        sourceType: 'diligence_question',
        title: question.question,
        text: `${question.question} ${question.answer_text ?? ''}`,
        citations: [
          {
            id: question.id,
            sourceType: 'diligence_question',
            sourceId: question.id,
            title: `Diligence question · ${question.priority}`,
            excerpt: question.answer_text ?? question.question,
            metadata: { status: question.status, priority: question.priority },
          },
        ],
        metadata: { status: question.status, priority: question.priority },
      })),
    );
  }

  return { dataset, corpus };
}

function buildAnswer(query: string, results: SearchResult[], reviewerMode: ReviewerMode) {
  if (results.length === 0) {
    return reviewerMode === 'evidence_only'
      ? 'No supporting evidence was retrieved for this query.'
      : 'No strong Atlas evidence matched the query. Additional documents or workflow data are required before answering confidently.';
  }

  const lines = results.slice(0, 3).map((result, index) => {
    return `[${index + 1}] ${result.title}: ${result.excerpt}`;
  });

  return [
    `Evidence-grounded answer for “${query}”:`,
    ...lines,
    reviewerMode === 'review_required'
      ? 'This draft should be reviewed before external circulation.'
      : 'The response is limited to retrieved Atlas evidence.',
  ].join(' ');
}

async function recordUsage(params: {
  capability: AiCapability;
  templateId: string;
  templateVersion: number;
  reviewerMode: ReviewerMode;
  evidenceCount: number;
  durationMs: number;
  model?: string;
  guardrails: GuardrailOutcome;
}) {
  const store = await readAiStore();
  const createdAt = new Date().toISOString();
  const usage: UsageEvent = {
    id: randomUUID(),
    capability: params.capability,
    templateId: params.templateId,
    templateVersion: params.templateVersion,
    reviewerMode: params.reviewerMode,
    model: params.model ?? 'atlas-deterministic-gateway-v1',
    durationMs: params.durationMs,
    evidenceCount: params.evidenceCount,
    createdAt,
  };
  const guardrailEvent: GuardrailEvent = {
    id: randomUUID(),
    capability: params.capability,
    templateId: params.templateId,
    reviewerMode: params.reviewerMode,
    violations: params.guardrails.violations,
    redactions: params.guardrails.redactions,
    approved: params.guardrails.approved,
    createdAt,
  };
  store.usageEvents.unshift(usage);
  store.guardrailEvents.unshift(guardrailEvent);
  await writeAiStore(store);
}

/**
 * Performs evidence-grounded semantic search across the Atlas knowledge base.
 * 
 * Searches documents, evidence cards, data room items, and diligence questions.
 * Results include citations with line-level references to source documents.
 * Implements guardrails for prompt injection and PII redaction.
 * 
 * @param input.query - The search query string
 * @param input.orgId - Optional organization ID to scope the search
 * @param input.limit - Maximum number of results (default: 5, max: 50)
 * @param input.reviewerMode - Review mode: 'draft', 'review_required', or 'evidence_only'
 * @returns Search response with answer, results, citations, and guardrail status
 * 
 * @example
 * ```typescript
 * const response = await semanticSearch({
 *   query: 'permit risk exposure',
 *   orgId: 'org-123',
 *   limit: 5,
 *   reviewerMode: 'review_required'
 * });
 * console.log(response.answer);
 * console.log(`Found ${response.results.length} relevant results`);
 * ```
 */
export async function semanticSearch(input: { query: string; orgId?: string; limit?: number; reviewerMode?: ReviewerMode }): Promise<SearchResponse> {
  const startedAt = Date.now();
  
  // Validate and sanitize inputs
  const query = truncateQuery(String(input.query || ''));
  const reviewerMode = validateReviewerMode(input.reviewerMode);
  const guardrails = normalizeGuardrails(query, reviewerMode);
  
  // Enforce max results limit
  const requestedLimit = Math.min(
    Math.max(0, Number(input.limit) || 5),
    MAX_RESULTS
  );
  
  const template = getPromptTemplate('search');
  const { corpus } = await buildCorpus(input.orgId);
  
  const results = corpus
    .map((entry) => ({
      id: entry.id,
      sourceType: entry.sourceType,
      title: sanitizeText(entry.title),
      excerpt: summarizeExcerpt(entry.text, query),
      score: overlapScore(query, `${entry.title} ${entry.text}`),
      citations: entry.citations.map(c => ({
        ...c,
        title: sanitizeText(c.title),
        excerpt: sanitizePII(sanitizeText(c.excerpt)),
      })),
      metadata: entry.metadata,
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, requestedLimit);

  const citations = results.flatMap((result) => result.citations).slice(0, 8);
  
  // Sanitize the answer - remove any injected content from document text
  const answer = sanitizeText(sanitizePII(buildAnswer(query, results, reviewerMode)));

  await recordUsage({
    capability: 'search',
    templateId: template.id,
    templateVersion: template.version,
    reviewerMode,
    evidenceCount: citations.length,
    durationMs: Date.now() - startedAt,
    guardrails,
  });

  return { query, answer, results, citations, guardrails };
}

function uniqueCitations(citations: AiCitation[]) {
  const seen = new Set<string>();
  return citations.filter((citation) => {
    const key = `${citation.sourceType}:${citation.sourceId}:${citation.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function generateNarrative(input: {
  query: string;
  orgId?: string;
  templateType?: NarrativeTemplateType;
  title?: string;
  reviewerMode?: ReviewerMode;
}): Promise<NarrativeResponse> {
  const startedAt = Date.now();
  
  // Validate template type - fallback to ic_memo if invalid
  const validTemplateTypes: NarrativeTemplateType[] = ['ic_memo', 'board_pack', 'update_note'];
  const templateType = validTemplateTypes.includes(input.templateType as NarrativeTemplateType) 
    ? input.templateType! 
    : 'ic_memo';
  const reviewerMode = validateReviewerMode(input.reviewerMode);
  const template = getPromptTemplate('narrative', templateType);
  const search = await semanticSearch({ query: input.query, orgId: input.orgId, limit: 6, reviewerMode });

  const sections: NarrativeSection[] = [
    {
      heading: templateType === 'board_pack' ? 'Board Context' : templateType === 'update_note' ? 'Update Summary' : 'Investment Thesis',
      body: search.results.slice(0, 2).map((result, index) => `[${index + 1}] ${result.excerpt}`).join(' '),
      citations: search.results.slice(0, 2).flatMap((result) => result.citations),
    },
    {
      heading: templateType === 'update_note' ? 'What Changed' : 'Key Risks',
      body: search.results.slice(0, 3).map((result) => `${result.title} (${String(result.metadata.redFlagCount ?? result.metadata.riskLevel ?? 'watch')})`).join('; '),
      citations: search.results.slice(0, 3).flatMap((result) => result.citations),
    },
    {
      heading: templateType === 'board_pack' ? 'Board Ask' : 'Recommended Next Steps',
      body:
        reviewerMode === 'evidence_only'
          ? 'Escalate only after additional evidence is uploaded and reviewer sign-off is complete.'
          : 'Confirm unresolved diligence items, assign owners, and refresh the memo once missing evidence is available.',
      citations: search.results.slice(0, 2).flatMap((result) => result.citations),
    },
  ];

  const citations = uniqueCitations(sections.flatMap((section) => section.citations));
  await recordUsage({
    capability: 'narrative',
    templateId: template.id,
    templateVersion: template.version,
    reviewerMode,
    evidenceCount: citations.length,
    durationMs: Date.now() - startedAt,
    guardrails: search.guardrails,
  });

  return {
    templateId: template.id,
    templateVersion: template.version,
    title: input.title ?? `${template.name} · ${input.query}`,
    reviewerMode,
    sections,
    citations,
    guardrails: search.guardrails,
  };
}

export async function runDiligenceCopilot(input: { query: string; orgId?: string; reviewerMode?: ReviewerMode }): Promise<DiligenceResponse> {
  const startedAt = Date.now();
  const reviewerMode = validateReviewerMode(input.reviewerMode);
  const query = truncateQuery(String(input.query || ''));
  const template = getPromptTemplate('diligence');
  const search = await semanticSearch({ query, orgId: input.orgId, limit: 8, reviewerMode });
  const { dataset } = await buildCorpus(input.orgId);

  const issues: DiligenceIssue[] = dataset.documents
    .flatMap((document) =>
      document.redFlags.map((flag): DiligenceIssue => ({
        id: flag.id,
        severity: flag.severity,
        title: sanitizeText(flag.title),
        description: sanitizeText(flag.description),
        citations: [
          {
            id: flag.citation.chunkId,
            sourceType: 'document_chunk',
            sourceId: flag.citation.documentId,
            title: sanitizeText(flag.citation.documentName),
            excerpt: sanitizePII(sanitizeText(flag.citation.excerpt)),
            lineRange: flag.citation.lineRange,
          },
        ],
      })),
    )
    .filter((issue) => overlapScore(query, `${issue.title} ${issue.description}`) > 0)
    .slice(0, 6);

  const missingDataPrompts: DiligencePrompt[] = dataset.documents
    .flatMap((document) =>
      document.completenessChecks
        .filter((check) => check.status !== 'complete')
        .map((check): DiligencePrompt => ({
          id: `${document.id}:${check.id}`,
          question: `Please provide or confirm ${check.label.toLowerCase()} for ${sanitizeText(document.name)}.`,
          reason: sanitizeText(check.detail),
          priority: check.status === 'missing' ? 'high' : 'medium',
          citations: document.chunks[0]?.citations
            ? [
                {
                  id: document.chunks[0].id,
                  sourceType: 'document_chunk',
                  sourceId: document.id,
                  title: sanitizeText(document.name),
                  excerpt: sanitizePII(sanitizeText(document.chunks[0].text)),
                  lineRange: document.chunks[0].citations[0]?.lineRange,
                },
              ]
            : [],
        })),
    )
    .filter((prompt) => overlapScore(query, `${prompt.question} ${prompt.reason}`) > 0 || issues.length > 0)
    .slice(0, 6);

  const summary = issues.length
    ? `Diligence co-pilot flagged ${issues.length} issue(s) and ${missingDataPrompts.length} follow-up prompt(s). Highest-priority items relate to execution gaps, compliance exposure, or missing support.`
    : `No direct diligence red flags matched the query. ${missingDataPrompts.length} follow-up prompt(s) are suggested based on incomplete evidence.`;

  await recordUsage({
    capability: 'diligence',
    templateId: template.id,
    templateVersion: template.version,
    reviewerMode,
    evidenceCount: uniqueCitations([...issues.flatMap((issue) => issue.citations), ...missingDataPrompts.flatMap((prompt) => prompt.citations)]).length,
    durationMs: Date.now() - startedAt,
    guardrails: search.guardrails,
  });

  return { summary, issues, missingDataPrompts, guardrails: search.guardrails };
}

function computeUsageAnalytics(events: UsageEvent[], guardrailEvents: GuardrailEvent[]): UsageAnalytics {
  return {
    totalCalls: events.length,
    byCapability: events.reduce<Record<string, number>>((acc, event) => {
      acc[event.capability] = (acc[event.capability] ?? 0) + 1;
      return acc;
    }, {}),
    byReviewerMode: events.reduce<Record<string, number>>((acc, event) => {
      acc[event.reviewerMode] = (acc[event.reviewerMode] ?? 0) + 1;
      return acc;
    }, {}),
    totalGuardrailViolations: guardrailEvents.reduce((count, event) => count + event.violations.length, 0),
    lastRunAt: events[0]?.createdAt,
  };
}

export async function workflowAssistant(input: { orgId: string; reviewerMode?: ReviewerMode; includeEvaluations?: boolean }): Promise<AssistantResponse> {
  const startedAt = Date.now();
  const reviewerMode = validateReviewerMode(input.reviewerMode);
  const orgId = String(input.orgId || '');
  const template = getPromptTemplate('assistants');
  const guardrails = normalizeGuardrails(`org:${orgId}`, reviewerMode);

  const workflowActions = listWorkflowActions({ orgId: input.orgId });
  const diligenceQuestions = listDiligenceQuestions({ orgId: input.orgId, status: 'open' });
  const tasks = queryTasks({ orgId: input.orgId, limit: 20 }).data;
  const recommendations: AssistantRecommendation[] = [];

  workflowActions.filter((action) => action.status !== 'done').slice(0, 3).forEach((action) => {
    recommendations.push({
      id: `action:${action.id}`,
      type: action.status === 'blocked' ? 'next_best_step' : 'action',
      title: action.title,
      rationale: action.status === 'blocked' ? 'Unblock this workflow action first to protect downstream approvals.' : 'Open workflow action should be assigned and tracked to closure.',
      dueAt: action.due_at ?? undefined,
      citations: [{ id: action.id, sourceType: 'task', sourceId: action.id, title: action.title, excerpt: `Workflow action status: ${action.status}` }],
    });
  });

  diligenceQuestions.slice(0, 2).forEach((question) => {
    recommendations.push({
      id: `dq:${question.id}`,
      type: 'reminder',
      title: question.question,
      rationale: 'Open diligence questions should be answered before narrative outputs are finalized.',
      dueAt: question.due_at ?? undefined,
      citations: [{ id: question.id, sourceType: 'diligence_question', sourceId: question.id, title: question.question, excerpt: question.answer_text ?? 'Still unanswered' }],
    });
  });

  tasks.filter((task) => task.status !== 'completed').slice(0, 2).forEach((task) => {
    recommendations.push({
      id: `task:${task.id}`,
      type: 'next_best_step',
      title: task.title,
      rationale: `Task priority is ${task.priority}; use it to close execution gaps surfaced by the co-pilot.`,
      dueAt: task.due_date ?? undefined,
      citations: [{ id: task.id, sourceType: 'task', sourceId: task.id, title: task.title, excerpt: task.description ?? task.status }],
    });
  });

  const store = await readAiStore();
  const analytics = computeUsageAnalytics(store.usageEvents, store.guardrailEvents);
  const evaluations = input.includeEvaluations
    ? (() => {
        const searchEval = evaluateSearchLikeOutput('search', { query: 'permit risk', answer: 'Evidence [1] highlights risk from missing annex support.', results: [], citations: [], guardrails });
        const diligenceEval = evaluateSearchLikeOutput('diligence', { summary: 'Missing annex issue requires follow-up with cited evidence.' });
        return summarizeEvaluation([...searchEval, ...diligenceEval]);
      })()
    : undefined;

  const auditSignals = queryAuditLogs({ orgId: input.orgId, limit: 5 }).data;
  if (auditSignals.length > 0 && recommendations.length < 8) {
    recommendations.push({
      id: 'audit:recent',
      type: 'next_best_step',
      title: 'Review recent control-plane events',
      rationale: 'Recent audit activity can change approval posture or reviewer routing.',
      citations: auditSignals.slice(0, 2).map((entry) => ({
        id: entry.id,
        sourceType: 'task',
        sourceId: entry.id,
        title: entry.action,
        excerpt: JSON.stringify(entry.details ?? {}),
      })),
    });
  }

  await recordUsage({
    capability: 'assistants',
    templateId: template.id,
    templateVersion: template.version,
    reviewerMode,
    evidenceCount: recommendations.reduce((count, rec) => count + rec.citations.length, 0),
    durationMs: Date.now() - startedAt,
    guardrails,
  });

  return {
    recommendations: recommendations.slice(0, 8),
    analytics,
    recentGuardrails: store.guardrailEvents.slice(0, 10),
    evaluations,
    guardrails,
  };
}

export function getPromptRegistry(capability?: AiCapability) {
  return listPromptTemplates(capability);
}
