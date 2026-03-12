import Link from "next/link";
import { AssetIntelligenceDashboard } from "@/components/assets/dashboard";
import { getAssetSnapshot } from "@/lib/assets/service";

export default async function AssetsPage() {
  const snapshot = await getAssetSnapshot();

  return (
    <main className="min-h-screen bg-slate-950">
      <div className="px-6 pt-6 text-right lg:px-10">
        <Link href="/" className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200">Back to dashboard</Link>
      </div>
      <AssetIntelligenceDashboard snapshot={snapshot} />
    </main>
  );
}
