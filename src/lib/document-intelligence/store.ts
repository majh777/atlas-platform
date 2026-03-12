import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { seededDataset } from "@/lib/document-intelligence/seed";
import type { IntelligenceDataset } from "@/types/document-intelligence";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_PATH = path.join(DATA_DIR, "document-intelligence.json");

export async function readDataset(): Promise<IntelligenceDataset> {
  try {
    const contents = await readFile(DATA_PATH, "utf8");
    return JSON.parse(contents) as IntelligenceDataset;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("ENOENT")) {
      await writeDataset(seededDataset);
      return seededDataset;
    }
    throw error;
  }
}

export async function writeDataset(dataset: IntelligenceDataset) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_PATH, JSON.stringify(dataset, null, 2), "utf8");
}
