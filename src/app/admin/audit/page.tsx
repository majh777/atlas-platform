'use client';

import { useState } from 'react';
import { Card, SectionTitle, Pill } from '@/components/ui';

interface AuditEntry {
  id: string;
  action: string;
  user_id: string | null;
  resource_type: string | null;
  resource_id: string | null;
  ip_address: string | null;
  created_at: string;
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [token, setToken] = useState('');
  const [orgId, setOrgId] = useState('');
  const [error, setError] = useState('');

  async function loadLogs() {
    if (!token || !orgId) { setError('Token and Org ID required'); return; }
    setError('');
    const res = await fetch(`/api/orgs/${orgId}/audit`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { setError(`Error ${res.status}`); return; }
    const json = await res.json();
    setLogs(json.data ?? []);
  }

  const toneFor = (action: string) => {
    if (action.includes('delete') || action.includes('revoke')) return 'danger' as const;
    if (action.includes('create') || action.includes('register')) return 'success' as const;
    if (action.includes('update') || action.includes('change')) return 'warn' as const;
    return 'default' as const;
  };

  return (
    <div className="space-y-6">
      <SectionTitle eyebrow="Admin" title="Audit Log" subtitle="Central audit trail for all CRUD, auth, and approval actions." />

      <div className="flex flex-wrap gap-3">
        <input placeholder="Access token" value={token} onChange={(e) => setToken(e.target.value)}
          className="flex-1 rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500" />
        <input placeholder="Org ID" value={orgId} onChange={(e) => setOrgId(e.target.value)}
          className="w-72 rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500" />
        <button onClick={loadLogs}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500">
          Load
        </button>
      </div>

      {error && <p className="text-sm text-rose-400">{error}</p>}

      {logs.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10 bg-slate-900/70">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400">Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400">Action</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400">Resource</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-white/3">
                  <td className="px-4 py-3 text-slate-400">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3"><Pill tone={toneFor(log.action)}>{log.action}</Pill></td>
                  <td className="px-4 py-3 text-slate-300">{log.resource_type ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{log.ip_address ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {logs.length === 0 && (
        <Card>
          <p className="text-sm text-slate-400">Enter credentials and org ID to view audit entries.</p>
        </Card>
      )}
    </div>
  );
}
