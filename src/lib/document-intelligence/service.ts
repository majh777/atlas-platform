import {
  createDocumentRecord,
  mergeIntoDataset,
  retrieveEvidence,
} from "@/lib/document-intelligence/pipeline";
import { readDataset, writeDataset } from "@/lib/document-intelligence/store";
import type {
  DocumentRecord,
  IngestRequestDocument,
  ReviewStatus,
  StorageClass,
} from "@/types/document-intelligence";

function matchesDocumentQuery(document: DocumentRecord, query?: string) {
  if (!query) return true;
  const normalized = query.toLowerCase();
  return [
    document.name,
    document.category,
    document.summary,
    document.source,
    document.entities.map((entity) => entity.value).join(" "),
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export async function listDocuments(filters?: {
  query?: string;
  source?: string;
  status?: string;
}) {
  const dataset = await readDataset();
  return dataset.documents.filter((document) => {
    return (
      matchesDocumentQuery(document, filters?.query) &&
      (!filters?.source || document.source === filters.source) &&
      (!filters?.status || document.review.status === filters.status)
    );
  });
}

export async function ingestDocuments(inputs: IngestRequestDocument[]) {
  const dataset = await readDataset();
  const newDocuments = inputs.map(createDocumentRecord);
  const nextDataset = mergeIntoDataset(dataset, newDocuments);
  await writeDataset(nextDataset);

  return {
    documents: newDocuments,
    evidenceCards: nextDataset.evidenceCards.filter((card) =>
      newDocuments.some((document) => card.documentIds.includes(document.id)),
    ),
    knowledgeGraph: nextDataset.knowledgeGraph,
  };
}

export async function updateHumanReview(input: {
  documentId: string;
  status: ReviewStatus;
  reviewer: string;
  notes?: string;
  summary?: string;
}) {
  const dataset = await readDataset();
  const document = dataset.documents.find((entry) => entry.id === input.documentId);
  if (!document) {
    throw new Error(`Document ${input.documentId} not found`);
  }

  document.review = {
    status: input.status,
    reviewer: input.reviewer,
    notes: input.notes,
    reviewedAt: new Date().toISOString(),
  };
  if (input.summary) {
    document.summary = input.summary;
  }
  document.summaryNeedsReview = input.status !== "approved";
  document.updatedAt = new Date().toISOString();

  await writeDataset(dataset);
  return document;
}

export async function updateStorageLifecycle(input: {
  documentId: string;
  storageClass: StorageClass;
  retentionUntil: string;
}) {
  const dataset = await readDataset();
  const document = dataset.documents.find((entry) => entry.id === input.documentId);
  if (!document) {
    throw new Error(`Document ${input.documentId} not found`);
  }

  document.storageClass = input.storageClass;
  document.retentionUntil = input.retentionUntil;
  document.updatedAt = new Date().toISOString();
  await writeDataset(dataset);
  return document;
}

export async function listEvidence(query?: string) {
  const dataset = await readDataset();
  return retrieveEvidence(dataset, query);
}

export async function getIntelligenceSnapshot() {
  const dataset = await readDataset();
  return {
    documents: dataset.documents,
    evidenceCards: dataset.evidenceCards,
    knowledgeGraph: dataset.knowledgeGraph,
    stats: {
      documents: dataset.documents.length,
      pendingReview: dataset.documents.filter((document) => document.review.status === "pending").length,
      redFlags: dataset.documents.reduce((count, document) => count + document.redFlags.length, 0),
      evidenceCards: dataset.evidenceCards.length,
    },
  };
}
