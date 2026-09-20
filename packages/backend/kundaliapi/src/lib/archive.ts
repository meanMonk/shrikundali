import { Client as MinioClient } from "minio";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { logInfo, logError } from "./logger.js";

const USE_MINIO = process.env.MINIO_ENDPOINT === "true";

const minio = USE_MINIO
  ? new MinioClient({
      endPoint: process.env.MINIO_HOST ?? "127.0.0.1",
      port: Number(process.env.MINIO_PORT ?? 9000),
      useSSL: process.env.MINIO_SSL === "true",
      accessKey: process.env.MINIO_ACCESS_KEY ?? "admin",
      secretKey: process.env.MINIO_SECRET_KEY ?? "minioadmin",
    })
  : null;

const BUCKET = process.env.MINIO_BUCKET ?? "shrikundali";
const LOCAL_BASE = join(process.cwd(), "archive", "uploads");

async function ensureBucket() {
  if (!minio) return;
  const exists = await minio.bucketExists(BUCKET).catch(() => false);
  if (!exists) {
    await minio.makeBucket(BUCKET, "us-east-1");
    logInfo(`archive: created MinIO bucket ${BUCKET}`);
  }
}

async function uploadToMinio(key: string, data: Buffer, contentType: string) {
  if (!minio) return;
  await ensureBucket();
  await minio.putObject(BUCKET, key, data, data.length, { "Content-Type": contentType });
}

async function downloadFromMinio(key: string): Promise<Buffer | null> {
  if (!minio) return null;
  try {
    const stream = await minio.getObject(BUCKET, key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
  } catch {
    return null;
  }
}

async function existsInMinio(key: string): Promise<boolean> {
  if (!minio) return false;
  try {
    await minio.statObject(BUCKET, key);
    return true;
  } catch {
    return false;
  }
}

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
  const dir = join(LOCAL_BASE, id);

  if (minio) {
    const files = [
      { name: "request.json", data: JSON.stringify({ endpoint, payload }, null, 2), type: "application/json" },
      { name: "prokerala-raw.json", data: JSON.stringify(rawProkerala, null, 2), type: "application/json" },
      { name: "response.json", data: JSON.stringify(transformed ?? rawProkerala, null, 2), type: "application/json" },
      { name: "meta.json", data: JSON.stringify({ id, endpoint, timestamp: new Date().toISOString(), prokeralaKeys: Object.keys(rawProkerala) }, null, 2), type: "application/json" },
    ];
    await Promise.all(files.map(f => uploadToMinio(`${id}/${f.name}`, Buffer.from(f.data), f.type)));
    logInfo(`archive: uploaded ${id} to MinIO`);
  } else {
    await mkdir(dir, { recursive: true });
    await Promise.all([
      writeFile(join(dir, "request.json"), JSON.stringify({ endpoint, payload }, null, 2)),
      writeFile(join(dir, "prokerala-raw.json"), JSON.stringify(rawProkerala, null, 2)),
      writeFile(join(dir, "response.json"), JSON.stringify(transformed ?? rawProkerala, null, 2)),
      writeFile(join(dir, "meta.json"), JSON.stringify({ id, endpoint, timestamp: new Date().toISOString(), prokeralaKeys: Object.keys(rawProkerala) }, null, 2)),
    ]);
  }

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
  const dir = join(LOCAL_BASE, id);
  const ext = format === "pdf" ? "pdf" : format === "markdown" ? "md" : "json";
  const reportBuf = Buffer.isBuffer(report) ? report : Buffer.from(report);
  const contentTypes: Record<string, string> = { pdf: "application/pdf", markdown: "text/markdown", json: "application/json" };

  if (minio) {
    const files = [
      { name: "request.json", data: JSON.stringify({ endpoint, payload }, null, 2), type: "application/json" },
      { name: "prokerala-raw.json", data: JSON.stringify(rawProkerala, null, 2), type: "application/json" },
      { name: `report.${ext}`, data: reportBuf, type: contentTypes[ext] ?? "application/octet-stream" },
      { name: "meta.json", data: JSON.stringify({ id, endpoint, format, timestamp: new Date().toISOString(), prokeralaKeys: Object.keys(rawProkerala) }, null, 2), type: "application/json" },
    ];
    await Promise.all(files.map(f => uploadToMinio(`${id}/${f.name}`, Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data), f.type)));
    logInfo(`archive: uploaded ${id}/${ext} to MinIO`);
  } else {
    await mkdir(dir, { recursive: true });
    await Promise.all([
      writeFile(join(dir, "request.json"), JSON.stringify({ endpoint, payload }, null, 2)),
      writeFile(join(dir, "prokerala-raw.json"), JSON.stringify(rawProkerala, null, 2)),
      writeFile(join(dir, `report.${ext}`), reportBuf),
      writeFile(join(dir, "meta.json"), JSON.stringify({ id, endpoint, format, timestamp: new Date().toISOString(), prokeralaKeys: Object.keys(rawProkerala) }, null, 2)),
    ]);
  }

  return { id, dir };
}

export async function addArchiveFile(
  archiveId: string,
  filename: string,
  data: Buffer | string,
  contentType = "application/octet-stream",
): Promise<void> {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  if (minio) {
    await uploadToMinio(`${archiveId}/${filename}`, buf, contentType);
    return;
  }
  const dir = join(LOCAL_BASE, archiveId);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, filename), buf);
}

export async function readArchiveFile(archiveId: string, filename: string): Promise<Buffer | null> {
  if (minio) {
    return downloadFromMinio(`${archiveId}/${filename}`);
  }
  try {
    const { readFile } = await import("node:fs/promises");
    return await readFile(join(LOCAL_BASE, archiveId, filename));
  } catch {
    return null;
  }
}

export async function archiveExists(archiveId: string): Promise<boolean> {
  if (minio) {
    return existsInMinio(`${archiveId}/meta.json`);
  }
  try {
    const { access } = await import("node:fs/promises");
    await access(join(LOCAL_BASE, archiveId));
    return true;
  } catch {
    return false;
  }
}

export async function listArchiveFiles(archiveId: string): Promise<string[]> {
  if (minio) {
    const objects: string[] = [];
    const stream = minio.listObjects(BUCKET, `${archiveId}/`, true);
    for await (const obj of stream) {
      if (obj.name) objects.push(obj.name.split("/").pop()!);
    }
    return objects;
  }
  try {
    const { readdir } = await import("node:fs/promises");
    return await readdir(join(LOCAL_BASE, archiveId));
  } catch {
    return [];
  }
}
