export type IngestionSource = "bulk_upload" | "email" | "connector";

export type DocumentCategory =
  | "permit"
  | "technical_report"
  | "commercial"
  | "environmental"
  | "corporate"
  | "financial"
  | "unknown";

export type EntityType = "asset" | "permit" | "location" | "counterparty" | "date";

export type ReviewStatus = "pending" | "approved" | "changes_requested";
export type StorageClass = "hot" | "warm" | "archive";

export interface SourceCitation {
  documentId: string;
  documentName: string;
  version: number;
  chunkId: string;
  excerpt: string;
  lineRange: [number, number];
}

export interface ExtractedEntity {
  id: string;
  type: EntityType;
  value: string;
  confidence: number;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  order: number;
  text: string;
  citations: SourceCitation[];
  entityIds: string[];
  keywords: string[];
}

export interface RedFlag {
  id: string;
  severity: "low" | "medium" | "high";
  title: string;
  description: string;
  citation: SourceCitation;
}

export interface CompletenessCheck {
  id: string;
  label: string;
  status: "complete" | "missing" | "warning";
  detail: string;
}

export interface ReviewRecord {
  status: ReviewStatus;
  reviewer: string;
  notes?: string;
  reviewedAt?: string;
}

export interface DocumentRecord {
  id: string;
  name: string;
  source: IngestionSource;
  connector?: string;
  category: DocumentCategory;
  ocrText: string;
  summary: string;
  summaryNeedsReview: boolean;
  metadata: Record<string, string>;
  entities: ExtractedEntity[];
  chunks: DocumentChunk[];
  redFlags: RedFlag[];
  completenessChecks: CompletenessCheck[];
  version: number;
  previousVersionId?: string;
  storageClass: StorageClass;
  retentionUntil: string;
  review: ReviewRecord;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceCard {
  id: string;
  title: string;
  statement: string;
  tags: string[];
  riskLevel: "low" | "medium" | "high";
  documentIds: string[];
  entities: ExtractedEntity[];
  citations: SourceCitation[];
  createdAt: string;
}

export interface KnowledgeGraphEdge {
  from: string;
  to: string;
  relation: string;
}

export interface KnowledgeGraph {
  nodes: ExtractedEntity[];
  edges: KnowledgeGraphEdge[];
}

export interface IntelligenceDataset {
  documents: DocumentRecord[];
  evidenceCards: EvidenceCard[];
  knowledgeGraph: KnowledgeGraph;
}

export interface IngestRequestDocument {
  name: string;
  source: IngestionSource;
  text: string;
  connector?: string;
  versionOfId?: string;
  storageClass?: StorageClass;
}
