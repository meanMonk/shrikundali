import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { logError } from "./logger.js";
import type { BirthDetails } from "./cache.js";

const PENDING_DIR = join(process.cwd(), "archive", "pending");

export interface PendingPayment {
  orderId: string;
  cacheId: string;
  email: string;
  name?: string;
  gender?: string;
  amount: number;
  provider: string;
  reportLabel?: string;
  birth?: BirthDetails;
  createdAt: string;
  paidAt?: string;
  archiveId?: string;
  downloadUrl?: string;
  purchaseNotified?: boolean;
  downloadNotified?: boolean;
}

export async function savePendingPayment(data: PendingPayment): Promise<void> {
  try {
    await mkdir(PENDING_DIR, { recursive: true });
    await writeFile(
      join(PENDING_DIR, `${data.orderId}.json`),
      JSON.stringify(data, null, 2),
    );
  } catch (e) {
    logError("pending/save", e);
  }
}

export async function getPendingPayment(orderId: string): Promise<PendingPayment | null> {
  try {
    const raw = await readFile(join(PENDING_DIR, `${orderId}.json`), "utf-8");
    return JSON.parse(raw) as PendingPayment;
  } catch {
    return null;
  }
}

export async function updatePendingPayment(
  orderId: string,
  patch: Partial<PendingPayment>,
): Promise<PendingPayment | null> {
  const current = await getPendingPayment(orderId);
  if (!current) return null;
  const next: PendingPayment = { ...current, ...patch };
  await savePendingPayment(next);
  return next;
}

/**
 * Best-effort exclusive lock so concurrent triggers (client callback + webhook)
 * don't generate the same report twice. Returns false if already held.
 */
export async function acquireReportLock(orderId: string): Promise<boolean> {
  try {
    await mkdir(PENDING_DIR, { recursive: true });
    await writeFile(join(PENDING_DIR, `${orderId}.lock`), String(Date.now()), { flag: "wx" });
    return true;
  } catch {
    return false;
  }
}

export async function releaseReportLock(orderId: string): Promise<void> {
  try {
    const { rm } = await import("node:fs/promises");
    await rm(join(PENDING_DIR, `${orderId}.lock`), { force: true });
  } catch {}
}
