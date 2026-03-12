import Link from "next/link";
import { listDocuments } from "@/lib/document-intelligence/service";

export default async function DocumentsPage() {
  const documents = await listDocuments();

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">Atlas dossier ingestion</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Documents registry</h1>
          </div>
          <Link href="/" className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200">Back to dashboard</Link>
        </div>
        <div className="grid gap-4">
          {documents.map((document) => (
            <div key={document.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-white">{document.name}</h2>
                <span className="text-xs uppercase tracking-[0.18em] text-slate-400">{document.review.status}</span>
              </div>
              <p className="mt-2 text-sm text-slate-400">{document.summary}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
