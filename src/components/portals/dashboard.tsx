import Link from 'next/link';
import { ArrowRight, Bell, Download, Palette, ShieldCheck, Smartphone } from 'lucide-react';
import { Card, Pill, SectionTitle, cn } from '@/components/ui';
import { generateReport, getDashboardBundle, getPortalSummary, listPortals, listScheduledReports } from '@/lib/portals/store';
import type { ChartPoint, PortalRole } from '@/types/portal';

const roleLabels: Record<PortalRole, string> = {
  executive: 'Executive cockpit',
  investor: 'Investor portal',
  operator: 'Operator portal',
};

function TrendPill({ value }: { value: string }) {
  const tone = value.includes('-') ? 'warn' : 'success';
  return <Pill tone={tone}>{value}</Pill>;
}

function MiniChart({ points, accent }: { points: ChartPoint[]; accent: string }) {
  const max = Math.max(...points.map((point) => point.value), 1);
  return (
    <div className="flex items-end gap-3">
      {points.map((point) => (
        <div key={point.label} className="flex flex-1 flex-col items-center gap-2">
          <div
            className="w-full rounded-t-2xl"
            style={{ height: `${Math.max(28, (point.value / max) * 140)}px`, background: accent }}
          />
          <div className="text-xs text-slate-400">{point.label}</div>
        </div>
      ))}
    </div>
  );
}

function ThemePreview({ role }: { role: PortalRole }) {
  const bundle = getDashboardBundle(role);
  if (!bundle) return null;

  const { theme } = bundle.workspace;
  return (
    <Card>
      <div className="mb-4 flex items-center gap-3">
        <Palette className="h-5 w-5 text-cyan-300" />
        <div>
          <h3 className="font-semibold text-white">White-label presentation</h3>
          <p className="text-sm text-slate-400">Per-workspace branding and surface controls for LP rooms and sponsor-facing views.</p>
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 p-4" style={{ backgroundColor: theme.surface }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Brand</div>
            <div className="mt-1 text-lg font-semibold text-white">{theme.logoText}</div>
          </div>
          <Pill tone={theme.whiteLabel ? 'success' : 'default'}>{theme.whiteLabel ? 'White-label ON' : 'Atlas default'}</Pill>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 text-xs text-slate-300">
          <div className="rounded-xl p-3" style={{ backgroundColor: theme.primary }}>Primary</div>
          <div className="rounded-xl p-3" style={{ backgroundColor: theme.accent }}>Accent</div>
          <div className="rounded-xl border border-white/10 p-3">Mobile-safe palette</div>
        </div>
      </div>
    </Card>
  );
}

