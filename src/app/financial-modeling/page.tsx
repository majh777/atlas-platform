import { MetricCard } from "@/components/finance/metric-card";
import { compareScenarios } from "@/lib/finance/calculations";
import { demoScenarios } from "@/lib/finance/demo-data";
import { listModelLibrary, listScenarios } from "@/lib/finance/repository";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });

export default function FinancialModelingPage() {
  const scenarios = listScenarios();
  const library = listModelLibrary();
  const comparison = compareScenarios(demoScenarios[0], demoScenarios[1]);
  const base = scenarios[0];

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <section className="rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 via-slate-900 to-slate-950 p-8">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Atlas • Module 5</p>
          <h1 className="mt-3 text-4xl font-semibold">Financial Modelling & Capital Stack Optimisation</h1>
          <p className="mt-4 max-w-3xl text-slate-300">
            Deterministic project-finance modelling for CapEx, OpEx, revenue, covenant stress testing, lender packs,
            assumption libraries, and model-review workflows.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Funding readiness" value={`${base.metrics.fundingReadinessScore.toFixed(1)}/100`} helper="Blends leverage, DSCR, IRR, and coverage metrics." />
          <MetricCard label="Base DSCR" value={`${base.metrics.dscr.toFixed(2)}x`} helper="Senior debt service coverage under base case." />
          <MetricCard label="Project IRR" value={pct.format(base.metrics.projectIrr)} helper="After-tax return proxy from deterministic model." />
          <MetricCard label="EBITDA" value={money.format(base.metrics.ebitda)} helper="Generated from the linked revenue and OpEx templates." />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">Scenario stack</h2>
            <div className="mt-5 grid gap-4">
              {scenarios.map((scenario) => (
                <article key={scenario.input.id} className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">{scenario.input.name}</h3>
                      <p className="text-sm text-slate-400">{scenario.input.projectName} • {scenario.input.fundingStructure} structure</p>
                    </div>
                    <span className="rounded-full bg-cyan-400/15 px-3 py-1 text-xs uppercase tracking-[0.2em] text-cyan-300">
                      {scenario.input.reviewStatus}
                    </span>
                  </div>
                  <dl className="mt-4 grid gap-3 md:grid-cols-3">
                    <div>
                      <dt className="text-sm text-slate-400">CapEx</dt>
                      <dd className="text-lg font-medium">{money.format(scenario.metrics.totalCapex)}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-slate-400">Revenue</dt>
                      <dd className="text-lg font-medium">{money.format(scenario.metrics.revenue)}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-slate-400">Leverage</dt>
                      <dd className="text-lg font-medium">{scenario.metrics.leverageRatio.toFixed(2)}x</dd>
                    </div>
                  </dl>
                  <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-300">
                    {scenario.lenderPack.highlights.map((highlight) => (
                      <span key={highlight} className="rounded-full bg-white/8 px-3 py-1">{highlight}</span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold">Stress testing</h2>
              <div className="mt-4 space-y-4">
                {base.sensitivity.map((stress) => (
                  <div key={stress.shock} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-medium">{stress.shock}</h3>
                      <span className="text-sm text-slate-400">DSCR {stress.metrics.dscr.toFixed(2)}x</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-300">
                      EBITDA {money.format(stress.metrics.ebitda)} • IRR {pct.format(stress.metrics.projectIrr)}
                    </p>
                    <p className="mt-2 text-xs text-amber-300">
                      {stress.covenantBreaches.length > 0 ? stress.covenantBreaches.join(" • ") : "No covenant breaches"}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold">Assumptions & version comparison</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                {library.assumptions.map((version) => (
                  <div key={version.version} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                    <p className="font-medium text-white">{version.version}</p>
                    <p className="mt-1">{version.summary}</p>
                    <p className="mt-2 text-slate-400">
                      Discount {pct.format(version.assumptions.discountRate)} • Interest {pct.format(version.assumptions.interestRate)} • Growth {pct.format(version.assumptions.defaultProductionGrowth)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">Scenario comparison API preview</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {Object.entries(comparison.deltas).slice(0, 6).map(([metric, delta]) => (
                <div key={metric} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                  <p className="text-sm text-slate-400">{metric}</p>
                  <p className={`mt-2 text-xl font-semibold ${delta >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{delta >= 0 ? "+" : ""}{delta.toFixed(2)}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-slate-400">Better on: {comparison.betterOn.join(", ") || "—"}</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">Approval history & lender pack</h2>
            <div className="mt-4 space-y-3">
              {base.lenderPack.approvalHistory.map((approval) => (
                <div key={`${approval.reviewer}-${approval.timestamp}`} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-white">{approval.reviewer}</p>
                    <span className="text-xs uppercase tracking-[0.2em] text-cyan-300">{approval.status}</span>
                  </div>
                  <p className="text-sm text-slate-400">{approval.role} • {approval.timestamp}</p>
                  <p className="mt-2 text-sm text-slate-300">{approval.comment}</p>
                </div>
              ))}
            </div>
            <ul className="mt-5 list-disc space-y-2 pl-5 text-sm text-slate-300">
              {base.lenderPack.checklist.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold">Template library</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {library.templates.map((template) => (
              <div key={template.id} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">{template.type}</p>
                <h3 className="mt-2 font-medium text-white">{template.name}</h3>
                <p className="mt-2 text-sm text-slate-400">{template.basis}</p>
                <p className="mt-3 text-sm text-slate-300">Items: {template.items.length}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
