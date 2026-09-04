import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BASE = join(process.cwd(), "archive", "uploads");

function randomId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function archiveKundali(
  endpoint: string,
  payload: unknown,
  rawProkerala: Record<string, unknown>,
  transformed?: unknown,
): Promise<{ id: string; dir: string }> {
  const id = randomId();
  const dir = join(BASE, id);
  await mkdir(dir, { recursive: true });

  await Promise.all([
    writeFile(join(dir, "request.json"), JSON.stringify({ endpoint, payload }, null, 2)),
    writeFile(join(dir, "prokerala-raw.json"), JSON.stringify(rawProkerala, null, 2)),
    writeFile(join(dir, "response.json"), JSON.stringify(transformed ?? rawProkerala, null, 2)),
    writeFile(join(dir, "meta.json"), JSON.stringify({
      id,
      endpoint,
      timestamp: new Date().toISOString(),
      prokeralaKeys: Object.keys(rawProkerala),
    }, null, 2)),
  ]);

  return { id, dir };
}

export async function archiveRaw(
  endpoint: string,
  payload: unknown,
  format: string,
  rawProkerala: Record<string, unknown>,
  report: Buffer | string,
): Promise<{ id: string; dir: string }> {
  const id = randomId();
  const dir = join(BASE, id);
  await mkdir(dir, { recursive: true });

  const ext = format === "pdf" ? "pdf" : format === "markdown" ? "md" : "json";

  await Promise.all([
    writeFile(join(dir, "request.json"), JSON.stringify({ endpoint, payload }, null, 2)),
    writeFile(join(dir, "prokerala-raw.json"), JSON.stringify(rawProkerala, null, 2)),
    writeFile(join(dir, `report.${ext}`), report),
    writeFile(join(dir, "meta.json"), JSON.stringify({
      id,
      endpoint,
      format,
      timestamp: new Date().toISOString(),
      prokeralaKeys: Object.keys(rawProkerala),
    }, null, 2)),
  ]);

  return { id, dir };
}
