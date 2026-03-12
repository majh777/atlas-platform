import type {
  CompletenessCheck,
  DocumentCategory,
  DocumentChunk,
  DocumentRecord,
  EntityType,
  EvidenceCard,
  ExtractedEntity,
  IngestRequestDocument,
  IntelligenceDataset,
  KnowledgeGraph,
  RedFlag,
  SourceCitation,
} from "@/types/document-intelligence";

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "into",
  "under",
  "were",
  "have",
  "has",
  "shall",
  "project",
  "document",
]);

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

function makeId(prefix: string, seed: string) {
  return `${prefix}_${slugify(seed)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function classifyDocument(text: string): DocumentCategory {
  const normalized = text.toLowerCase();
  if (/(permit|license|licence|authorization|authorisation)/.test(normalized)) return "permit";
  if (/(ore reserve|geological|feasibility|resource estimate|drill)/.test(normalized)) return "technical_report";
  if (/(offtake|counterparty|term sheet|pricing|buyer)/.test(normalized)) return "commercial";
  if (/(environmental|esia|biodiversity|water management)/.test(normalized)) return "environmental";
  if (/(incorporation|board|shareholder|company|subsidiary)/.test(normalized)) return "corporate";
  if (/(revenue|ebitda|balance sheet|cash flow|payment)/.test(normalized)) return "financial";
  return "unknown";
}

function buildCitation(documentId: string, documentName: string, version: number, chunkId: string, excerpt: string, lineRange: [number, number]): SourceCitation {
  return { documentId, documentName, version, chunkId, excerpt, lineRange };
}

export function extractMetadata(text: string, source: IngestRequestDocument) {
  const firstDate = text.match(/\b(20\d{2}-\d{2}-\d{2}|\d{1,2}\s+[A-Z][a-z]+\s+20\d{2})\b/)?.[1] ?? "Unknown";
  const projectCode = text.match(/\b(?:Project|Asset|Permit)\s+([A-Z0-9-]{3,})\b/)?.[1] ?? "ATLAS-UNSPECIFIED";
  const pageCount = String(Math.max(1, Math.ceil(text.split(/\s+/).length / 320)));

  return {
    ingestionSource: source.source,
    connector: source.connector ?? "manual",
    detectedDate: firstDate,
    projectCode,
    estimatedPages: pageCount,
    language: /\b(le|la|de|des|et)\b/i.test(text) ? "mixed/fr" : "en",
  };
}

function pushEntity(entities: ExtractedEntity[], type: EntityType, value: string, confidence: number) {
  const normalized = value.trim();
  if (!normalized) return;
  if (entities.some((entity) => entity.type === type && entity.value === normalized)) return;
  entities.push({
    id: `${type}_${slugify(normalized)}`,
    type,
    value: normalized,
    confidence,
  });
}

export function extractEntities(text: string): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];

  const assetMatches = text.match(/\b(?:Asset|Project|Mine|Concession)\s+[A-Z][A-Za-z0-9-]+(?:\s+[A-Z][A-Za-z0-9-]+)?/g) ?? [];
  assetMatches.forEach((value) => pushEntity(entities, "asset", value, 0.9));

  const permitMatches = text.match(/\b(?:Permit|License|Licence)\s+[A-Z0-9-]{3,}\b/g) ?? [];
  permitMatches.forEach((value) => pushEntity(entities, "permit", value, 0.93));

  const locationMatches = text.match(/\b(?:Cameroon|Douala|Kribi|Yaoundé|Yaounde|Lobé|Lobe|Kolwezi|Lubumbashi|Dubai|Paris)\b/g) ?? [];
  locationMatches.forEach((value) => pushEntity(entities, "location", value, 0.8));

  const counterpartyMatches = text.match(/\b(?:Ltd|LLC|SA|SAS|Corp|Corporation|Ministry|Authority|Bank)\b(?:\s+[A-Z][A-Za-z&.-]+){0,3}/g) ?? [];
  counterpartyMatches.forEach((value) => pushEntity(entities, "counterparty", value, 0.74));

  const dateMatches = text.match(/\b(20\d{2}-\d{2}-\d{2}|\d{1,2}\s+[A-Z][a-z]+\s+20\d{2})\b/g) ?? [];
  dateMatches.forEach((value) => pushEntity(entities, "date", value, 0.88));

  return entities;
}

function keywordize(text: string) {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length > 3 && !STOPWORDS.has(token)),
    ),
  ).slice(0, 12);
}

export function chunkDocument(documentId: string, documentName: string, version: number, text: string, entities: ExtractedEntity[]): DocumentChunk[] {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const chunks: DocumentChunk[] = [];
  for (let index = 0; index < lines.length; index += 3) {
    const selected = lines.slice(index, index + 3);
    const chunkText = selected.join(" ");
    const chunkId = `${documentId}_chunk_${String(chunks.length + 1).padStart(2, "0")}`;
    const matchingEntities = entities
      .filter((entity) => chunkText.toLowerCase().includes(entity.value.toLowerCase()))
      .map((entity) => entity.id);

    chunks.push({
      id: chunkId,
      documentId,
      order: chunks.length,
      text: chunkText,
      citations: [buildCitation(documentId, documentName, version, chunkId, chunkText.slice(0, 240), [index + 1, Math.min(lines.length, index + selected.length)])],
      entityIds: matchingEntities,
      keywords: keywordize(chunkText),
    });
  }

  if (chunks.length === 0) {
    const chunkId = `${documentId}_chunk_01`;
    chunks.push({
      id: chunkId,
      documentId,
      order: 0,
      text,
      citations: [buildCitation(documentId, documentName, version, chunkId, text.slice(0, 240), [1, 1])],
      entityIds: entities.map((entity) => entity.id),
      keywords: keywordize(text),
    });
  }

  return chunks;
}

export function detectRedFlags(documentName: string, chunks: DocumentChunk[]): RedFlag[] {
  const flags: RedFlag[] = [];

  for (const chunk of chunks) {
    const normalized = chunk.text.toLowerCase();
    const checks = [
      {
        regex: /(expired|lapsed|revoked)/,
        severity: "high" as const,
        title: "Regulatory validity risk",
        description: `${documentName} contains language suggesting a permit or authorization may no longer be valid.`,
      },
      {
        regex: /(pending approval|awaiting signature|draft only)/,
        severity: "medium" as const,
        title: "Execution not finalized",
        description: `${documentName} references a document that may not yet be fully executed or approved.`,
      },
      {
        regex: /(litigation|dispute|penalty|fine|breach)/,
        severity: "high" as const,
        title: "Legal or compliance exposure",
        description: `${documentName} references a dispute, penalty, or breach that may affect diligence outcomes.`,
      },
      {
        regex: /(missing annex|to be provided|tbd|unknown)/,
        severity: "medium" as const,
        title: "Data completeness gap",
        description: `${documentName} includes placeholders or references to missing supporting information.`,
      },
    ];

    for (const check of checks) {
      if (check.regex.test(normalized)) {
        flags.push({
          id: makeId("flag", `${documentName}-${check.title}-${chunk.id}`),
          severity: check.severity,
          title: check.title,
          description: check.description,
          citation: chunk.citations[0],
        });
      }
    }
  }

  return flags;
}

export function buildCompletenessChecks(category: DocumentCategory, entities: ExtractedEntity[], redFlags: RedFlag[], metadata: Record<string, string>): CompletenessCheck[] {
  const entityTypes = new Set(entities.map((entity) => entity.type));
  const checks: CompletenessCheck[] = [
    {
      id: "metadata-date",
      label: "Effective date detected",
      status: metadata.detectedDate === "Unknown" ? "warning" : "complete",
      detail: metadata.detectedDate === "Unknown" ? "No explicit date detected in OCR text." : `Detected ${metadata.detectedDate}.`,
    },
    {
      id: "asset-entity",
      label: "Asset linkage",
      status: entityTypes.has("asset") ? "complete" : "missing",
      detail: entityTypes.has("asset") ? "At least one asset/project entity extracted." : "No asset/project entity detected.",
    },
    {
      id: "counterparty-entity",
      label: "Counterparty extraction",
      status: entityTypes.has("counterparty") ? "complete" : "warning",
      detail: entityTypes.has("counterparty") ? "Counterparty entities available for graphing." : "No clear counterparty detected.",
    },
    {
      id: "flag-review",
      label: "Red-flag review",
      status: redFlags.length === 0 ? "complete" : "warning",
      detail: redFlags.length === 0 ? "No red flags detected in automated pass." : `${redFlags.length} potential red flag(s) need human review.`,
    },
  ];

  if (category === "permit") {
    checks.push({
      id: "permit-number",
      label: "Permit identifier",
      status: entityTypes.has("permit") ? "complete" : "missing",
      detail: entityTypes.has("permit") ? "Permit/license identifier extracted." : "No permit identifier found.",
    });
  }

  return checks;
}

export function summarizeDocument(name: string, category: DocumentCategory, entities: ExtractedEntity[], redFlags: RedFlag[], text: string) {
  const entityLead = entities.slice(0, 4).map((entity) => entity.value).join(", ") || "no major entities";
  const concern = redFlags[0]?.title ? ` Primary concern: ${redFlags[0].title}.` : " No blocking issues were auto-detected.";
  return `${name} is classified as ${category.replace(/_/g, " ")} and references ${entityLead}. It was ingested into the dossier pipeline for OCR, metadata extraction, chunking, and evidence generation.${concern} Human review is required before downstream investment use. ${text.split(/\s+/).slice(0, 18).join(" ")}...`;
}

export function createDocumentRecord(input: IngestRequestDocument): DocumentRecord {
  const category = classifyDocument(input.text);
  const entities = extractEntities(input.text);
  const createdAt = new Date().toISOString();
  const id = makeId("doc", input.name);
  const version = 1;
  const metadata = extractMetadata(input.text, input);
  const chunks = chunkDocument(id, input.name, version, input.text, entities);
  const redFlags = detectRedFlags(input.name, chunks);
  const completenessChecks = buildCompletenessChecks(category, entities, redFlags, metadata);
  const summary = summarizeDocument(input.name, category, entities, redFlags, input.text);

  return {
    id,
    name: input.name,
    source: input.source,
    connector: input.connector,
    category,
    ocrText: input.text,
    summary,
    summaryNeedsReview: true,
    metadata,
    entities,
    chunks,
    redFlags,
    completenessChecks,
    version,
    previousVersionId: input.versionOfId,
    storageClass: input.storageClass ?? (redFlags.length > 0 ? "hot" : "warm"),
    retentionUntil: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString(),
    review: {
      status: "pending",
      reviewer: "Atlas AI",
    },
    createdAt,
    updatedAt: createdAt,
  };
}

export function generateEvidenceCards(document: DocumentRecord): EvidenceCard[] {
  const cards: EvidenceCard[] = [];
  const topEntities = document.entities.slice(0, 3);
  const topChunks = document.chunks.slice(0, 2);

  if (topChunks.length > 0) {
    cards.push({
      id: makeId("evidence", `${document.name}-overview`),
      title: `${document.name} — dossier synopsis`,
      statement: document.summary,
      tags: [document.category, document.source, "summary"],
      riskLevel: document.redFlags.some((flag) => flag.severity === "high") ? "high" : document.redFlags.length ? "medium" : "low",
      documentIds: [document.id],
      entities: topEntities,
      citations: topChunks.flatMap((chunk) => chunk.citations),
      createdAt: document.createdAt,
    });
  }

  document.redFlags.forEach((flag) => {
    cards.push({
      id: makeId("evidence", `${document.name}-${flag.title}`),
      title: `${flag.title} — ${document.name}`,
      statement: flag.description,
      tags: ["red-flag", document.category, flag.severity],
      riskLevel: flag.severity,
      documentIds: [document.id],
      entities: topEntities,
      citations: [flag.citation],
      createdAt: document.createdAt,
    });
  });

  return cards;
}

export function updateKnowledgeGraph(existing: KnowledgeGraph, documents: DocumentRecord[]): KnowledgeGraph {
  const nodeMap = new Map(existing.nodes.map((node) => [node.id, node]));
  const edges = [...existing.edges];

  for (const document of documents) {
    document.entities.forEach((entity) => nodeMap.set(entity.id, entity));

    const asset = document.entities.find((entity) => entity.type === "asset");
    for (const entity of document.entities) {
      if (asset && entity.id !== asset.id) {
        edges.push({ from: asset.id, to: entity.id, relation: `documented_in:${document.id}` });
      }
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    edges: Array.from(new Map(edges.map((edge) => [`${edge.from}-${edge.to}-${edge.relation}`, edge])).values()),
  };
}

export function mergeIntoDataset(dataset: IntelligenceDataset, newDocuments: DocumentRecord[]): IntelligenceDataset {
  const evidenceCards = [...dataset.evidenceCards, ...newDocuments.flatMap(generateEvidenceCards)];
  return {
    documents: [...newDocuments, ...dataset.documents],
    evidenceCards,
    knowledgeGraph: updateKnowledgeGraph(dataset.knowledgeGraph, newDocuments),
  };
}

export function retrieveEvidence(dataset: IntelligenceDataset, query?: string) {
  const normalized = query?.trim().toLowerCase();
  const cards = normalized
    ? dataset.evidenceCards.filter((card) => {
        const haystack = [card.title, card.statement, card.tags.join(" "), card.entities.map((entity) => entity.value).join(" ")]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalized);
      })
    : dataset.evidenceCards;

  return cards.slice().sort((left, right) => {
    const riskWeight = { high: 3, medium: 2, low: 1 };
    return riskWeight[right.riskLevel] - riskWeight[left.riskLevel];
  });
}
