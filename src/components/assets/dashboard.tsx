"use client";

import { useMemo, useState } from "react";

interface Props {
  snapshot: Awaited<ReturnType<typeof import("@/lib/assets/service").getAssetSnapshot>>;
}

function toneClass(value: string) {
  if (value.includes("critical") || value.includes("non_compliant") || value.includes("overdue")) return "text-rose-200 border-rose-500/30 bg-rose-500/10";
  if (value.includes("warning") || value.includes("watch") || value.includes("recommended")) return "text-amber-200 border-amber-500/30 bg-amber-500/10";
  return "text-emerald-200 border-emerald-500/30 bg-emerald-500/10";
}

export function AssetIntelligenceDashboard({ snapshot }: Props) {
  const [assets, setAssets] = useState(snapshot.assets);
  const [analytics, setAnalytics] = useState(snapshot.analytics);
  const [anomalies, setAnomalies] = useState(snapshot.anomalies);
  const [maintenance, setMaintenance] = useState(snapshot.maintenance);
  const [alerts, setAlerts] = useState(snapshot.alerts);
  const [telemetryText, setTelemetryText] = useState(JSON.stringify({
    connectorId: snapshot.connectors[0]?.id,
    readings: [
      { metric: "utilization", value: 63, unit: "%" },
      { metric: "fuel_burn", value: 0.78, unit: "l/tonne" },
      { metric: "vibration", value: 8.4, unit: "mm/s" }
    ]
  }, null, 2));
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const overview = useMemo(() => ({
    assets: assets.length,
    criticalAlerts: alerts.filter((item) => item.severity === "critical").length,
    predictedTasks: maintenance.length,
    anomalySignals: anomalies.length,
  }), [alerts, assets.length, maintenance.length, anomalies.length]);

  const rankedAssets = useMemo(() => {
    return [...assets]
      .map((asset) => ({
        asset,
        analytics: analytics.find((entry) => entry.assetId === asset.id),
      }))
      .sort((a, b) => (b.analytics?.maintenanceRisk ?? 0) - (a.analytics?.maintenanceRisk ?? 0));
  }, [analytics, assets]);

  async function ingestTelemetry() {
    setLoading(true);
    setStatusMessage(null);
    try {
      const payload = JSON.parse(telemetryText);
      const response = await fetch("/api/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Telemetry ingestion failed");

      const refresh = await fetch("/api/assets?snapshot=true");
      const snapshot = await refresh.json();
      setAssets(snapshot.assets);
      setAnalytics(snapshot.analytics);
      setAnomalies(snapshot.anomalies);
      setMaintenance(snapshot.maintenance);
      setAlerts(snapshot.alerts);
      setStatusMessage(`Ingested ${data.ingested.length} telemetry points and refreshed predictive models.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function updateTask(taskId: string, status: string) {
    const response = await fetch("/api/maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, status }),
    });
    const data = await response.json();
    if (!response.ok) {
      setStatusMessage(data.error ?? "Unable to update maintenance task");
      return;
    }

    setMaintenance((current) => current.map((task) => (task.id === taskId ? data.task : task)));
    setStatusMessage(`Maintenance task updated to ${data.task.status}.`);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-8 px-6 py-10 text-slate-100 lg:px-10">
      <section className="grid gap-4 rounded-3xl border border-slate-800 bg-slate-950/80 p-8 shadow-2xl shadow-cyan-950/20 lg:grid-cols-[1.7fr_1fr]">
        <div className="space-y-5">
          <span className="inline-flex rounded-full border border-cyan-400/40 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">Module 8 · Asset intelligence</span>
          <h1 className="text-4xl font-semibold tracking-tight text-white">Telemetry, anomaly detection, predictive maintenance, and commercial asset performance in one control room.</h1>
          <p className="max-w-3xl text-sm leading-7 text-slate-300">Atlas aggregates telemetry connectors, stores time-series measurements, detects abnormal operating conditions, recommends maintenance windows, monitors inspection readiness, and tracks fuel, energy, throughput, and revenue efficiency.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          {Object.entries(overview).map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</div>
              <div className="mt-2 text-3xl font-semibold text-white">{value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">Telemetry connector console</h2>
              <p className="text-sm text-slate-400">Simulate CAN bus, SCADA, ERP, or manual connector payloads to refresh signals and predictions.</p>
            </div>
            <button onClick={ingestTelemetry} disabled={loading} className="rounded-full bg-cyan-400 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-600">{loading ? "Ingesting…" : "Ingest telemetry"}</button>
          </div>
          <textarea value={telemetryText} onChange={(event) => setTelemetryText(event.target.value)} className="min-h-[260px] w-full rounded-2xl border border-slate-800 bg-slate-900/90 p-4 font-mono text-sm text-slate-100 outline-none" />
          {statusMessage ? <p className="mt-4 text-sm text-cyan-200">{statusMessage}</p> : null}
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
          <h2 className="text-xl font-semibold text-white">Alerting engine</h2>
          <p className="mt-2 text-sm text-slate-400">Operations, compliance, maintenance, and commercial exceptions surfaced from the orchestration layer.</p>
          <div className="mt-4 space-y-3">
            {alerts.map((alert) => (
              <article key={alert.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-white">{alert.title}</h3>
                    <p className="mt-2 text-sm text-slate-300">{alert.body}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${toneClass(`${alert.severity}`)}`}>{alert.channel} · {alert.severity}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.25fr_0.95fr]">
        <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
          <h2 className="text-xl font-semibold text-white">Utilization, efficiency, and revenue leaderboard</h2>
          <div className="mt-4 space-y-4">
            {rankedAssets.map(({ asset, analytics: metric }) => (
              <article key={asset.id} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{asset.name}</h3>
                    <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400">{asset.site} · {asset.category.replace(/_/g, " ")} · {asset.className}</div>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${toneClass(metric?.telemetryStatus ?? "nominal")}`}>{metric?.telemetryStatus ?? "nominal"}</span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    ["Utilization", `${metric?.utilizationPct ?? 0}%`],
                    ["Throughput/hour", `${(metric?.throughputPerHour ?? 0).toFixed(0)}`],
                    ["Fuel per unit", `${(metric?.fuelPerUnit ?? 0).toFixed(2)}`],
                    ["Energy per unit", `${(metric?.energyPerUnit ?? 0).toFixed(2)}`],
                    ["Revenue/hour", `$${(metric?.revenuePerHour ?? 0).toFixed(0)}`],
                    ["Inspection readiness", `${metric?.inspectionReadinessPct ?? 0}%`],
                    ["Anomalies", `${metric?.anomalyCount ?? 0}`],
                    ["Maintenance risk", `${Math.round((metric?.maintenanceRisk ?? 0) * 100)}%`],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</div>
                      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
            <h2 className="text-xl font-semibold text-white">Anomaly queue</h2>
            <div className="mt-4 space-y-3">
              {anomalies.map((anomaly) => (
                <article key={anomaly.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-white">{anomaly.metric.replace(/_/g, " ")}</h3>
                    <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${toneClass(anomaly.severity)}`}>{anomaly.severity}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{anomaly.detail}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
            <h2 className="text-xl font-semibold text-white">Predictive maintenance planner</h2>
            <div className="mt-4 space-y-3">
              {maintenance.map((task) => (
                <article key={task.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-white">{task.title}</h3>
                    <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${toneClass(task.status)}`}>{task.status}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{task.reason}</p>
                  <p className="mt-2 text-xs text-slate-500">Failure window ~{task.predictedFailureWindowDays} days · downtime {task.estimatedDowntimeHours}h</p>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => updateTask(task.id, "scheduled")} className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200">Schedule</button>
                    <button onClick={() => updateTask(task.id, "completed")} className="rounded-full bg-emerald-400 px-3 py-1 text-xs font-semibold text-slate-950">Complete</button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
