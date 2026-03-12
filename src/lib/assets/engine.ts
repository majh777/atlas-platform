import { randomUUID } from "node:crypto";
import type {
  Alert,
  AlertSeverity,
  Anomaly,
  Asset,
  AssetAnalytics,
  AssetDataset,
  ComplianceRecord,
  MaintenanceTask,
  TelemetryConnector,
  TelemetryPoint,
  TelemetryStatus,
} from "@/types/assets";

const higherIsWorse = new Set(["fuel_burn", "energy_draw", "temperature", "vibration", "downtime_minutes"]);

function latestPoint(points: TelemetryPoint[], metric: TelemetryPoint["metric"]) {
  return points
    .filter((point) => point.metric === metric)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
}

function baselinePoint(points: TelemetryPoint[], metric: TelemetryPoint["metric"]) {
  return points.find((point) => point.metric === metric && point.tags.includes("baseline")) ?? latestPoint(points, metric);
}

function percentDelta(current: number, baseline: number) {
  if (baseline === 0) return current === 0 ? 0 : 1;
  return (current - baseline) / baseline;
}

function anomalySeverity(metric: TelemetryPoint["metric"], delta: number): AlertSeverity | null {
  const absolute = Math.abs(delta);
  const degraded = higherIsWorse.has(metric) ? delta > 0.15 : delta < -0.12;
  if (!degraded) return null;
  if (absolute > 0.28) return "critical";
  return "warning";
}

export interface ConnectorPayload {
  connectorId: string;
  timestamp?: string;
  readings: Array<{ metric: TelemetryPoint["metric"]; value: number; unit: string; quality?: number; tags?: string[] }>;
}

const connectorAdapters: Record<
  TelemetryConnector["type"],
  (connector: TelemetryConnector, payload: ConnectorPayload) => TelemetryPoint[]
> = {
  can_bus: (connector, payload) =>
    payload.readings.map((reading) => ({
      id: randomUUID(),
      assetId: connector.assetId,
      connectorId: connector.id,
      metric: reading.metric,
      timestamp: payload.timestamp ?? new Date().toISOString(),
      value: reading.value,
      unit: reading.unit,
      quality: reading.quality ?? 0.97,
      tags: ["connector:can_bus", ...(reading.tags ?? ["live"])],
    })),
  scada: (connector, payload) =>
    payload.readings.map((reading) => ({
      id: randomUUID(),
      assetId: connector.assetId,
      connectorId: connector.id,
      metric: reading.metric,
      timestamp: payload.timestamp ?? new Date().toISOString(),
      value: reading.value,
      unit: reading.unit,
      quality: reading.quality ?? 0.95,
      tags: ["connector:scada", ...(reading.tags ?? ["live"])],
    })),
  erp: (connector, payload) =>
    payload.readings.map((reading) => ({
      id: randomUUID(),
      assetId: connector.assetId,
      connectorId: connector.id,
      metric: reading.metric,
      timestamp: payload.timestamp ?? new Date().toISOString(),
      value: reading.value,
      unit: reading.unit,
      quality: reading.quality ?? 0.9,
      tags: ["connector:erp", ...(reading.tags ?? ["live"])],
    })),
  manual: (connector, payload) =>
    payload.readings.map((reading) => ({
      id: randomUUID(),
      assetId: connector.assetId,
      connectorId: connector.id,
      metric: reading.metric,
      timestamp: payload.timestamp ?? new Date().toISOString(),
      value: reading.value,
      unit: reading.unit,
      quality: reading.quality ?? 0.8,
      tags: ["connector:manual", ...(reading.tags ?? ["manual"])],
    })),
};

export function ingestConnectorPayload(dataset: AssetDataset, payload: ConnectorPayload) {
  const connector = dataset.connectors.find((entry) => entry.id === payload.connectorId);
  if (!connector) {
    throw new Error(`Connector ${payload.connectorId} not found`);
  }

  const adapter = connectorAdapters[connector.type];
  const points = adapter(connector, payload);
  connector.lastSyncAt = payload.timestamp ?? new Date().toISOString();
  connector.status = "online";
  dataset.telemetry.unshift(...points);
  dataset.telemetry = dataset.telemetry
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 500);

  return points;
}

export function deriveTelemetryStatus(asset: Asset, analytics: AssetAnalytics): TelemetryStatus {
  if (analytics.maintenanceRisk > 0.78 || analytics.complianceStatus === "non_compliant") return "critical";
  if (analytics.anomalyCount > 0 || analytics.utilizationPct < asset.utilizationTarget - 8) return "warning";
  return "nominal";
}

