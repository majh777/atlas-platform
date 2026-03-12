import Link from "next/link";

const modules = [
  {
    title: "Module 2 · Deal Radar and Opportunity Origination",
    href: "/deal-radar",
    description:
      "Opportunity intake forms, scoring and triage queues, target lists, relationship notes, stage gates, pipeline reporting, committee packs, and external signal ingestion.",
  },
  {
    title: "Module 4 · Bankability Scoring and Risk Engineering",
    href: "/bankability",
    description:
      "Configurable underwriting domains, red-flag governance, readiness scorecards, evidence-linked narratives, scenario analysis, and issue-to-action routing.",
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
            Atlas is a lender-grade workspace for origination, scoring, diligence, risk engineering, and exportable decision packs.
            This build now includes live surfaces for Module 2 deal radar workflows and Module 4 bankability scoring.
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
                <div>
                  <p className="text-sm font-medium text-cyan-300">Live module</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">{module.title}</h2>
                </div>
                <p className="text-sm leading-7 text-slate-300">{module.description}</p>
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
