import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AiModuleStore } from '@/lib/ai/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_PATH = path.join(DATA_DIR, 'ai-copilot.json');

const emptyStore: AiModuleStore = {
  usageEvents: [],
  guardrailEvents: [],
  evaluationRuns: [],
};

export async function readAiStore(): Promise<AiModuleStore> {
  try {
    const contents = await readFile(DATA_PATH, 'utf8');
    return JSON.parse(contents) as AiModuleStore;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Handle file not found or corrupted JSON (e.g., from concurrent writes)
    if (message.includes('ENOENT') || message.includes('JSON')) {
      // Initialize with empty store to recover from corruption
      try {
        await writeAiStore(emptyStore);
      } catch {
        // Ignore write errors during recovery
      }
      return emptyStore;
    }
    throw error;
  }
}

export async function writeAiStore(store: AiModuleStore) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_PATH, JSON.stringify(store, null, 2), 'utf8');
}
