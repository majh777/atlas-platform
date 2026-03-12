import Link from "next/link";
import { getAtlasBankabilityContext } from "@/lib/bankability/data";
import { evaluateBankability, explainCriterion, getRiskDashboard } from "@/lib/bankability/engine";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function BankabilityDashboard() {
  const evaluation = evaluateBankability();
  const risk = getRiskDashboard();
  const explanation = explainCriterion(getAtlasBankabilityContext(), "fin-dscr");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10 lg:px-10">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-slate-950/30">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Module 4 · Bankability Scoring and Risk Engineering</p>
              <h1 className="text-4xl font-semibold tracking-tight">{evaluation.project.name}</h1>
              <p className="max-w-3xl text-sm leading-7 text-slate-300">
                Committee-grade underwriting cockpit for configurable scoring domains, red-flag governance,
                evidence-linked narratives, scenario analysis, and issue-to-action workflows.
              </p>
            </div>

            <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2 lg:min-w-[360px]">
              <StatCard label="Overall score" value={`${evaluation.overallScore}/100`} accent="text-emerald-300" />
              <StatCard label="Debt ask" value={currency.format(evaluation.project.debtAskUsdM * 1_000_000)} accent="text-cyan-300" />
              <StatCard label="Red flags" value={String(evaluation.redFlags.length)} accent="text-amber-300" />
              <StatCard label="Open risk issues" value={String(risk.countsByStatus.open)} accent="text-rose-300" />
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.8fr_1fr]">
          <Card title="Configurable scoring domains" subtitle={`Model ${evaluation.scoringModel.version} · Effective ${evaluation.scoringModel.effectiveDate}`}>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {evaluation.domainScores.map((domain) => (
                <div key={domain.domain} className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-medium capitalize">{domain.domain}</h3>
                      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">Weighted domain score</p>
                    </div>
                    <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-sm font-semibold text-cyan-300">
                      {domain.weightedScore}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{domain.narrative}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Red-flag rules & issue routing" subtitle="Critical blockers automatically attach mitigation templates">
            <div className="space-y-4">
              {evaluation.redFlags.map((flag) => (
                <div key={flag.id} className="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-200">{flag.severity}</span>
                    <span className="text-xs capitalize text-amber-100/80">{flag.domain}</span>
                  </div>
                  <p className="mt-2 font-medium text-white">{flag.label}</p>
                  <p className="mt-2 text-sm leading-6 text-amber-50/85">{flag.mitigation}</p>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_1fr_1fr]">
          <Card title="Readiness scorecards" subtitle="Project, workstream, and counterparty views">
            <div className="space-y-4">
              {evaluation.readiness.map((item) => (
                <div key={item.targetId} className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-white">{item.label}</p>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{item.type}</p>
                    </div>
                    <span className="text-xl font-semibold text-white">{item.score}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{item.narrative}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Scenario logic" subtitle="What-if analysis across downside and upside cases">
            <div className="space-y-4">
              {evaluation.scenarios.map((scenario) => (
                <div key={scenario.mode} className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-medium capitalize text-white">{scenario.mode}</span>
                    <span className="text-sm text-slate-300">
                      {scenario.overallScore} ({scenario.deltaVsBase >= 0 ? "+" : ""}
                      {scenario.deltaVsBase})
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{scenario.narrative}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Archetype benchmark" subtitle="Gap-to-benchmark by diligence domain">
            <div className="space-y-4">
              {evaluation.benchmarkDeltas.map((delta) => (
                <div key={delta.domain} className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="capitalize text-white">{delta.domain}</span>
                    <span className={delta.gap >= 0 ? "text-emerald-300" : "text-rose-300"}>
                      {delta.gap >= 0 ? "+" : ""}
                      {delta.gap}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">
                    Actual {delta.actual} vs benchmark {delta.benchmark}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <Card title="Committee-grade narrative" subtitle={evaluation.committeeNarrative.headline}>
            <div className="space-y-4 text-sm leading-7 text-slate-300">
              <p>{evaluation.committeeNarrative.summary}</p>
              <div>
                <h3 className="font-medium text-white">Strengths</h3>
                <ul className="mt-2 list-disc space-y-2 pl-5">
                  {evaluation.committeeNarrative.strengths.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-white">Watchouts</h3>
                <ul className="mt-2 list-disc space-y-2 pl-5">
                  {evaluation.committeeNarrative.watchouts.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-white">Evidence links</h3>
                <div className="mt-3 grid gap-3">
                  {evaluation.committeeNarrative.evidenceLinks.map((link) => (
                    <a
                      key={link.id}
                      href={link.href}
                      className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 transition hover:border-cyan-400/40 hover:bg-slate-900"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-medium text-white">{link.title}</span>
                        <span className="text-xs uppercase tracking-[0.2em] text-cyan-300">{link.strength}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-300">{link.excerpt}</p>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card title="Issue-to-action workflow" subtitle="Owner-assigned mitigation register">
            <div className="space-y-4">
              {evaluation.mitigationRegister.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-sm text-slate-300">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-white">{item.title}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">{item.workstream}</p>
                    </div>
                    <span className="rounded-full bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">{item.status}</span>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400">
                    <div>
                      <dt>Owner</dt>
                      <dd className="mt-1 text-sm text-slate-200">{item.owner}</dd>
                    </div>
                    <div>
                      <dt>Due</dt>
                      <dd className="mt-1 text-sm text-slate-200">{item.dueDate}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <Card title="Explanation engine" subtitle="Evidence-mapped rationale for weighted criteria">
            <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-sm text-slate-300">
              <p className="font-medium text-white">Debt capacity and downside resilience</p>
              <p className="mt-2">{explanation?.explanation ?? "Explanation unavailable."}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(explanation?.evidence ?? []).map((item) => (
                  <span key={item.id} className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300">
                    {item.title}
                  </span>
                ))}
              </div>
            </div>
          </Card>

          <Card title="Board / lender pack export" subtitle="Generated pack is also available via API">
            <div className="space-y-4 text-sm text-slate-300">
              <p>
                Export a concise board pack through the API route or use the current pack as a basis for memo generation.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/api/bankability/scores?format=pack" className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-300">
                  Download pack payload
                </Link>
                <Link href="/api/risk" className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white transition hover:border-cyan-400/40 hover:text-cyan-200">
                  Open risk API
                </Link>
              </div>
            </div>
          </Card>
        </section>
      </main>
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-slate-950/20">
      <div className="mb-4 flex flex-col gap-1">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        {subtitle ? <p className="text-sm text-slate-400">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${accent}`}>{value}</p>
    </div>
  );
}
