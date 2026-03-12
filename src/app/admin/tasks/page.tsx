'use client';

import { useState } from 'react';
import { Card, SectionTitle, Pill } from '@/components/ui';

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  assigned_to: string | null;
  due_date: string | null;
  created_at: string;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');

  async function loadTasks() {
    if (!token) { setError('Access token required'); return; }
    setError('');
    const res = await fetch('/api/tasks', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { setError(`Error ${res.status}`); return; }
    const json = await res.json();
    setTasks(json.data ?? []);
  }

  const priorityTone = (p: string) => {
    if (p === 'urgent') return 'danger' as const;
    if (p === 'high') return 'warn' as const;
    return 'default' as const;
  };

  const statusTone = (s: string) => {
    if (s === 'completed') return 'success' as const;
    if (s === 'in_progress') return 'warn' as const;
    if (s === 'cancelled') return 'danger' as const;
    return 'default' as const;
  };

  return (
    <div className="space-y-6">
      <SectionTitle eyebrow="Admin" title="Tasks" subtitle="Work management with event-driven notifications." />

      <div className="flex gap-3">
        <input placeholder="Access token" value={token} onChange={(e) => setToken(e.target.value)}
          className="flex-1 rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500" />
        <button onClick={loadTasks}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500">
          Load
        </button>
      </div>

      {error && <p className="text-sm text-rose-400">{error}</p>}

      <div className="grid gap-4">
        {tasks.map((t) => (
          <Card key={t.id}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-white">{t.title}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Pill tone={statusTone(t.status)}>{t.status}</Pill>
                  <Pill tone={priorityTone(t.priority)}>{t.priority}</Pill>
                </div>
              </div>
              {t.due_date && (
                <p className="text-xs text-slate-400">Due: {new Date(t.due_date).toLocaleDateString()}</p>
              )}
            </div>
          </Card>
        ))}
      </div>

      {tasks.length === 0 && (
        <Card>
          <p className="text-sm text-slate-400">Enter an access token to view tasks.</p>
        </Card>
      )}
    </div>
  );
}
