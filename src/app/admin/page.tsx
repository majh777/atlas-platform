import { Card, SectionTitle } from '@/components/ui';

const stats = [
  { label: 'Organizations', value: '1', sub: 'Professional plan' },
  { label: 'Users', value: '3', sub: 'Active accounts' },
  { label: 'Workspaces', value: '2', sub: 'Across 1 org' },
  { label: 'Portfolios', value: '2', sub: 'In Africa Mining' },
  { label: 'Active Sessions', value: '--', sub: 'Real-time' },
  { label: 'Audit Events', value: '--', sub: 'Last 24h' },
];

export default function AdminDashboard() {
  return (
    <div className="space-y-8">
      <SectionTitle
        eyebrow="Module 1"
        title="Platform Administration"
        subtitle="Multi-tenant foundations, security, and governance."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <p className="text-xs uppercase tracking-widest text-slate-400">{s.label}</p>
            <p className="mt-1 text-3xl font-semibold text-white">{s.value}</p>
            <p className="text-xs text-slate-500">{s.sub}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-medium uppercase tracking-widest text-cyan-300">Quick Actions</h3>
          <ul className="space-y-2 text-sm text-slate-300">
            <li>POST /api/auth/register - Create account</li>
            <li>POST /api/auth/login - Sign in (supports MFA)</li>
            <li>POST /api/auth/mfa/enroll - Enable TOTP</li>
            <li>POST /api/orgs - Create organization</li>
            <li>GET /api/auth/sessions - List active sessions</li>
          </ul>
        </Card>
        <Card>
          <h3 className="mb-3 text-sm font-medium uppercase tracking-widest text-cyan-300">Architecture</h3>
          <ul className="space-y-2 text-sm text-slate-300">
            <li>Org &gt; Workspace &gt; Portfolio hierarchy</li>
            <li>JWT access (15m) + refresh (7d) tokens</li>
            <li>RBAC (5 org roles) + ABAC policies</li>
            <li>TOTP MFA + 10 recovery codes</li>
            <li>Central audit log with event bus</li>
            <li>SQLite now, PostgreSQL-ready schema</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
