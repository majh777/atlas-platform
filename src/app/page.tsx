import Link from "next/link";

const modules = [
  {
    title: "Module 1 · Deal Radar & Origination Command Center",
    href: "/deal-radar",
    description:
      "Pipeline triage, score-based prioritisation, target watchlists, relationship notes, and committee-pack generation.",
    status: "Live",
  },
  {
    title: "Module 3 · Document Intelligence",
    href: "/documents",
    description:
      "Dossier ingestion, classification, entity extraction, evidence cards, and human review workflows.",
    status: "Live",
  },
  {
    title: "Module 4 · Bankability Scoring and Risk Engineering",
    href: "/bankability",
    description:
      "Configurable underwriting domains, red-flag governance, readiness scorecards, evidence-linked narratives, scenario analysis, and issue-to-action routing.",
    status: "New",
  },
  {
    title: "Module 5 · Financial Modelling & Capital Stack Optimisation",
    href: "/financial-modeling",
    description:
      "Scenario libraries, deterministic finance calculations, stress tests, lender packs, and comparison APIs.",
    status: "Live",
  },
  {
    title: "Evidence workspace",
    href: "/evidence",
    description:
      "Evidence-card registry for linking diligence artefacts into scoring, risk, and committee narratives.",
    status: "Support",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100 lg:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <section className="max-w-3xl space-y-4">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Atlas PRD v1.0</p>
          <h1 className="text-5xl font-semibold tracking-tight">Project finance workflows for investment committee discipline.</h1>
          <p className="text-base leading-8 text-slate-300">
            Atlas is a lender-grade workspace for origination, diligence, bankability scoring, scenario analysis,
            and exportable decision packs. Module 4 is now wired into the broader product surface alongside the
            existing deal radar, document intelligence, and financial modelling layers.
          </p>
        </section>

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((module) => (
            <Link
              key={module.href}
              href={module.href}
              className="group rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:border-cyan-400/40 hover:bg-white/8"
            >
              <div className="flex h-full flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-cyan-300">{module.status}</p>
                  <span className="text-xs uppercase tracking-[0.2em] text-slate-500">{module.href}</span>
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-white">{module.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-slate-300">{module.description}</p>
                </div>
                <span className="mt-auto inline-flex items-center gap-2 text-sm font-medium text-white group-hover:text-cyan-200">
                  Open module <span aria-hidden>→</span>
                </span>
              </div>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
