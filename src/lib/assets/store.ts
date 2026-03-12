import { promises as fs } from "node:fs";
import path from "node:path";
import { assetSeedData } from "@/lib/assets/demo-data";
import type { AssetDataset } from "@/types/assets";

const DATA_PATH = path.join(process.cwd(), "data", "asset-intelligence.json");

async function ensureStore() {
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  try {
    await fs.access(DATA_PATH);
  } catch {
    await fs.writeFile(DATA_PATH, JSON.stringify(assetSeedData, null, 2), "utf8");
  }
}

export async function readAssetDataset(): Promise<AssetDataset> {
  await ensureStore();
  const raw = await fs.readFile(DATA_PATH, "utf8");
  return JSON.parse(raw) as AssetDataset;
}

export async function writeAssetDataset(dataset: AssetDataset) {
  await ensureStore();
  await fs.writeFile(DATA_PATH, JSON.stringify(dataset, null, 2), "utf8");
}

export { DATA_PATH as ASSET_DATA_PATH };
