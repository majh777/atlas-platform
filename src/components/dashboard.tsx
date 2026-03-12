import { Activity, Building2, FileText, Globe2, Signal, Users2 } from 'lucide-react';
import { buildCommitteePack, getCrmSyncHooks, opportunityStore } from '@/lib/opportunity-store';
import { probabilityWeightedValue } from '@/lib/scoring';
import type { Opportunity } from '@/types/opportunity';
import { MetricCard } from '@/components/finance/metric-card';
import { Card, Pill, SectionTitle } from '@/components/ui';

function aggregate<T extends string>(items: Opportunity[], getter: (item: Opportunity) => T) {
  return Object.entries(
    items.reduce<Record<string, number>>((acc, item) => {
      const key = getter(item);
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }));
}

function HeatGrid({ title, data }: { title: string; data: Array<{ label: string; value: number }> }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <Pill>{data.length} clusters</Pill>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {data.map((item) => {
          const intensity = item.value / max;
          return (
            <div
              key={item.label}
              className="rounded-xl border border-white/10 p-4"
              style={{ background: `linear-gradient(135deg, rgba(34,211,238,${0.15 + intensity * 0.45}), rgba(15,23,42,0.9))` }}
            >
              <div className="text-sm text-slate-300">{item.label}</div>
              <div className="mt-1 text-2xl font-semibold text-white">{item.value}</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function PipelineTable({ opportunities }: { opportunities: Opportunity[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="mb-4 flex items-center justify-between">
        <SectionTitle eyebrow="Pipeline" title="Stage-gated opportunity queue" subtitle="Lead → Qualified → IC Review → Shortlist → Won/Lost" />
        <Pill tone="success">Probability weighted</Pill>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-slate-400">
            <tr>
              <th className="pb-3">Opportunity</th>
              <th className="pb-3">Stage</th>
              <th className="pb-3">Score</th>
              <th className="pb-3">Value</th>
              <th className="pb-3">Weighted</th>
              <th className="pb-3">Queue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-slate-200">
            {opportunities.map((opportunity) => (
              <tr key={opportunity.id}>
                <td className="py-3">
                  <div className="font-medium text-white">{opportunity.name}</div>
                  <div className="text-xs text-slate-400">{opportunity.country} · {opportunity.sector}</div>
                </td>
                <td className="py-3">{opportunity.stage}</td>
                <td className="py-3">{opportunity.score}</td>
                <td className="py-3">${(opportunity.estimatedValueUsd / 1_000_000).toFixed(0)}m</td>
                <td className="py-3">${(probabilityWeightedValue(opportunity.estimatedValueUsd, opportunity.probability) / 1_000_000).toFixed(1)}m</td>
                <td className="py-3"><Pill tone={opportunity.triageQueue === 'Hot' ? 'success' : opportunity.triageQueue === 'Warm' ? 'warn' : 'default'}>{opportunity.triageQueue}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function IntakeFormPreview() {
  return (
    <Card>
      <SectionTitle eyebrow="Origination" title="Opportunity intake + triage" subtitle="Capture sponsor, geography, score criteria, relationship notes, and push into queues." />
      <form className="mt-6 grid gap-4 md:grid-cols-2">
        {['Opportunity name', 'Country', 'Sector', 'Sponsor', 'Sponsor type', 'Estimated value (USD)'].map((label) => (
          <label key={label} className="space-y-2 text-sm text-slate-300">
            <span>{label}</span>
            <input className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none ring-cyan-400 transition focus:ring-2" defaultValue={label === 'Opportunity name' ? 'Guinea Green Iron Platform' : ''} />
          </label>
        ))}
        <label className="space-y-2 text-sm text-slate-300 md:col-span-2">
          <span>Relationship notes</span>
          <textarea className="min-h-24 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none ring-cyan-400 transition focus:ring-2" defaultValue="CEO known through sovereign advisor; data room likely after NDA." />
        </label>
      </form>
      <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-400">
        <span>Weighted scoring engine</span>
        <span>•</span>
        <span>Queue routing</span>
        <span>•</span>
        <span>CRM sync hooks</span>
        <span>•</span>
        <span>Committee pack draft</span>
      </div>
    </Card>
  );
}

function CommitteePackPanel({ opportunity }: { opportunity: Opportunity }) {
  const hooks = getCrmSyncHooks(opportunity);
  return (
    <Card>
      <div className="mb-4 flex items-center gap-3">
        <FileText className="h-5 w-5 text-cyan-300" />
        <div>
          <h3 className="font-semibold text-white">IC pack generator</h3>
          <p className="text-sm text-slate-400">Auto-builds summary memo, stage gates, and relationship notes.</p>
        </div>
      </div>
      <pre className="max-h-80 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-300">{buildCommitteePack(opportunity)}</pre>
      <div className="mt-4 flex flex-wrap gap-2">
        {hooks.map((hook) => <Pill key={hook}>{hook}</Pill>)}
      </div>
    </Card>
  );
}

export function DealRadarDashboard() {
  const opportunities = opportunityStore.list();
  const totals = {
    total: opportunities.length,
    weighted: opportunities.reduce((sum, item) => sum + probabilityWeightedValue(item.estimatedValueUsd, item.probability), 0),
    watchlist: opportunities.filter((item) => item.watchlist).length,
    hot: opportunities.filter((item) => item.triageQueue === 'Hot').length,
  };

  const countryMap = aggregate(opportunities, (item) => item.country);
  const sectorMap = aggregate(opportunities, (item) => item.sector);
  const sponsorMap = aggregate(opportunities, (item) => item.sponsorType);

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-4">
        <div className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-4">
          <Activity className="h-5 w-5 text-cyan-300" />
          <MetricCard label="Live opportunities" value={String(totals.total)} helper="Tracked across active queues" />
        </div>
        <div className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-4">
          <Activity className="h-5 w-5 text-cyan-300" />
          <MetricCard label="Weighted pipeline" value={`$${(totals.weighted / 1_000_000).toFixed(1)}m`} helper="Probability-adjusted gross value" />
        </div>
        <div className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-4">
          <Activity className="h-5 w-5 text-cyan-300" />
          <MetricCard label="Watchlist coverage" value={String(totals.watchlist)} helper="Active targets under observation" />
        </div>
        <div className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-4">
          <Activity className="h-5 w-5 text-cyan-300" />
          <MetricCard label="Hot triage" value={String(totals.hot)} helper="Immediate origination follow-up" />
        </div>
      </section>

      <IntakeFormPreview />

      <section className="grid gap-4 xl:grid-cols-3">
        <HeatGrid title="Country heat map" data={countryMap} />
        <HeatGrid title="Sector heat map" data={sectorMap} />
        <HeatGrid title="Sponsor heat map" data={sponsorMap} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr,1fr]">
        <PipelineTable opportunities={opportunities} />
        <CommitteePackPanel opportunity={opportunities[0]} />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {[
          {
            icon: Building2,
            title: 'Target lists + watchlists',
            detail: 'Cluster by corridor, commodity, and sponsor profile to keep thematic coverage tight.',
          },
          {
            icon: Users2,
            title: 'Relationship notes',
            detail: 'Track sponsor interactions, gatekeepers, advisors, and follow-up commitments in-line.',
          },
          {
            icon: Signal,
            title: 'External signal ingestion',
            detail: 'Promote permits, newsflow, advisor chatter, and broker alerts directly into Lead stage.',
          },
          {
            icon: Globe2,
            title: 'Geo / sector filtering',
            detail: 'Search across country, sector, sponsor type, and stage for instant origination drill-downs.',
          },
        ].map(({ icon: Icon, title, detail }) => (
          <Card key={title}>
            <Icon className="mb-4 h-5 w-5 text-cyan-300" />
            <h3 className="font-semibold text-white">{title}</h3>
            <p className="mt-2 text-sm text-slate-400">{detail}</p>
          </Card>
        ))}
      </section>
    </div>
  );
}
