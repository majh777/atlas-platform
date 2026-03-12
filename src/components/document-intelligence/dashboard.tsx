"use client";

import { useMemo, useState } from "react";
import type { DocumentRecord, EvidenceCard, KnowledgeGraph } from "@/types/document-intelligence";

interface DashboardProps {
  initialDocuments: DocumentRecord[];
  initialEvidenceCards: EvidenceCard[];
  knowledgeGraph: KnowledgeGraph;
}

const sampleDocuments = `Mining Permit PERMIT-CM-2026-014 for Project Mbalam North\nIssued in Cameroon on 2026-01-14 by Mining Authority\nExpiry review pending approval and annex B is missing\nCounterparty: Panthera Mining Ltd\nLocation: Kribi logistics corridor\n\nTechnical Feasibility Study for Asset Lobe Iron\nPrepared on 2026-02-21\nResource estimate confirms rail-linked export case\nCounterparty: Frontier Bank advisory team\nLocation: Douala and Lobe\n\nOfftake Term Sheet for Project Ngovayang\nDraft only and awaiting signature\nBuyer: Global Metals LLC\nPricing references benchmark discount\nLocation: Paris negotiation room`;

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function DocumentIntelligenceDashboard({
  initialDocuments,
  initialEvidenceCards,
  knowledgeGraph,
}: DashboardProps) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [evidenceCards, setEvidenceCards] = useState(initialEvidenceCards);
  const [graph, setGraph] = useState(knowledgeGraph);
  const [bulkText, setBulkText] = useState(sampleDocuments);
  const [query, setQuery] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const filteredEvidence = useMemo(() => {
    const normalized = query.toLowerCase();
    if (!normalized) return evidenceCards;
    return evidenceCards.filter((card) =>
      [card.title, card.statement, card.tags.join(" "), card.entities.map((entity) => entity.value).join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [evidenceCards, query]);

  const stats = useMemo(
    () => ({
      documents: documents.length,
      redFlags: documents.reduce((count, document) => count + document.redFlags.length, 0),
      pendingReview: documents.filter((document) => document.review.status === "pending").length,
      entities: graph.nodes.length,
    }),
    [documents, graph.nodes.length],
  );

  async function ingestBatch() {
    setLoading(true);
    setStatusMessage(null);
    try {
      const parts = bulkText
        .split(/\n\s*\n/)
        .map((part) => part.trim())
        .filter(Boolean);

      const payload = parts.map((text, index) => {
        const [firstLine] = text.split("\n");
        return {
          name: firstLine || `Document ${index + 1}`,
          source: index === 0 ? "bulk_upload" : index === 1 ? "email" : "connector",
          connector: index === 2 ? "sharepoint-room" : undefined,
          text,
        };
      });

      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documents: payload }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Unable to ingest documents");
      }

      setDocuments((current) => [...data.documents, ...current]);
      setEvidenceCards((current) => [...data.evidenceCards, ...current]);
      setGraph(data.knowledgeGraph);
      setStatusMessage(`Ingested ${data.documents.length} document(s) with OCR, entity extraction, chunking, and evidence generation.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function reviewDocument(documentId: string, approved: boolean) {
    const response = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "review",
        documentId,
        status: approved ? "approved" : "changes_requested",
        reviewer: "Alex diligence team",
        notes: approved ? "Summary validated." : "Please refine summary and attach missing annex.",
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setStatusMessage(data.error ?? "Unable to update review");
      return;
    }

    setDocuments((current) => current.map((document) => (document.id === documentId ? data.document : document)));
    setStatusMessage(`Updated review state for ${data.document.name}.`);
  }

  async function archiveDocument(documentId: string) {
    const retentionUntil = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 3).toISOString();
    const response = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "retention",
        documentId,
        storageClass: "archive",
        retentionUntil,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setStatusMessage(data.error ?? "Unable to archive document");
      return;
    }

    setDocuments((current) => current.map((document) => (document.id === documentId ? data.document : document)));
    setStatusMessage(`${data.document.name} moved to archive lifecycle policy.`);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-8 px-6 py-10 text-slate-100 lg:px-10">
      <section className="grid gap-4 rounded-3xl border border-slate-800 bg-slate-950/80 p-8 shadow-2xl shadow-cyan-950/20 lg:grid-cols-[1.7fr_1fr]">
        <div className="space-y-5">
          <span className="inline-flex rounded-full border border-cyan-400/40 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
            Module 3 · Project dossier intelligence
          </span>
          <h1 className="text-4xl font-semibold tracking-tight text-white">Ingestion, OCR intelligence, evidence cards, and human review in one operating surface.</h1>
          <p className="max-w-3xl text-sm leading-7 text-slate-300">
            Atlas ingests bulk uploads, email-forwarded records, and connector imports; classifies documents; extracts entities for assets, permits, locations, and counterparties; builds searchable evidence cards with source citations; and routes AI summaries into a human-in-the-loop validation lane.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          {Object.entries(stats).map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</div>
              <div className="mt-2 text-3xl font-semibold text-white">{value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">Ingestion console</h2>
              <p className="text-sm text-slate-400">Paste dossier text blocks to simulate bulk upload, email ingestion, and connector import.</p>
            </div>
            <button
              onClick={ingestBatch}
              disabled={loading}
              className="rounded-full bg-cyan-400 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-600"
            >
              {loading ? "Processing…" : "Run ingestion pipeline"}
            </button>
          </div>
          <textarea
            value={bulkText}
            onChange={(event) => setBulkText(event.target.value)}
            className="min-h-[280px] w-full rounded-2xl border border-slate-800 bg-slate-900/90 p-4 font-mono text-sm text-slate-100 outline-none ring-0 placeholder:text-slate-500"
          />
          {statusMessage ? <p className="mt-4 text-sm text-cyan-200">{statusMessage}</p> : null}
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
          <h2 className="text-xl font-semibold text-white">Knowledge graph preview</h2>
          <p className="mt-2 text-sm text-slate-400">Nodes are extracted entities. Edges are inferred dossier relationships created during chunking and graph population.</p>
          <div className="mt-4 space-y-3">
            {graph.nodes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">No entities yet — ingest a batch to populate the graph.</div>
            ) : (
              graph.nodes.slice(0, 8).map((node) => (
                <div key={node.id} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-white">{node.value}</span>
                    <span className="rounded-full border border-slate-700 px-2 py-1 text-xs uppercase tracking-[0.18em] text-slate-400">{node.type}</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">Confidence {(node.confidence * 100).toFixed(0)}%</div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">Document review queue</h2>
              <p className="text-sm text-slate-400">AI summaries, OCR metadata, completeness checks, red flags, and lifecycle controls.</p>
            </div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by asset, permit, counterparty, or issue"
              className="w-full max-w-xs rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
            />
          </div>
          <div className="space-y-4">
            {documents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">No documents ingested yet.</div>
            ) : (
              documents.map((document) => (
                <article key={document.id} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{document.name}</h3>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                        <span>{document.category.replace(/_/g, " ")}</span>
                        <span>•</span>
                        <span>{document.source}</span>
                        <span>•</span>
                        <span>v{document.version}</span>
                      </div>
                    </div>
                    <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">
                      {document.review.status}
                    </span>
                  </div>

                  <p className="mt-4 text-sm leading-7 text-slate-300">{document.summary}</p>

                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-2xl border border-slate-800 p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Metadata</div>
                      <ul className="mt-3 space-y-2 text-sm text-slate-300">
                        {Object.entries(document.metadata).map(([key, value]) => (
                          <li key={key}>
                            <span className="text-slate-500">{key}:</span> {value}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-2xl border border-slate-800 p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Entities</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {document.entities.map((entity) => (
                          <span key={entity.id} className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100">
                            {entity.type}: {entity.value}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-800 p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Storage lifecycle</div>
                      <div className="mt-3 text-sm text-slate-300">{document.storageClass} until {formatDate(document.retentionUntil)}</div>
                      <button onClick={() => archiveDocument(document.id)} className="mt-3 rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 transition hover:border-slate-500">
                        Move to archive
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-slate-800 p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Red flags</div>
                      <div className="mt-3 space-y-3 text-sm text-slate-300">
                        {document.redFlags.length === 0 ? (
                          <div>No automated red flags detected.</div>
                        ) : (
                          document.redFlags.map((flag) => (
                            <div key={flag.id} className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-3">
                              <div className="font-medium text-white">{flag.title}</div>
                              <div className="mt-1 text-slate-300">{flag.description}</div>
                              <div className="mt-2 text-xs text-slate-500">Citation: {flag.citation.excerpt}</div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-800 p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Completeness</div>
                      <div className="mt-3 space-y-2 text-sm text-slate-300">
                        {document.completenessChecks.map((check) => (
                          <div key={check.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-medium text-white">{check.label}</span>
                              <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{check.status}</span>
                            </div>
                            <p className="mt-1 text-slate-400">{check.detail}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button onClick={() => reviewDocument(document.id, true)} className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300">
                      Approve summary
                    </button>
                    <button onClick={() => reviewDocument(document.id, false)} className="rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/20">
                      Request changes
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
          <h2 className="text-xl font-semibold text-white">Evidence cards</h2>
          <p className="mt-2 text-sm text-slate-400">Searchable diligence facts with document citations and risk-ranked retrieval.</p>
          <div className="mt-4 space-y-4">
            {filteredEvidence.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-700 p-5 text-sm text-slate-400">No evidence cards match the current search.</div>
            ) : (
              filteredEvidence.map((card) => (
                <article key={card.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold text-white">{card.title}</h3>
                    <span className="rounded-full border border-slate-700 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-400">{card.riskLevel}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{card.statement}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {card.tags.map((tag) => (
                      <span key={tag} className="rounded-full border border-slate-700 px-2 py-1 text-[11px] text-slate-300">{tag}</span>
                    ))}
                  </div>
                  <div className="mt-4 space-y-2 text-xs text-slate-500">
                    {card.citations.map((citation) => (
                      <div key={`${card.id}-${citation.chunkId}`} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                        <div className="font-medium text-slate-300">{citation.documentName} · v{citation.version}</div>
                        <div className="mt-1">Lines {citation.lineRange[0]}–{citation.lineRange[1]}</div>
                        <div className="mt-1 text-slate-400">“{citation.excerpt}”</div>
                      </div>
                    ))}
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
