import { mkdir, writeFile, readdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";

const LOG_DIR = join(process.cwd(), "logs");
const MAX_LOG_FILES = 30;
const MAX_BYTES = 5 * 1024 * 1024; // 5MB per file

let initialized = false;

async function ensureDir() {
  if (!initialized) {
    await mkdir(LOG_DIR, { recursive: true });
    initialized = true;
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function logFile(name: string): string {
  return join(LOG_DIR, `${name}-${today()}.log`);
}

async function append(file: string, entry: string) {
  await ensureDir();
  try {
    const s = await stat(file).catch(() => null);
    if (s && s.size > MAX_BYTES) {
      const ts = Date.now();
      await writeFile(file.replace(".log", `-${ts}.log`), "");
    }
  } catch { /* ignore */ }
  await writeFile(file, entry + "\n", { flag: "a" });
}

export async function rotateLogs() {
  await ensureDir();
  const files = await readdir(LOG_DIR);
  const logFiles = files.filter((f) => f.endsWith(".log")).sort();
  if (logFiles.length > MAX_LOG_FILES) {
    const toDelete = logFiles.slice(0, logFiles.length - MAX_LOG_FILES);
    for (const f of toDelete) await unlink(join(LOG_DIR, f)).catch(() => {});
  }
}

export function logGeneration(endpoint: string, payload: unknown) {
  const ts = new Date().toISOString();
  const entry = `[${ts}] ${endpoint}\n${JSON.stringify(payload, null, 2)}`;
  append(logFile("requests"), entry);
  console.log(`\x1b[36m[REQUEST]\x1b[0m ${endpoint}`, JSON.stringify(payload));
}

export function logResponse(endpoint: string, response: unknown) {
  const ts = new Date().toISOString();
  const entry = `[${ts}] ${endpoint}\n${JSON.stringify(response, null, 2)}`;
  append(logFile("responses"), entry);
  console.log(`\x1b[32m[RESPONSE]\x1b[0m ${endpoint}`, JSON.stringify(response).slice(0, 500));
}

export function logError(endpoint: string, error: unknown) {
  const ts = new Date().toISOString();
  const entry = `[${ts}] ${endpoint}\n${String(error)}`;
  append(logFile("errors"), entry);
  console.error(`\x1b[31m[ERROR]\x1b[0m ${endpoint}`, error);
}

export function logInfo(msg: string) {
  const ts = new Date().toISOString();
  append(logFile("info"), `[${ts}] ${msg}`);
  console.log(`\x1b[33m[INFO]\x1b[0m ${msg}`);
}
