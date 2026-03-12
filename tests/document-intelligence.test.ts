import { beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  classifyDocument,
  createDocumentRecord,
  extractEntities,
  mergeIntoDataset,
  retrieveEvidence,
} from "../src/lib/document-intelligence/pipeline";
import { ingestDocuments, listDocuments, updateHumanReview } from "../src/lib/document-intelligence/service";

const DATA_PATH = path.join(process.cwd(), "data", "document-intelligence.json");

const sampleText = [
  "Mining Permit PERMIT-CM-2026-014 for Project Mbalam North",
  "Issued in Cameroon on 2026-01-14 by Mining Authority",
  "Expiry review pending approval and annex B is missing",
  "Counterparty: Panthera Mining Ltd",
  "Location: Kribi logistics corridor",
].join("\n");

describe("document intelligence pipeline", () => {
  beforeEach(async () => {
    await fs.rm(DATA_PATH, { force: true });
  });

  it("classifies, extracts entities, chunks, and flags dossier risk", () => {
    expect(classifyDocument(sampleText)).toBe("permit");

    const entities = extractEntities(sampleText);
    expect(entities.some((entity) => entity.type === "permit")).toBe(true);
    expect(entities.some((entity) => entity.type === "location")).toBe(true);

    const document = createDocumentRecord({
      name: "Permit package",
      source: "bulk_upload",
      text: sampleText,
    });

    expect(document.chunks.length).toBeGreaterThan(0);
    expect(document.redFlags.some((flag) => flag.title === "Execution not finalized")).toBe(true);
    expect(document.completenessChecks.some((check) => check.id === "permit-number" && check.status === "complete")).toBe(true);

    const merged = mergeIntoDataset(
      { documents: [], evidenceCards: [], knowledgeGraph: { nodes: [], edges: [] } },
      [document],
    );

    const results = retrieveEvidence(merged, "permit");
    expect(results.length).toBeGreaterThan(0);
    expect(merged.knowledgeGraph.nodes.length).toBeGreaterThan(0);
  });

  it("persists ingested documents and supports human review updates", async () => {
    const ingestResult = await ingestDocuments([
      {
        name: "Permit package",
        source: "bulk_upload",
        text: sampleText,
      },
    ]);

    expect(ingestResult.documents).toHaveLength(1);
    expect(ingestResult.evidenceCards.length).toBeGreaterThan(0);

    const documents = await listDocuments({ status: "pending" });
    expect(documents).toHaveLength(1);

    const updated = await updateHumanReview({
      documentId: documents[0].id,
      reviewer: "QA Reviewer",
      status: "approved",
      notes: "Summary accepted.",
    });

    expect(updated.review.status).toBe("approved");
    expect(updated.summaryNeedsReview).toBe(false);
  });
});
