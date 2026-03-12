'use client';

import { useState } from 'react';
import { Card, SectionTitle, Pill } from '@/components/ui';

interface Org {
  id: string;
  name: string;
  slug: string;
  plan: string;
  created_at: string;
}

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [token, setToken] = useState('');

  async function loadOrgs() {
    if (!token) { setError('Enter an access token first'); return; }
    setError('');
    const res = await fetch('/api/orgs', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { setError(`Error ${res.status}`); return; }
    const json = await res.json();
    setOrgs(json.data ?? []);
    setLoaded(true);
  }

  return (
    <div className="space-y-6">
      <SectionTitle eyebrow="Admin" title="Organizations" subtitle="Multi-tenant organization management." />

      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Access token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="flex-1 rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500"
        />
        <button
          onClick={loadOrgs}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
        >
          Load
        </button>
      </div>

      {error && <p className="text-sm text-rose-400">{error}</p>}

      {loaded && orgs.length === 0 && (
        <p className="text-sm text-slate-400">No organizations found.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {orgs.map((org) => (
          <Card key={org.id}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-white">{org.name}</p>
                <p className="text-xs text-slate-400">/{org.slug}</p>
              </div>
              <Pill tone={org.plan === 'enterprise' ? 'success' : org.plan === 'professional' ? 'warn' : 'default'}>
                {org.plan}
              </Pill>
            </div>
            <p className="mt-2 text-xs text-slate-500">Created: {new Date(org.created_at).toLocaleDateString()}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
