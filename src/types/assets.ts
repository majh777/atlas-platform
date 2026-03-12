export type AssetCategory = "fleet" | "plant" | "fixed_infrastructure" | "energy";
export type ConnectorType = "can_bus" | "scada" | "erp" | "manual";
export type TelemetryMetric =
  | "utilization"
  | "fuel_burn"
  | "energy_draw"
  | "throughput"
  | "temperature"
  | "vibration"
  | "downtime_minutes"
  | "revenue"
  | "inspection_score";
export type TelemetryStatus = "nominal" | "warning" | "critical";
export type MaintenanceTaskStatus = "planned" | "recommended" | "scheduled" | "overdue" | "completed";
export type AlertSeverity = "info" | "warning" | "critical";
export type ComplianceStatus = "ready" | "watch" | "non_compliant";

export interface TelemetryPoint {
  id: string;
  assetId: string;
  connectorId: string;
  metric: TelemetryMetric;
  timestamp: string;
  value: number;
  unit: string;
  quality: number;
  tags: string[];
}

export interface TelemetryConnector {
  id: string;
  assetId: string;
  type: ConnectorType;
  label: string;
  status: "online" | "degraded" | "offline";
  pollingIntervalMinutes: number;
  lastSyncAt: string;
  mappedMetrics: TelemetryMetric[];
}

export interface Asset {
  id: string;
  name: string;
  site: string;
  category: AssetCategory;
  className: string;
  owner: string;
  status: "operational" | "maintenance" | "idle";
  utilizationTarget: number;
  fuelTargetPerUnit: number;
  energyTargetPerUnit: number;
  throughputTarget: number;
  inspectionDueAt: string;
  serviceIntervalHours: number;
  runtimeHours: number;
  commercialRatePerUnit: number;
  createdAt: string;
  updatedAt: string;
}

export interface Anomaly {
  id: string;
  assetId: string;
  metric: TelemetryMetric;
  severity: AlertSeverity;
  title: string;
  detail: string;
  detectedAt: string;
  score: number;
  currentValue: number;
  baseline: number;
}

export interface MaintenanceTask {
  id: string;
  assetId: string;
  title: string;
  reason: string;
  dueAt: string;
  predictedFailureWindowDays: number;
  estimatedDowntimeHours: number;
  recommendedAction: string;
  status: MaintenanceTaskStatus;
  createdAt: string;
}

export interface Alert {
  id: string;
  assetId: string;
  severity: AlertSeverity;
  channel: "ops" | "maintenance" | "compliance" | "commercial";
  title: string;
  body: string;
  createdAt: string;
}

export interface ComplianceRecord {
  assetId: string;
  status: ComplianceStatus;
  inspectionDueAt: string;
  lastInspectionScore: number;
  requiredDocuments: Array<{ name: string; present: boolean }>;
  openFindings: string[];
}

export interface AssetAnalytics {
  assetId: string;
  utilizationPct: number;
  fuelPerUnit: number;
  energyPerUnit: number;
  throughputPerHour: number;
  revenuePerHour: number;
  maintenanceRisk: number;
  anomalyCount: number;
  complianceStatus: ComplianceStatus;
  inspectionReadinessPct: number;
}

export interface AssetDataset {
  assets: Asset[];
  connectors: TelemetryConnector[];
  telemetry: TelemetryPoint[];
  anomalies: Anomaly[];
  maintenance: MaintenanceTask[];
  alerts: Alert[];
  compliance: ComplianceRecord[];
}
