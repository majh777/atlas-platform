import { randomUUID } from "node:crypto";
import { ingestConnectorPayload, refreshAssetIntelligence, type ConnectorPayload } from "@/lib/assets/engine";
import { readAssetDataset, writeAssetDataset } from "@/lib/assets/store";
import type { Asset, MaintenanceTask } from "@/types/assets";

export async function getAssetSnapshot() {
  const dataset = await readAssetDataset();
  const refreshed = refreshAssetIntelligence(dataset);
  await writeAssetDataset(refreshed.dataset);

  return {
    assets: refreshed.dataset.assets,
    connectors: refreshed.dataset.connectors,
    analytics: refreshed.analytics,
    anomalies: refreshed.dataset.anomalies,
    maintenance: refreshed.dataset.maintenance,
    alerts: refreshed.dataset.alerts,
    compliance: refreshed.compliance,
  };
}

export async function listAssets(filters?: { site?: string; status?: string; category?: string }) {
  const snapshot = await getAssetSnapshot();
  return snapshot.assets.filter((asset) => {
    return (
      (!filters?.site || asset.site === filters.site) &&
      (!filters?.status || asset.status === filters.status) &&
      (!filters?.category || asset.category === filters.category)
    );
  });
}

export async function createAsset(input: Omit<Asset, "id" | "createdAt" | "updatedAt">) {
  const dataset = await readAssetDataset();
  const timestamp = new Date().toISOString();
  const asset: Asset = {
    ...input,
    id: randomUUID(),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  dataset.assets.unshift(asset);
  await writeAssetDataset(dataset);
  return asset;
}

export async function ingestTelemetry(payload: ConnectorPayload) {
  const dataset = await readAssetDataset();
  const points = ingestConnectorPayload(dataset, payload);
  const refreshed = refreshAssetIntelligence(dataset);
  await writeAssetDataset(refreshed.dataset);
  return {
    ingested: points,
    anomalies: refreshed.dataset.anomalies.filter((entry) => entry.assetId === points[0]?.assetId),
    analytics: refreshed.analytics.filter((entry) => entry.assetId === points[0]?.assetId),
    alerts: refreshed.dataset.alerts.filter((entry) => entry.assetId === points[0]?.assetId),
  };
}

export async function listTelemetry(assetId?: string) {
  const dataset = await readAssetDataset();
  return dataset.telemetry.filter((point) => !assetId || point.assetId === assetId);
}

export async function listMaintenance(status?: MaintenanceTask["status"]) {
  const snapshot = await getAssetSnapshot();
  return snapshot.maintenance.filter((task) => !status || task.status === status);
}

export async function updateMaintenanceTask(input: { taskId: string; status: MaintenanceTask["status"] }) {
  const dataset = await readAssetDataset();
  const task = dataset.maintenance.find((entry) => entry.id === input.taskId);
  if (!task) {
    throw new Error(`Maintenance task ${input.taskId} not found`);
  }

  task.status = input.status;
  await writeAssetDataset(dataset);
  return task;
}
