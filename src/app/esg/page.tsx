import Link from 'next/link';
import { ESGDashboard } from '@/components/esg/dashboard';

export const dynamic = 'force-dynamic';

export default function ESGPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">Atlas ESG and regulatory controls</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Module 9 · ESG, Permitting, Community and Regulatory Controls</h1>
            <p className="mt-3 max-w-3xl text-sm text-slate-400">Permit registers, obligations, community workflows, ESG incidents, evidence bundles, and local-content / stakeholder metrics in one lender-grade operating surface.</p>
          </div>
          <Link href="/" className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200">Back to dashboard</Link>
        </div>
        <ESGDashboard />
      </div>
    </main>
  );
}
