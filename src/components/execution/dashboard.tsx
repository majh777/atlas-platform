"use client";

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardList, HardHat, PackageSearch, TrendingUp } from 'lucide-react';
import { Card, Pill, SectionTitle } from '@/components/ui';
import type { ExecutionTwin, IssueCategory, IssueRecord, Milestone } from '@/lib/execution/types';

function money(value: number) {
  return `$${(value / 1_000_000).toFixed(1)}m`;
}

function formatDate(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toneFromVariance(value: number) {
  if (value > 0) return 'danger' as const;
  if (value < 0) return 'success' as const;
  return 'default' as const;
}

export function ExecutionDashboard({ initialTwin }: { initialTwin: ExecutionTwin }) {
  const [twin, setTwin] = useState(initialTwin);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: 'Field weld punch-list at transfer station',
    category: 'field' as IssueCategory,
    workPackageId: initialTwin.workPackages[0]?.id ?? '',
    location: 'Transfer station / Elevation +22',
    priority: 'high',
    status: 'open',
    assignee: 'Area engineer',
    reportedBy: 'Mobile foreman app',
    description: 'Weld seam requires reinspection before handover.',
    mobileCaptured: true,
  });

  const criticalMilestones = useMemo(() => twin.milestones.filter((item) => item.critical), [twin.milestones]);
  const openIssues = useMemo(() => twin.issues.filter((item) => item.status !== 'closed'), [twin.issues]);

  async function refreshTwin() {
    const response = await fetch('/api/execution');
    const data = await response.json();
    setTwin(data);
  }

  async function submitIssue() {
    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Unable to log issue');
      await refreshTwin();
      setStatus(`Logged ${data.issue.category.replace('_', ' ')} issue for ${form.location}.`);
      setForm((current) => ({ ...current, title: '', location: '', description: '' }));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }

  async function closeIssue(issue: IssueRecord) {
    const response = await fetch('/api/issues', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: issue.id, status: 'closed' }),
    });
    if (response.ok) {
      await refreshTwin();
      setStatus(`${issue.title} closed.`);
    }
  }

  async function advanceMilestone(milestone: Milestone) {
    const response = await fetch('/api/milestones', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: milestone.id,
        status: milestone.completion >= 95 ? 'completed' : 'in_progress',
        completion: Math.min(100, milestone.completion + 10),
        actualDate: milestone.completion >= 95 ? new Date().toISOString() : undefined,
      }),
    });
    if (response.ok) {
      await refreshTwin();
      setStatus(`Milestone ${milestone.title} updated.`);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-8 px-6 py-10 text-slate-100 lg:px-10">
      <section className="grid gap-5 rounded-3xl border border-slate-800 bg-slate-950/80 p-8 shadow-2xl shadow-cyan-950/20 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          <span className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
            Module 7 · Execution digital twin & project controls
          </span>
          <h1 className="text-4xl font-semibold tracking-tight text-white">Schedule, cost, contractors, field controls, and procurement in one live operating surface.</h1>
          <p className="max-w-3xl text-sm leading-7 text-slate-300">
            Atlas now models execution work packages with milestone control, budget and contingency tracking, change-order workflows, mobile field issue logging, long-lead procurement monitoring, and integrated variance reporting for leadership review.
          </p>
          <div className="flex flex-wrap gap-2 text-xs text-slate-400">
            <span>Work-package twin</span><span>•</span><span>Milestone control</span><span>•</span><span>Forecast & commitments</span><span>•</span><span>Field issues / RFIs / punch-lists</span><span>•</span><span>Change-order workflow</span>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
          {[
            { label: 'Budget', value: money(twin.budget.approvedBudgetUsd), helper: 'Approved control budget' },
            { label: 'Forecast', value: money(twin.budget.currentForecastUsd), helper: 'Current estimate at completion' },
            { label: 'Open issues', value: String(openIssues.length), helper: 'Field, RFI, and punch-list actions' },
            { label: 'Long-lead late', value: String(twin.variance.longLeadDelayedCount), helper: 'Delayed procurement exposures' },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{card.label}</div>
              <div className="mt-2 text-3xl font-semibold text-white">{card.value}</div>
              <div className="mt-2 text-sm text-slate-400">{card.helper}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card><TrendingUp className="mb-3 h-5 w-5 text-cyan-300" /><div className="text-sm text-slate-400">Cost variance</div><div className="mt-2 text-3xl font-semibold text-white">{money(twin.variance.costVarianceUsd)}</div><Pill tone={toneFromVariance(twin.variance.costVarianceUsd)}>{twin.variance.costVarianceUsd > 0 ? 'Forecast overrun' : 'On plan'}</Pill></Card>
        <Card><ClipboardList className="mb-3 h-5 w-5 text-cyan-300" /><div className="text-sm text-slate-400">Avg schedule variance</div><div className="mt-2 text-3xl font-semibold text-white">{twin.variance.scheduleVarianceDays}d</div><Pill tone={twin.variance.scheduleVarianceDays > 0 ? 'warn' : 'success'}>{twin.variance.scheduleVarianceDays > 0 ? 'Behind baseline' : 'Recovered'}</Pill></Card>
        <Card><HardHat className="mb-3 h-5 w-5 text-cyan-300" /><div className="text-sm text-slate-400">Commitment coverage</div><div className="mt-2 text-3xl font-semibold text-white">{twin.variance.commitmentCoveragePct}%</div><Pill>{money(twin.budget.commitmentsUsd)} committed</Pill></Card>
        <Card><PackageSearch className="mb-3 h-5 w-5 text-cyan-300" /><div className="text-sm text-slate-400">Contingency remaining</div><div className="mt-2 text-3xl font-semibold text-white">{money(twin.variance.contingencyRemainingUsd)}</div><Pill tone={twin.variance.contingencyRemainingUsd < 5_000_000 ? 'warn' : 'success'}>Control reserve</Pill></Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <Card>
          <SectionTitle eyebrow="Digital twin" title="Work packages" subtitle="Physical progress, earned value, cost forecast, and next critical milestone by package." />
          <div className="mt-5 space-y-4">
            {twin.workPackages.map((wp) => (
              <div key={wp.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-white">{wp.code} · {wp.name}</div>
                    <div className="mt-1 text-sm text-slate-400">{wp.area} · {wp.contractor} · {wp.discipline}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Pill tone={wp.riskRating === 'high' ? 'danger' : wp.riskRating === 'medium' ? 'warn' : 'success'}>{wp.riskRating} risk</Pill>
                    {wp.longLeadExposure ? <Pill tone="warn">long-lead exposed</Pill> : null}
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <div className="rounded-2xl border border-slate-800 p-3"><div className="text-xs text-slate-500">Progress</div><div className="mt-1 text-2xl font-semibold text-white">{wp.progress}%</div><div className="text-xs text-slate-400">Plan {wp.plannedPercent}%</div></div>
                  <div className="rounded-2xl border border-slate-800 p-3"><div className="text-xs text-slate-500">Budget</div><div className="mt-1 text-2xl font-semibold text-white">{money(wp.budgetUsd)}</div><div className="text-xs text-slate-400">Forecast {money(wp.forecastUsd)}</div></div>
                  <div className="rounded-2xl border border-slate-800 p-3"><div className="text-xs text-slate-500">Commitments</div><div className="mt-1 text-2xl font-semibold text-white">{money(wp.commitmentsUsd)}</div><div className="text-xs text-slate-400">Earned {money(wp.earnedValueUsd)}</div></div>
                  <div className="rounded-2xl border border-slate-800 p-3"><div className="text-xs text-slate-500">Schedule variance</div><div className="mt-1 text-2xl font-semibold text-white">{wp.scheduleVarianceDays}d</div><div className="text-xs text-slate-400">Contingency {money(wp.contingencyUsd)}</div></div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle eyebrow="Integrated reporting" title="Controls highlights" subtitle="Top lines for steering committee, PMO, and lender reporting packs." />
          <div className="mt-5 space-y-3">
            {twin.highlights.map((item) => (
              <div key={item} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm leading-7 text-slate-300">{item}</div>
            ))}
          </div>
          <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="text-sm font-medium text-white">Contractor scorecards</div>
            <div className="mt-4 space-y-3">
              {twin.contractorScorecards.map((scorecard) => (
                <div key={scorecard.contractor} className="rounded-2xl border border-slate-800 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-white">{scorecard.contractor}</span>
                    <Pill tone={scorecard.productivity < 75 ? 'warn' : 'success'}>{scorecard.activeChangeOrders} active COs</Pill>
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-2 text-xs text-slate-400">
                    <div>Safety <span className="text-white">{scorecard.safety}</span></div>
                    <div>Quality <span className="text-white">{scorecard.quality}</span></div>
                    <div>Productivity <span className="text-white">{scorecard.productivity}</span></div>
                    <div>Commercial <span className="text-white">{scorecard.commercial}</span></div>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">Claims exposure {money(scorecard.claimsExposureUsd)} · {scorecard.notes}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
        <Card>
          <SectionTitle eyebrow="Milestones & procurement" title="Critical path tracker" subtitle="Manage schedule commitments and long-lead item exposures in one view." />
          <div className="mt-5 space-y-4">
            {criticalMilestones.map((milestone) => (
              <div key={milestone.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-white">{milestone.title}</div>
                    <div className="mt-1 text-sm text-slate-400">Owner: {milestone.owner} · Baseline {formatDate(milestone.baselineDate)} · Forecast {formatDate(milestone.forecastDate)}</div>
                  </div>
                  <Pill tone={milestone.status === 'delayed' ? 'danger' : milestone.status === 'at_risk' ? 'warn' : 'success'}>{milestone.status.replace('_', ' ')}</Pill>
                </div>
                <div className="mt-3 text-sm text-slate-300">Completion {milestone.completion}% · Dependencies: {milestone.dependencies.join(', ')}</div>
                <button onClick={() => advanceMilestone(milestone)} className="mt-3 rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-cyan-400/40">Advance milestone</button>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="text-sm font-medium text-white">Long-lead procurement monitor</div>
            <div className="mt-4 space-y-3">
              {twin.procurement.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 p-3 text-sm">
                  <div>
                    <div className="font-medium text-white">{item.item}</div>
                    <div className="text-slate-400">{item.supplier} · ROS {formatDate(item.requiredOnSiteDate)} · ETA {formatDate(item.forecastArrivalDate)}</div>
                  </div>
                  <Pill tone={item.varianceDays > 0 ? 'danger' : item.longLead ? 'warn' : 'default'}>{item.varianceDays > 0 ? `${item.varianceDays}d late` : item.status}</Pill>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle eyebrow="Mobile field controls" title="Issue logging" subtitle="Fast form for field issues, RFIs, and punch-list capture from phone or tablet." />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-300 sm:col-span-2"><span>Issue title</span><input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-white outline-none" /></label>
            <label className="space-y-2 text-sm text-slate-300"><span>Category</span><select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as IssueCategory }))} className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-white outline-none"><option value="field">Field issue</option><option value="rfi">RFI</option><option value="punch_list">Punch-list</option><option value="quality">Quality</option><option value="safety">Safety</option></select></label>
            <label className="space-y-2 text-sm text-slate-300"><span>Work package</span><select value={form.workPackageId} onChange={(event) => setForm((current) => ({ ...current, workPackageId: event.target.value }))} className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-white outline-none">{twin.workPackages.map((wp) => <option key={wp.id} value={wp.id}>{wp.code} · {wp.name}</option>)}</select></label>
            <label className="space-y-2 text-sm text-slate-300"><span>Location</span><input value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-white outline-none" /></label>
            <label className="space-y-2 text-sm text-slate-300"><span>Priority</span><select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))} className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-white outline-none"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label>
            <label className="space-y-2 text-sm text-slate-300"><span>Assignee</span><input value={form.assignee} onChange={(event) => setForm((current) => ({ ...current, assignee: event.target.value }))} className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-white outline-none" /></label>
            <label className="space-y-2 text-sm text-slate-300"><span>Reported by</span><input value={form.reportedBy} onChange={(event) => setForm((current) => ({ ...current, reportedBy: event.target.value }))} className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-white outline-none" /></label>
            <label className="space-y-2 text-sm text-slate-300 sm:col-span-2"><span>Description</span><textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="min-h-28 w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-white outline-none" /></label>
          </div>
          <button onClick={submitIssue} disabled={saving} className="mt-4 w-full rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-600">{saving ? 'Logging…' : 'Log issue from field'}</button>
          {status ? <div className="mt-3 text-sm text-cyan-200">{status}</div> : null}
          <div className="mt-5 space-y-3">
            {openIssues.map((issue) => (
              <div key={issue.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-white">{issue.title}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{issue.category.replace('_', ' ')} · {issue.location}</div>
                  </div>
                  <Pill tone={issue.priority === 'critical' ? 'danger' : issue.priority === 'high' ? 'warn' : 'default'}>{issue.priority}</Pill>
                </div>
                <div className="mt-2 text-sm text-slate-300">{issue.description}</div>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span>{issue.mobileCaptured ? 'Mobile capture' : 'Desk capture'} · Assignee {issue.assignee}</span>
                  {issue.status !== 'closed' ? <button onClick={() => closeIssue(issue)} className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-slate-300 transition hover:border-emerald-400/40"><CheckCircle2 className="h-4 w-4" /> Close</button> : null}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <SectionTitle eyebrow="Change control" title="Workflow engine" subtitle="From draft to implemented, every change order is tracked with approvals and impact." />
          <div className="mt-5 space-y-4">
            {twin.changeOrders.map((co) => (
              <div key={co.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-white">{co.title}</div>
                    <div className="mt-1 text-sm text-slate-400">{co.contractor} · {money(co.requestedCostUsd)} requested · {co.scheduleImpactDays}d impact</div>
                  </div>
                  <Pill tone={co.status === 'approved' ? 'success' : co.status === 'under_review' ? 'warn' : co.status === 'rejected' ? 'danger' : 'default'}>{co.status.replace('_', ' ')}</Pill>
                </div>
                <div className="mt-3 text-sm text-slate-300">{co.reason}</div>
                <div className="mt-3 text-xs text-slate-500">Approvers: {co.approvers.join(', ')}</div>
                <div className="mt-3 rounded-2xl border border-slate-800 p-3 text-xs text-slate-400">
                  {co.history.map((entry) => (
                    <div key={`${co.id}-${entry.at}-${entry.status}`} className="flex items-center justify-between gap-3 py-1">
                      <span>{entry.status.replace('_', ' ')}</span>
                      <span>{formatDate(entry.at)}</span>
                      <span className="max-w-[55%] truncate text-right">{entry.comment}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle eyebrow="Variance dashboard" title="Integrated reporting" subtitle="Cross-cutting execution view for schedule, cost, procurement, and field controls." />
          <div className="mt-5 grid gap-3">
            {[
              { icon: AlertTriangle, label: 'Critical issues', value: String(twin.variance.criticalIssuesOpen), helper: 'Immediate PMO escalation required' },
              { icon: ClipboardList, label: 'Milestones at risk', value: String(twin.milestones.filter((item) => item.status === 'at_risk' || item.status === 'delayed').length), helper: 'Recovery logic required on critical path' },
              { icon: PackageSearch, label: 'Late long-lead items', value: String(twin.procurement.filter((item) => item.longLead && item.varianceDays > 0).length), helper: 'Supply-chain expediting focus' },
            ].map(({ icon: Icon, label, value, helper }) => (
              <div key={label} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="flex items-center gap-3"><Icon className="h-5 w-5 text-cyan-300" /><div className="font-medium text-white">{label}</div></div>
                <div className="mt-2 text-3xl font-semibold text-white">{value}</div>
                <div className="mt-2 text-sm text-slate-400">{helper}</div>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}
