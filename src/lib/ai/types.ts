export type AiCapability = 'search' | 'narrative' | 'diligence' | 'assistants';
export type ReviewerMode = 'draft' | 'review_required' | 'evidence_only';
export type NarrativeTemplateType = 'ic_memo' | 'board_pack' | 'update_note';

export interface AiCitation {
  id: string;
  sourceType: 'document_chunk' | 'evidence_card' | 'data_room_document' | 'diligence_question' | 'task' | 'permit' | 'incident';
  sourceId: string;
  title: string;
  excerpt: string;
  url?: string;
  lineRange?: [number, number];
  metadata?: Record<string, string | number | boolean | null>;
}

export interface SearchResult {
  id: string;
  sourceType: AiCitation['sourceType'];
  title: string;
  excerpt: string;
  score: number;
  citations: AiCitation[];
  metadata: Record<string, string | number | boolean | null>;
}

export interface SearchResponse {
  query: string;
  answer: string;
  results: SearchResult[];
  citations: AiCitation[];
  guardrails: GuardrailOutcome;
}

export interface NarrativeSection {
  heading: string;
  body: string;
  citations: AiCitation[];
}

export interface NarrativeResponse {
  templateId: string;
  templateVersion: number;
  title: string;
  reviewerMode: ReviewerMode;
  sections: NarrativeSection[];
  citations: AiCitation[];
  guardrails: GuardrailOutcome;
}

export interface DiligenceIssue {
  id: string;
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  citations: AiCitation[];
}

export interface DiligencePrompt {
  id: string;
  question: string;
  reason: string;
  priority: 'low' | 'medium' | 'high';
  citations: AiCitation[];
}

export interface DiligenceResponse {
  summary: string;
  issues: DiligenceIssue[];
  missingDataPrompts: DiligencePrompt[];
  guardrails: GuardrailOutcome;
}

export interface AssistantRecommendation {
  id: string;
  type: 'action' | 'next_best_step' | 'reminder';
  title: string;
  rationale: string;
  dueAt?: string;
  citations: AiCitation[];
}

export interface AssistantResponse {
  recommendations: AssistantRecommendation[];
  analytics: UsageAnalytics;
  recentGuardrails: GuardrailEvent[];
  evaluations?: EvaluationSummary;
  guardrails: GuardrailOutcome;
}

export interface PromptTemplate {
  id: string;
  capability: AiCapability;
  name: string;
  version: number;
  system: string;
  instructions: string[];
  reviewerModes: ReviewerMode[];
  tags: string[];
}

export interface GuardrailOutcome {
  reviewerMode: ReviewerMode;
  violations: string[];
  redactions: string[];
  approved: boolean;
}

export interface UsageEvent {
  id: string;
  capability: AiCapability;
  templateId: string;
  templateVersion: number;
  reviewerMode: ReviewerMode;
  model: string;
  durationMs: number;
  evidenceCount: number;
  createdAt: string;
}

export interface GuardrailEvent {
  id: string;
  capability: AiCapability;
  templateId: string;
  reviewerMode: ReviewerMode;
  violations: string[];
  redactions: string[];
  approved: boolean;
  createdAt: string;
}

export interface UsageAnalytics {
  totalCalls: number;
  byCapability: Record<string, number>;
  byReviewerMode: Record<string, number>;
  totalGuardrailViolations: number;
  lastRunAt?: string;
}

export interface EvaluationCase {
  id: string;
  capability: AiCapability;
  prompt: string;
  expectedSignals: string[];
}

export interface EvaluationResult {
  id: string;
  capability: AiCapability;
  passed: boolean;
  observedSignals: string[];
  missingSignals: string[];
}

export interface EvaluationSummary {
  results: EvaluationResult[];
  passed: number;
  failed: number;
}

export interface AiModuleStore {
  usageEvents: UsageEvent[];
  guardrailEvents: GuardrailEvent[];
  evaluationRuns: Array<{
    id: string;
    createdAt: string;
    summary: EvaluationSummary;
  }>;
}
