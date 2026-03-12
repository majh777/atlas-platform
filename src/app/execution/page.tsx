import Link from 'next/link';
import { ExecutionDashboard } from '@/components/execution/dashboard';
import { getExecutionTwin } from '@/lib/execution/service';

export default function ExecutionPage() {
  const twin = getExecutionTwin();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="px-6 py-6 lg:px-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">Atlas project controls</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Execution digital twin</h1>
          </div>
          <Link href="/" className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200">Back to dashboard</Link>
        </div>
      </div>
      <ExecutionDashboard initialTwin={twin} />
    </main>
  );
}
