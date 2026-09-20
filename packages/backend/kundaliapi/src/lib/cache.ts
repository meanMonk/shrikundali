import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { KundliData } from "./prokerala.js";

const CACHE_DIR = join(process.cwd(), "archive", "cache");

export interface BirthDetails {
  coordinates: string;
  datetime: string;
  ayanamsa?: number;
  la?: string;
  name?: string;
  gender?: string;
  place?: string;
}

export interface CachedChart {
  id: string;
  raw: Record<string, unknown>;
  parsed: KundliData;
  email: string;
  label?: string;
  birth?: BirthDetails;
  createdAt: string;
  expiresAt: string;
}

function randomId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function cacheChart(
  raw: Record<string, unknown>,
  parsed: KundliData,
  email: string,
  label?: string,
  ttlMinutes = 60,
  birth?: BirthDetails,
): Promise<string> {
  const id = randomId();
  const dir = join(CACHE_DIR, id);
  await mkdir(dir, { recursive: true });

  const now = new Date();
  const expires = new Date(now.getTime() + ttlMinutes * 60 * 1000);

  const entry: CachedChart = {
    id,
    raw,
    parsed,
    email,
    label,
    birth,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  };

  await writeFile(join(dir, "chart.json"), JSON.stringify(entry, null, 2));
  return id;
}

export async function getCachedChart(id: string): Promise<CachedChart | null> {
  try {
    const data = await readFile(join(CACHE_DIR, id, "chart.json"), "utf-8");
    const chart = JSON.parse(data) as CachedChart;

    if (new Date(chart.expiresAt) < new Date()) {
      return null;
    }

    return chart;
  } catch {
    return null;
  }
}

export async function deleteCachedChart(id: string): Promise<void> {
  try {
    const { rm } = await import("node:fs/promises");
    await rm(join(CACHE_DIR, id), { recursive: true, force: true });
  } catch {}
}