export function detectAnomalies(dataset: AssetDataset) {
  const anomalies: Anomaly[] = [];

  for (const asset of dataset.assets) {
    const points = dataset.telemetry.filter((point) => point.assetId === asset.id);
    for (const metric of ["utilization", "fuel_burn", "energy_draw", "temperature", "vibration", "throughput"] as const) {
      const current = latestPoint(points, metric);
      const baseline = baselinePoint(points, metric);
      if (!current || !baseline || current.id === baseline.id) continue;

      const delta = percentDelta(current.value, baseline.value);
      const severity = anomalySeverity(metric, delta);
      if (!severity) continue;

      anomalies.push({
        id: `${asset.id}-${metric}`,
        assetId: asset.id,
        metric,
        severity,
        title: `${asset.name} ${metric.replace(/_/g, " ")} deviation`,
        detail: `Current ${current.value}${current.unit} vs baseline ${baseline.value}${baseline.unit} (${(delta * 100).toFixed(1)}%).`,
        detectedAt: current.timestamp,
        score: Number(Math.min(Math.abs(delta) * 2.5, 1).toFixed(2)),
        currentValue: current.value,
        baseline: baseline.value,
      });
    }
  }

  return anomalies;
}

export function planMaintenance(dataset: AssetDataset, anomalies: Anomaly[]) {
  const tasks: MaintenanceTask[] = [];

  for (const asset of dataset.assets) {
    const assetAnomalies = anomalies.filter((entry) => entry.assetId === asset.id);
    const risk = predictMaintenanceRisk(asset, assetAnomalies);
    const hoursToService = asset.serviceIntervalHours - asset.runtimeHours;

    if (risk > 0.55 || hoursToService < 36) {
      tasks.push({
        id: `${asset.id}-maint-${Math.round(risk * 100)}`,
        assetId: asset.id,
        title: `${asset.name} predictive maintenance window`,
        reason:
          hoursToService < 36
            ? `Service interval due in ${Math.max(hoursToService, 0)} runtime hours.`
            : `${assetAnomalies.length} anomaly signals indicate rising failure likelihood.`,
        dueAt: new Date(Date.now() + Math.max(1, Math.round((1 - risk) * 6)) * 24 * 60 * 60 * 1000).toISOString(),
        predictedFailureWindowDays: Math.max(2, Math.round((1 - risk) * 14)),
        estimatedDowntimeHours: Number((3 + risk * 8).toFixed(1)),
        recommendedAction: assetAnomalies.some((entry) => entry.metric === "vibration")
          ? "Inspect bearings, lubrication loop, and drivetrain alignment."
          : assetAnomalies.some((entry) => entry.metric === "temperature")
            ? "Run thermal inspection and cooling circuit validation."
            : "Execute OEM preventive maintenance pack and reset condition baseline.",
        status: hoursToService < 12 ? "overdue" : "recommended",
        createdAt: new Date().toISOString(),
      });
    }
  }

  return tasks;
}

export function predictMaintenanceRisk(asset: Asset, anomalies: Anomaly[]) {
  const servicePressure = asset.runtimeHours / Math.max(asset.serviceIntervalHours, 1);
  const anomalyPressure = anomalies.reduce((sum, entry) => sum + entry.score, 0) / Math.max(anomalies.length || 1, 1);
  return Number(Math.min(0.45 * servicePressure + 0.55 * anomalyPressure, 0.99).toFixed(2));
}

export function evaluateCompliance(dataset: AssetDataset) {
  return dataset.compliance.map((record) => {
    const missingDocs = record.requiredDocuments.filter((doc) => !doc.present).length;
    const scorePenalty = record.lastInspectionScore < 80 ? 0.2 : record.lastInspectionScore < 90 ? 0.1 : 0;
    const readiness = Math.max(0, 1 - missingDocs * 0.2 - record.openFindings.length * 0.12 - scorePenalty);
    return {
      ...record,
      readinessPct: Math.round(readiness * 100),
    };
  });
}

