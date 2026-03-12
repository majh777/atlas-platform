import Link from "next/link";
import { listEvidence } from "@/lib/document-intelligence/service";

export default async function EvidencePage() {
  const evidenceCards = await listEvidence();

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">Atlas dossier intelligence</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Evidence cards</h1>
          </div>
          <Link href="/" className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200">Back to dashboard</Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {evidenceCards.map((card) => (
            <div key={card.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <h2 className="text-lg font-semibold text-white">{card.title}</h2>
              <p className="mt-2 text-sm text-slate-400">{card.statement}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
