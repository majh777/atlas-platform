import { Card, SectionTitle, Pill } from '@/components/ui';

const demoUsers = [
  { email: 'admin@atlas.dev', name: 'Alice Admin', role: 'owner', mfa: true },
  { email: 'analyst@atlas.dev', name: 'Bob Analyst', role: 'member', mfa: false },
  { email: 'viewer@atlas.dev', name: 'Carol Viewer', role: 'viewer', mfa: false },
];

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <SectionTitle eyebrow="Admin" title="Users" subtitle="User accounts and roles." />

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10 bg-slate-900/70">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400">User</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400">Org Role</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400">MFA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {demoUsers.map((u) => (
              <tr key={u.email} className="hover:bg-white/3">
                <td className="px-4 py-3 font-medium text-white">{u.name}</td>
                <td className="px-4 py-3 text-slate-300">{u.email}</td>
                <td className="px-4 py-3">
                  <Pill tone={u.role === 'owner' ? 'success' : u.role === 'member' ? 'warn' : 'default'}>
                    {u.role}
                  </Pill>
                </td>
                <td className="px-4 py-3">
                  <Pill tone={u.mfa ? 'success' : 'danger'}>{u.mfa ? 'Enabled' : 'Off'}</Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Card>
        <h3 className="mb-2 text-sm font-medium uppercase tracking-widest text-cyan-300">Demo Credentials</h3>
        <p className="text-sm text-slate-300">
          All demo accounts use password: <code className="rounded bg-slate-800 px-1.5 py-0.5 text-cyan-300">Atlas2026!</code>
        </p>
        <p className="mt-1 text-xs text-slate-500">Run <code>pnpm seed</code> to populate demo data.</p>
      </Card>
    </div>
  );
}