export function PortalOverviewPage() {
  const summary = getPortalSummary();
  const demoReport = generateReport('portal-investor-core', 'pdf');

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <section className="rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/12 via-slate-900 to-slate-950 p-8">
          <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <div className="space-y-4">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Module 10 · Portals</p>
              <h1 className="text-4xl font-semibold tracking-tight">Client, investor, and operator portals with scheduled reporting and white-label delivery.</h1>
              <p className="max-w-3xl text-sm leading-7 text-slate-300">
                Atlas now exposes role-aware portal surfaces for executive command, investor evidence access, and operator oversight.
                Dashboards are mobile-responsive, report exports support PDF and spreadsheet delivery, and workspace branding can switch into white-label presentation mode.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(summary).map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</div>
                  <div className="mt-2 text-3xl font-semibold text-white">{String(value)}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          {(['executive', 'investor', 'operator'] as PortalRole[]).map((role) => {
            const dashboard = getDashboardBundle(role);
            if (!dashboard) return null;

            return (
              <Card key={role} className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm uppercase tracking-[0.24em] text-cyan-300">{roleLabels[role]}</p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">{dashboard.workspace.name}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{dashboard.subheadline}</p>
                  </div>
                  <Pill tone={role === 'operator' ? 'warn' : 'success'}>{role === 'operator' ? 'Pilot' : 'Live'}</Pill>
                </div>
                <div className="mt-5 grid gap-3">
                  {dashboard.metrics.slice(0, 3).map((metric) => (
                    <div key={metric.label} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{metric.label}</div>
                          <div className="mt-2 text-2xl font-semibold text-white">{metric.value}</div>
                        </div>
                        <TrendPill value={metric.delta} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 space-y-3">
                  {dashboard.navigation.map((item) => (
                    <Link key={`${role}-${item.href}`} href={item.href} className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-200 transition hover:border-cyan-400/40 hover:text-white">
                      <span>{item.label}</span>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  ))}
                </div>
              </Card>
            );
          })}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <Card>
            <SectionTitle eyebrow="Scheduled reporting" title="Exports, notifications, and delivery lanes" subtitle="PDF packs, spreadsheet summaries, and controlled workspace distribution." />
            <div className="mt-6 space-y-4">
              {listScheduledReports().map((schedule) => (
                <div key={schedule.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">{schedule.portalId}</div>
                      <div className="mt-1 text-sm text-slate-400">{schedule.cadence} via {schedule.channel} · next run {schedule.nextRunAt}</div>
                    </div>
                    <Pill>{schedule.format}</Pill>
                  </div>
                  <div className="mt-3 text-sm text-slate-300">Recipients: {schedule.recipients.join(', ')}</div>
                </div>
              ))}
            </div>
            {demoReport ? (
              <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4 text-sm text-slate-200">
                <div className="flex items-center gap-2 text-cyan-200"><Download className="h-4 w-4" /> Demo export ready: {demoReport.exportName}</div>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-300">
                  {demoReport.notifications.map((note) => <li key={note}>{note}</li>)}
                </ul>
              </div>
            ) : null}
          </Card>

          <div className="space-y-6">
            <ThemePreview role="investor" />
            <Card>
              <div className="mb-4 flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-cyan-300" />
                <div>
                  <h3 className="font-semibold text-white">Mobile action trays</h3>
                  <p className="text-sm text-slate-400">High-priority actions stay thumb-reachable for approvals, escalations, and data-room tasks.</p>
                </div>
              </div>
              <div className="space-y-3">
                {listPortals().flatMap((portal) => portal.mobileActions.slice(0, 1).map((action) => ({ action, title: portal.title }))).map((item) => (
                  <div key={`${item.title}-${item.action}`} className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-200">
                    <div className="font-medium text-white">{item.action}</div>
                    <div className="mt-1 text-slate-400">{item.title}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}

export function DashboardsPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <section className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-8">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Command surfaces</p>
          <h1 className="text-4xl font-semibold">Role-aware dashboards</h1>
          <p className="max-w-3xl text-sm leading-7 text-slate-300">Each dashboard uses shared navigation, evidence access controls, cached data bundles, and responsive card layouts.</p>
        </section>

        {(['executive', 'investor', 'operator'] as PortalRole[]).map((role) => {
          const dashboard = getDashboardBundle(role);
          if (!dashboard) return null;

          return (
            <section key={role} className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.24em] text-cyan-300">{roleLabels[role]}</p>
                    <h2 className="mt-2 text-3xl font-semibold text-white">{dashboard.headline}</h2>
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">{dashboard.subheadline}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {dashboard.navigation.map((item) => <Pill key={`${role}-${item.href}`}>{item.label}</Pill>)}
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {dashboard.metrics.map((metric) => (
                    <div key={metric.label} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{metric.label}</div>
                      <div className="mt-2 text-3xl font-semibold text-white">{metric.value}</div>
                      <div className="mt-2"><TrendPill value={metric.delta} /></div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-2">
                  {dashboard.chartSeries.map((series, index) => (
                    <div key={series.title} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <h3 className="font-semibold text-white">{series.title}</h3>
                        <Pill tone={index === 0 ? 'success' : 'default'}>Cached</Pill>
                      </div>
                      <MiniChart points={series.points} accent={index === 0 ? 'linear-gradient(180deg, rgba(34,211,238,0.95), rgba(34,211,238,0.2))' : 'linear-gradient(180deg, rgba(245,158,11,0.95), rgba(245,158,11,0.2))'} />
                    </div>
                  ))}
                </div>
              </Card>

              <div className="space-y-6">
                <Card>
                  <div className="mb-4 flex items-center gap-3">
                    <Bell className="h-5 w-5 text-cyan-300" />
                    <div>
                      <h3 className="font-semibold text-white">Action tray</h3>
                      <p className="text-sm text-slate-400">Optimized for desktop and mobile approvals.</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {dashboard.actionTray.map((action) => (
                      <div key={action.id} className={cn('rounded-2xl border p-4', action.severity === 'critical' ? 'border-rose-500/30 bg-rose-500/10' : action.severity === 'warn' ? 'border-amber-500/25 bg-amber-500/8' : 'border-white/10 bg-slate-950/60')}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-white">{action.title}</div>
                          <Pill tone={action.severity === 'critical' ? 'danger' : action.severity === 'warn' ? 'warn' : 'default'}>{action.status}</Pill>
                        </div>
                        <div className="mt-2 text-sm text-slate-300">{action.owner} · due {action.due}</div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card>
                  <div className="mb-4 flex items-center gap-3">
                    <ShieldCheck className="h-5 w-5 text-cyan-300" />
                    <div>
                      <h3 className="font-semibold text-white">Controlled evidence view</h3>
                      <p className="text-sm text-slate-400">Permission-aware document visibility by portal role.</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {dashboard.evidence.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-white">{item.title}</div>
                          <Pill tone={item.classification === 'restricted' ? 'danger' : item.classification === 'controlled' ? 'warn' : 'success'}>{item.classification}</Pill>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-300">{item.summary}</p>
                        <p className="mt-2 text-xs text-slate-500">Source: {item.source}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}

export function ReportsPage() {
  const portalReports = listPortals().map((portal) => ({
    portal,
    pdf: generateReport(portal.id, 'pdf'),
    sheet: generateReport(portal.id, 'spreadsheet'),
  }));

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <section className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-8">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Reporting and export engine</p>
          <h1 className="text-4xl font-semibold">Scheduled reports, notifications, and download surfaces</h1>
          <p className="max-w-3xl text-sm leading-7 text-slate-300">Atlas generates lightweight PDF board packs, spreadsheet summaries, and JSON payloads for downstream integrations or data rooms.</p>
        </section>

        <div className="grid gap-6 xl:grid-cols-3">
          {portalReports.map(({ portal, pdf, sheet }) => (
            <Card key={portal.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-cyan-300">{roleLabels[portal.role]}</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">{portal.workspace.name}</h2>
                </div>
                <Pill tone={portal.workspace.theme.whiteLabel ? 'success' : 'default'}>{portal.workspace.theme.whiteLabel ? 'Branded' : 'Atlas'}</Pill>
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-300">{portal.summary}</p>
              <div className="mt-5 space-y-3 text-sm text-slate-300">
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <div className="font-medium text-white">{pdf?.exportName}</div>
                  <div className="mt-1 text-slate-400">{pdf?.summary}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <div className="font-medium text-white">{sheet?.exportName}</div>
                  <div className="mt-1 text-slate-400">CSV spreadsheet snapshot for finance, ops, or IR workflows.</div>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href={`/api/reports?portalId=${portal.id}&format=pdf`} className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-300">PDF export</Link>
                <Link href={`/api/reports?portalId=${portal.id}&format=spreadsheet`} className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white transition hover:border-cyan-400/40 hover:text-cyan-200">Spreadsheet export</Link>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
