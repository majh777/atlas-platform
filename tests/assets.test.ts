import { beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { detectAnomalies, ingestConnectorPayload, refreshAssetIntelligence } from "@/lib/assets/engine";
import { assetSeedData } from "@/lib/assets/demo-data";
import { ASSET_DATA_PATH, readAssetDataset } from "@/lib/assets/store";
import { GET as assetsRoute } from "@/app/api/assets/route";
import { POST as telemetryRoute } from "@/app/api/telemetry/route";
import { POST as maintenanceRoute } from "@/app/api/maintenance/route";

function cloneSeed() {
  return JSON.parse(JSON.stringify(assetSeedData)) as typeof assetSeedData;
}

describe("asset intelligence module", () => {
  beforeEach(async () => {
    await fs.rm(ASSET_DATA_PATH, { force: true });
  });

  it("detects anomalies and predictive maintenance from baseline telemetry", () => {
    const dataset = cloneSeed();
    const anomalies = detectAnomalies(dataset);
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies.some((entry) => entry.metric === "vibration")).toBe(true);

    const refreshed = refreshAssetIntelligence(dataset);
    expect(refreshed.dataset.maintenance.length).toBeGreaterThan(0);
    expect(refreshed.dataset.alerts.some((alert) => alert.channel === "compliance")).toBe(true);
    expect(refreshed.analytics.some((entry) => entry.maintenanceRisk > 0.5)).toBe(true);
  });

  it("ingests telemetry through the connector framework", () => {
    const dataset = cloneSeed();
    const points = ingestConnectorPayload(dataset, {
      connectorId: "conn-haul-can",
      readings: [
        { metric: "utilization", value: 62, unit: "%" },
        { metric: "fuel_burn", value: 0.8, unit: "l/tonne" },
      ],
    });

    expect(points).toHaveLength(2);
    expect(points[0].assetId).toBe("asset-haul-01");
    expect(dataset.telemetry[0].connectorId).toBe("conn-haul-can");
  });

  it("serves asset snapshots and accepts telemetry + maintenance updates through APIs", async () => {
    const assetsResponse = await assetsRoute(new Request("http://localhost/api/assets?snapshot=true") as never);
    expect(assetsResponse.status).toBe(200);
    const assetsJson = await assetsResponse.json();
    expect(assetsJson.assets.length).toBeGreaterThan(0);
    expect(assetsJson.analytics.length).toBeGreaterThan(0);

    const telemetryResponse = await telemetryRoute(
      new Request("http://localhost/api/telemetry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          connectorId: "conn-crush-scada",
          readings: [
            { metric: "temperature", value: 101, unit: "c" },
            { metric: "vibration", value: 9.5, unit: "mm/s" },
          ],
        }),
      }) as never,
    );
    expect(telemetryResponse.status).toBe(201);
    const telemetryJson = await telemetryResponse.json();
    expect(telemetryJson.ingested).toHaveLength(2);
    expect(telemetryJson.alerts.length).toBeGreaterThan(0);

    const stored = await readAssetDataset();
    expect(stored.telemetry.some((point) => point.value === 101)).toBe(true);

    const taskId = telemetryJson.alerts.length ? (await assetsRoute(new Request("http://localhost/api/assets?snapshot=true") as never).then((res) => res.json())).maintenance[0].id : null;
    expect(taskId).toBeTruthy();

    const maintenanceResponse = await maintenanceRoute(
      new Request("http://localhost/api/maintenance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId, status: "scheduled" }),
      }) as never,
    );
    expect(maintenanceResponse.status).toBe(200);
    const maintenanceJson = await maintenanceResponse.json();
    expect(maintenanceJson.task.status).toBe("scheduled");
  });
});
