import { AlertTriangle, FileCheck2, FileStack, Handshake, Siren, Users } from 'lucide-react';
import { Card, Pill, SectionTitle } from '@/components/ui';
import { initDb } from '@/lib/db';
import { getESGDashboard, getIncidentDashboard, getPermitDashboard } from '@/lib/esg/service';

function StatCard({ title, value, helper, tone = 'default', icon: Icon }: { title: string; value: string; helper: string; tone?: 'default' | 'success' | 'warn' | 'danger'; icon: typeof AlertTriangle }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">{title}</p>
          <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
          <p className="mt-2 text-sm text-slate-500">{helper}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <Icon className="h-5 w-5 text-cyan-300" />
        </div>
      </div>
      <div className="mt-4">
        <Pill tone={tone}>{tone === 'danger' ? 'Escalated' : tone === 'warn' ? 'Watchlist' : tone === 'success' ? 'Healthy' : 'Live'}</Pill>
      </div>
    </Card>
  );
}

function PermitTable() {
  const permitDashboard = getPermitDashboard();
  return (
    <Card className="overflow-hidden">
      <div className="mb-4 flex items-center justify-between gap-4">
        <SectionTitle eyebrow="Permitting" title="Permit register and expiry watch" subtitle="Track active licences, review cadence, and linked regulatory commitments." />
        <Pill tone={permitDashboard.alerts.expiredPermits > 0 ? 'danger' : permitDashboard.alerts.expiringPermits > 0 ? 'warn' : 'success'}>
          {permitDashboard.alerts.expiringPermits + permitDashboard.alerts.expiredPermits} alerts
        </Pill>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-slate-400">
            <tr>
              <th className="pb-3">Permit</th>
              <th className="pb-3">Authority</th>
              <th className="pb-3">Expiry</th>
              <th className="pb-3">Status</th>
              <th className="pb-3">Risk</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-slate-200">
            {permitDashboard.data.map((permit) => (
              <tr key={permit.id}>
                <td className="py-3">
                  <div className="font-medium text-white">{permit.title}</div>
                  <div className="text-xs text-slate-400">{permit.permit_number} · {permit.permit_type}</div>
                </td>
                <td className="py-3">{permit.authority}</td>
                <td className="py-3">{permit.expiry_date ?? 'Open-ended'}</td>
                <td className="py-3"><Pill tone={permit.status === 'expired' ? 'danger' : permit.status === 'expiring' ? 'warn' : 'success'}>{permit.status}</Pill></td>
                <td className="py-3"><Pill tone={permit.risk_level === 'critical' ? 'danger' : permit.risk_level === 'high' ? 'warn' : 'default'}>{permit.risk_level}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ObligationPanel() {
  const esg = getESGDashboard();
  return (
    <Card>
      <SectionTitle eyebrow="Obligations" title="Commitments and overdue actions" subtitle="Surface covenant-style ESG obligations before they become lender or regulator issues." />
      <div className="mt-6 space-y-3">
        {esg.obligations.data.slice(0, 5).map((obligation) => (
          <div key={obligation.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium text-white">{obligation.title}</div>
                <div className="mt-1 text-xs text-slate-400">{obligation.obligation_type} · due {obligation.due_date ?? 'TBD'}</div>
              </div>
              <Pill tone={obligation.status === 'overdue' ? 'danger' : obligation.status === 'completed' ? 'success' : 'warn'}>{obligation.status}</Pill>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CommunityPanel() {
  const esg = getESGDashboard();
  return (
    <Card>
      <SectionTitle eyebrow="Community" title="Issue, grievance, and action workflow" subtitle="Case-manage sensitive matters with escalation discipline and follow-up ownership." />
      <div className="mt-6 space-y-3">
        {esg.communityCases.data.slice(0, 4).map((communityCase) => (
          <div key={communityCase.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium text-white">{communityCase.summary}</div>
                <div className="mt-1 text-xs text-slate-400">{communityCase.stakeholder_name} · {communityCase.case_type} · {communityCase.location ?? 'Field'}</div>
              </div>
              <div className="flex gap-2">
                <Pill tone={communityCase.sensitivity === 'restricted' ? 'danger' : communityCase.sensitivity === 'sensitive' ? 'warn' : 'default'}>{communityCase.sensitivity}</Pill>
                <Pill tone={communityCase.status === 'escalated' ? 'danger' : communityCase.status === 'resolved' ? 'success' : 'warn'}>{communityCase.status}</Pill>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function IncidentAndReports() {
  const incidents = getIncidentDashboard();
  const esg = getESGDashboard();
  return (
    <section className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
      <Card>
        <SectionTitle eyebrow="Incidents" title="ESG incident recording and escalation" subtitle="Capture operational incidents with severity-based escalation and corrective action routing." />
        <div className="mt-6 space-y-3">
          {incidents.data.slice(0, 4).map((incident) => (
            <div key={incident.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-white">{incident.title}</div>
                  <div className="mt-1 text-xs text-slate-400">{incident.category} · {incident.reported_at.slice(0, 10)} · escalation {incident.escalation_level}</div>
                </div>
                <Pill tone={incident.severity === 'critical' ? 'danger' : incident.severity === 'high' ? 'warn' : 'default'}>{incident.severity}</Pill>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <SectionTitle eyebrow="Reporting" title="Regulatory packs and evidence bundles" subtitle="Template-based outputs with pack summaries and evidence packaging metadata." />
        <div className="mt-6 space-y-3">
          {esg.reportPacks.data.slice(0, 4).map((pack) => (
            <div key={pack.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-white">{pack.title}</div>
                  <div className="mt-1 text-xs text-slate-400">{pack.pack_type} · {pack.template_sections.length} sections</div>
                </div>
                <Pill tone={pack.status === 'submitted' ? 'success' : pack.status === 'ready' ? 'warn' : 'default'}>{pack.status}</Pill>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}

function MetricPanel() {
  const esg = getESGDashboard();
  const metricRows = Object.entries(esg.metrics.summary).slice(0, 6);
  return (
    <Card>
      <SectionTitle eyebrow="Metrics" title="Local-content and stakeholder engagement indicators" subtitle="Track workforce, supplier, and engagement metrics inside the same governance surface." />
      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {metricRows.map(([key, value]) => (
          <div key={key} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{key.replace(':', ' · ')}</div>
            <div className="mt-2 text-2xl font-semibold text-white">{Number(value).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function ESGDashboard() {
  initDb();
  const permits = getPermitDashboard();
  const esg = getESGDashboard();
  const incidents = getIncidentDashboard();

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Permit alerts" value={String(permits.alerts.expiringPermits + permits.alerts.expiredPermits)} helper="Expiring + expired licences under watch" tone={permits.alerts.expiredPermits > 0 ? 'danger' : permits.alerts.expiringPermits > 0 ? 'warn' : 'success'} icon={FileCheck2} />
        <StatCard title="Overdue obligations" value={String(esg.alerts.overdueObligations)} helper="Commitments breaching planned due dates" tone={esg.alerts.overdueObligations > 0 ? 'danger' : 'success'} icon={AlertTriangle} />
        <StatCard title="Sensitive community cases" value={String(esg.alerts.sensitiveCases)} helper="Sensitive or restricted matters requiring controlled handling" tone={esg.alerts.sensitiveCases > 0 ? 'warn' : 'success'} icon={Users} />
        <StatCard title="Critical incidents" value={String(incidents.alerts.criticalIncidents)} helper="High-severity events requiring executive or regulator escalation" tone={incidents.alerts.criticalIncidents > 0 ? 'danger' : 'success'} icon={Siren} />
      </section>

      <PermitTable />

      <section className="grid gap-4 lg:grid-cols-2">
        <ObligationPanel />
        <CommunityPanel />
      </section>

      <IncidentAndReports />

      <MetricPanel />

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { icon: FileStack, title: 'Evidence packaging', detail: 'Pack summaries expose evidence counts, supporting links, and board-ready / zip-ready packaging state.' },
          { icon: Handshake, title: 'Stakeholder engagement', detail: 'Engagement metrics sit alongside grievance cases so teams can see signal, response, and closure in one place.' },
          { icon: AlertTriangle, title: 'Action routing', detail: 'Permit expiry, overdue obligations, and escalated incidents all converge into action tracking and alert summaries.' },
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