export function buildAnalytics(dataset: AssetDataset, anomalies: Anomaly[]): AssetAnalytics[] {
  const complianceMap = new Map(dataset.compliance.map((record) => [record.assetId, record]));
  const complianceReadiness = new Map(evaluateCompliance(dataset).map((record) => [record.assetId, record.readinessPct]));

  return dataset.assets.map((asset) => {
    const points = dataset.telemetry.filter((point) => point.assetId === asset.id);
    const utilization = latestPoint(points, "utilization")?.value ?? 0;
    const fuel = latestPoint(points, "fuel_burn")?.value ?? 0;
    const energy = latestPoint(points, "energy_draw")?.value ?? 0;
    const throughput = latestPoint(points, "throughput")?.value ?? asset.throughputTarget;
    const revenue = latestPoint(points, "revenue")?.value ?? throughput * asset.commercialRatePerUnit;
    const assetAnomalies = anomalies.filter((entry) => entry.assetId === asset.id);

    return {
      assetId: asset.id,
      utilizationPct: utilization,
      fuelPerUnit: fuel,
      energyPerUnit: energy,
      throughputPerHour: throughput,
      revenuePerHour: revenue,
      maintenanceRisk: predictMaintenanceRisk(asset, assetAnomalies),
      anomalyCount: assetAnomalies.length,
      complianceStatus: complianceMap.get(asset.id)?.status ?? "ready",
      inspectionReadinessPct: complianceReadiness.get(asset.id) ?? 100,
    };
  });
}

export function buildAlerts(
  dataset: AssetDataset,
  anomalies: Anomaly[],
  maintenance: MaintenanceTask[],
  compliance: Array<ComplianceRecord & { readinessPct: number }>,
): Alert[] {
  const alerts: Alert[] = [];

  for (const anomaly of anomalies) {
    alerts.push({
      id: `alert-${anomaly.id}`,
      assetId: anomaly.assetId,
      severity: anomaly.severity,
      channel: "ops",
      title: anomaly.title,
      body: anomaly.detail,
      createdAt: anomaly.detectedAt,
    });
  }

  for (const task of maintenance) {
    alerts.push({
      id: `alert-${task.id}`,
      assetId: task.assetId,
      severity: task.status === "overdue" ? "critical" : "warning",
      channel: "maintenance",
      title: task.title,
      body: `${task.reason} ${task.recommendedAction}`,
      createdAt: task.createdAt,
    });
  }

  for (const record of compliance) {
    if (record.status === "ready") continue;
    alerts.push({
      id: `alert-compliance-${record.assetId}`,
      assetId: record.assetId,
      severity: record.status === "non_compliant" ? "critical" : "warning",
      channel: "compliance",
      title: `Inspection readiness ${record.status.replace("_", " ")}`,
      body: `${record.openFindings.length} finding(s), ${record.requiredDocuments.filter((item) => !item.present).length} missing document(s), readiness ${record.readinessPct}%.`,
      createdAt: new Date().toISOString(),
    });
  }

  const analytics = buildAnalytics(dataset, anomalies);
  for (const metric of analytics) {
    const asset = dataset.assets.find((item) => item.id === metric.assetId);
    if (!asset) continue;
    const rateGap = metric.revenuePerHour / Math.max(metric.throughputPerHour || 1, 1);
    if (metric.utilizationPct < asset.utilizationTarget - 10 || rateGap < asset.commercialRatePerUnit * 0.9) {
      alerts.push({
        id: `alert-commercial-${asset.id}`,
        assetId: asset.id,
        severity: metric.utilizationPct < asset.utilizationTarget - 15 ? "critical" : "warning",
        channel: "commercial",
        title: `${asset.name} commercial underperformance`,
        body: `Utilization ${metric.utilizationPct}% vs target ${asset.utilizationTarget}%; revenue/hour ${metric.revenuePerHour.toFixed(0)} vs expected ${(metric.throughputPerHour * asset.commercialRatePerUnit).toFixed(0)}.`,
        createdAt: new Date().toISOString(),
      });
    }
  }

  return alerts;
}

export function refreshAssetIntelligence(dataset: AssetDataset) {
  const anomalies = detectAnomalies(dataset);
  const maintenance = planMaintenance(dataset, anomalies);
  const compliance = evaluateCompliance(dataset);
  const alerts = buildAlerts(dataset, anomalies, maintenance, compliance);
  const analytics = buildAnalytics(dataset, anomalies).map((entry) => {
    const asset = dataset.assets.find((item) => item.id === entry.assetId)!;
    return {
      ...entry,
      telemetryStatus: deriveTelemetryStatus(asset, entry),
    };
  });

  dataset.anomalies = anomalies;
  dataset.maintenance = maintenance;
  dataset.alerts = alerts;

  return { dataset, analytics, compliance };
}
