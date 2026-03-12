import { initDb } from '@/lib/db';
import { getOpsOverview } from '@/lib/ops/service';

export const dynamic = 'force-dynamic';

export default function SupportConsolePage() {
  initDb();
  const overview = getOpsOverview();

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="space-y-3">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Module 12</p>
          <h1 className="text-4xl font-semibold">DevSecOps & enterprise operations console</h1>
          <p className="max-w-3xl text-sm text-slate-400">
            Unified surface for deployment controls, release readiness, incident command, runbook execution, observability,
            and automated quality gates.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          {[
            ['Release approvals', overview.summary.releaseApprovalQueue],
            ['Live incidents', overview.summary.liveIncidents],
            ['Failed deployments', overview.summary.failedDeployments],
            ['Active runbooks', overview.summary.activeRunbooks],
            ['Regression score', overview.summary.lastRegressionScore ?? 'n/a'],
            ['Security findings', overview.summary.securityFindings],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</div>
              <div className="mt-3 text-3xl font-semibold text-white">{String(value)}</div>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <h2 className="text-xl font-semibold">Release board</h2>
            <div className="mt-4 space-y-3">
              {overview.releases.slice(0, 5).map((release) => (
                <div key={release.id} className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">{release.version} · {release.name}</div>
                      <div className="mt-1 text-xs text-slate-400">{release.environment} · {release.status} · risk {release.risk_level}</div>
                    </div>
                    <div className="text-xs text-cyan-300">rollback {release.rollback_version ?? 'defined in manifest'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <h2 className="text-xl font-semibold">Incident command</h2>
            <div className="mt-4 space-y-3">
              {overview.incidents.slice(0, 5).map((incident) => (
                <div key={incident.id} className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">{incident.title}</div>
                      <div className="mt-1 text-xs text-slate-400">{incident.severity} · {incident.status} · {incident.source}</div>
                    </div>
                    <div className="text-xs text-amber-300">runbook {incident.runbook_id ?? 'pending linkage'}</div>
                  </div>
                  <p className="mt-3 text-sm text-slate-300">{incident.summary}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <h2 className="text-xl font-semibold">Runbook repository</h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              {overview.runbooks.map((runbook) => (
                <li key={runbook.id} className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
                  <div className="font-medium text-white">{runbook.title}</div>
                  <div className="mt-1 text-xs text-slate-400">{runbook.category} · {runbook.repository_path ?? 'docs/runbooks'}</div>
                  <div className="mt-2 text-slate-300">{runbook.summary}</div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <h2 className="text-xl font-semibold">Observability & security controls</h2>
            <div className="mt-4 space-y-4 text-sm text-slate-300">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Dashboards</div>
                <ul className="mt-2 space-y-2">
                  {overview.observability.dashboards.map((dashboard) => <li key={dashboard.id}>{dashboard.title} · {dashboard.url}</li>)}
                </ul>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Alerts</div>
                <ul className="mt-2 space-y-2">
                  {overview.observability.alerts.map((alert) => <li key={alert.id}>{alert.name} · {alert.threshold}</li>)}
                </ul>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Security</div>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>{overview.security.dependencyPolicy}</li>
                  <li>{overview.security.secretsRotationCadence}</li>
                  {overview.security.supplyChainControls.map((control) => <li key={control}>{control}</li>)}
                </ul>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
