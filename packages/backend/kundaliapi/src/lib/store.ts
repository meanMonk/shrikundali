import type { Collection } from "mongodb";
import type { KundliData } from "./prokerala.js";
import { getDb } from "./mongo.js";
import { logInfo } from "./logger.js";

/**
 * One document per kundali, from free teaser through paid PDF.
 *
 * Mongo schema:
 *   kundalis {
 *     id            : string   unique public ref (teaser "cacheId")
 *     reportType    : "financial_kundali" | "match_kundali"
 *     reportLabel   : string
 *     email, name, gender, place : string?
 *     birth         : { coordinates, datetime, ayanamsa?, la?, name?, gender?, place? }
 *     raw           : object   raw ProKerala payload
 *     parsed        : object   transformed KundliData
 *     teaser        : object?  teaser payload returned to the client
 *     locked        : string[] locked sections
 *     status        : "teaser" | "ordered" | "paid" | "generating" | "completed"
 *     orderId, provider, paymentId, amount : payment info
 *     archiveId, downloadUrl : generated report
 *     purchaseNotified, downloadNotified, paymentNotified, failureNotified : boolean?
 *     generatingAt, createdAt, paidAt : Date
 *   }
 */
export type ReportType =
  | "financial_kundali"
  | "marriage_kundali"
  | "career_kundali"
  | "dosha_report"
  | "match_kundali"
  | "health_kundali";
export type KundaliStatus = "teaser" | "ordered" | "paid" | "generating" | "completed";

export interface BirthDetails {
  coordinates: string;
  datetime: string;
  ayanamsa?: number;
  la?: string;
  name?: string;
  gender?: string;
  place?: string;
}

export interface KundaliDoc {
  id: string;
  reportType: ReportType;
  reportLabel: string;
  email?: string;
  name?: string;
  gender?: string;
  place?: string;
  birth: BirthDetails;
  raw: Record<string, unknown>;
  parsed: KundliData;
  teaser?: Record<string, unknown>;
  locked?: string[];
  status: KundaliStatus;
  orderId?: string;
  provider?: string;
  paymentId?: string;
  amount?: number;
  archiveId?: string;
  downloadUrl?: string;
  purchaseNotified?: boolean;
  downloadNotified?: boolean;
  paymentNotified?: boolean;
  failureNotified?: boolean;
  conversionSent?: boolean;
  attribution?: Record<string, string>;
  partner?: { name?: string; gender?: string; birth?: BirthDetails };
  matching?: Record<string, unknown>;
  generatingAt?: Date;
  createdAt: Date;
  paidAt?: Date;
  autoResolveAttempted?: boolean;
  /** One-time correction flow: previous archive kept for audit, count + time. */
  previousArchiveId?: string;
  regenerationCount?: number;
  regeneratedAt?: Date;
}

export const REPORT_LABELS: Record<ReportType, string> = {
  financial_kundali: "Financial Kundali Report",
  marriage_kundali: "Marriage Kundali Report",
  career_kundali: "Career Kundali Report",
  dosha_report: "Dosha Report",
  match_kundali: "Match Kundali Report",
  health_kundali: "Health Kundali Report",
};

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

let col: Collection<KundaliDoc> | null = null;

async function getCollection(): Promise<Collection<KundaliDoc>> {
  if (col) return col;
  const db = await getDb();
  const c = db.collection<KundaliDoc>("kundalis");
  // Index creation is an optimization, not a correctness requirement. Some
  // deployments use a Mongo user without createIndexes privilege — don't let
  // that turn every request into a 400. Log and carry on.
  try {
    await Promise.all([
      c.createIndex({ id: 1 }, { unique: true }),
      c.createIndex({ orderId: 1 }, { sparse: true }),
      c.createIndex({ email: 1 }),
      c.createIndex({ archiveId: 1 }, { sparse: true }),
      c.createIndex({ status: 1 }),
      c.createIndex({ createdAt: -1 }),
    ]);
    logInfo("kundalis collection initialized");
  } catch (e) {
    logInfo(`kundalis index creation skipped (${String(e)}) — check Mongo privileges`);
  }
  col = c;
  return col;
}

export async function saveKundali(doc: KundaliDoc): Promise<void> {
  const c = await getCollection();
  await c.insertOne(doc);
}

export async function getKundali(id: string): Promise<KundaliDoc | null> {
  const c = await getCollection();
  return c.findOne({ id });
}

export async function getKundaliByOrderId(orderId: string): Promise<KundaliDoc | null> {
  const c = await getCollection();
  return c.findOne({ orderId });
}

export async function getKundaliByArchiveId(archiveId: string): Promise<KundaliDoc | null> {
  const c = await getCollection();
  return c.findOne({ archiveId });
}

export async function updateKundali(id: string, patch: Partial<KundaliDoc>): Promise<void> {
  const c = await getCollection();
  // `undefined` values become $unset so callers can clear a field
  // (e.g. the regenerate flow clears archiveId/downloadUrl before rebuilding).
  const set: Record<string, unknown> = {};
  const unset: Record<string, ""> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) unset[k] = "";
    else set[k] = v;
  }
  const update: Record<string, Record<string, unknown>> = {};
  if (Object.keys(set).length) update.$set = set;
  if (Object.keys(unset).length) update.$unset = unset;
  if (Object.keys(update).length) await c.updateOne({ id }, update);
}

export async function updateKundaliByOrderId(
  orderId: string,
  patch: Partial<KundaliDoc>,
): Promise<void> {
  const c = await getCollection();
  await c.updateOne({ orderId }, { $set: patch });
}

/**
 * Atomically claim a doc for report generation. Returns the claimed doc, or
 * null when another worker is already generating (a stale claim is reclaimed
 * after 5 minutes).
 */
export async function claimKundaliForReport(id: string): Promise<KundaliDoc | null> {
  const c = await getCollection();
  const claimed = await c.findOneAndUpdate(
    { id, status: { $in: ["teaser", "ordered", "paid"] } },
    { $set: { status: "generating", generatingAt: new Date() } },
    { returnDocument: "after" },
  );
  if (claimed) return claimed;
  return c.findOneAndUpdate(
    { id, status: "generating", generatingAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) } },
    { $set: { generatingAt: new Date() } },
    { returnDocument: "after" },
  );
}

export async function deleteKundali(id: string): Promise<void> {
  const c = await getCollection();
  await c.deleteOne({ id });
}

/* ── Lead / user stats for the admin bot ──────────────────── */

export interface LeadRow {
  id: string;
  name?: string;
  email?: string;
  place?: string;
  reportType: ReportType;
  status: KundaliStatus;
  createdAt: Date;
}

export interface LeadStats {
  /** Every kundali doc saved from a submitted form (teaser onwards). */
  total: number;
  /** Docs that carry an email address. */
  withEmail: number;
  /** Distinct, non-empty emails captured. */
  uniqueEmails: number;
  byStatus: Record<string, number>;
  byReportType: Record<string, number>;
}

function dateFilter(startDate?: Date, endDate?: Date): Record<string, unknown> {
  if (!startDate && !endDate) return {};
  const createdAt: Record<string, Date> = {};
  if (startDate) createdAt.$gte = startDate;
  if (endDate) createdAt.$lte = endDate;
  return { createdAt };
}

/** Counts of users who submitted their details, optionally within a window. */
export async function getKundaliStats(startDate?: Date, endDate?: Date): Promise<LeadStats> {
  const c = await getCollection();
  const filter = dateFilter(startDate, endDate);
  const emailFilter = { ...filter, email: { $exists: true, $nin: [""] } };

  const [total, withEmail, emails, byStatusAgg, byReportTypeAgg] = await Promise.all([
    c.countDocuments(filter),
    c.countDocuments(emailFilter),
    c.distinct("email", emailFilter),
    c.aggregate<{ _id: string; count: number }>([
      { $match: filter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]).toArray(),
    c.aggregate<{ _id: string; count: number }>([
      { $match: filter },
      { $group: { _id: "$reportType", count: { $sum: 1 } } },
    ]).toArray(),
  ]);

  const byStatus: Record<string, number> = {};
  for (const r of byStatusAgg) if (r._id) byStatus[r._id] = r.count;
  const byReportType: Record<string, number> = {};
  for (const r of byReportTypeAgg) if (r._id) byReportType[r._id] = r.count;

  return {
    total,
    withEmail,
    uniqueEmails: emails.filter((e) => typeof e === "string" && e.trim() !== "").length,
    byStatus,
    byReportType,
  };
}

/** Most recent submitted users, newest first. */
export async function listKundaliLeads(
  limit = 30,
  options: { onlyWithEmail?: boolean } = {},
): Promise<LeadRow[]> {
  const c = await getCollection();
  const filter = options.onlyWithEmail ? { email: { $exists: true, $nin: [""] } } : {};
  const docs = await c
    .find(filter, {
      projection: {
        id: 1,
        name: 1,
        email: 1,
        place: 1,
        reportType: 1,
        status: 1,
        createdAt: 1,
      },
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return docs as LeadRow[];
}

/**
 * Atomically mark the first download for a kundali. Returns true only for the
 * caller that flipped the flag, so the admin download alert fires exactly once.
 */
export async function markKundaliConversionSent(id: string): Promise<boolean> {
  const c = await getCollection();
  const res = await c.findOneAndUpdate(
    { id, conversionSent: { $ne: true } },
    { $set: { conversionSent: true } },
    { returnDocument: "after" },
  );
  return !!res;
}

export async function markKundaliDownloadNotified(id: string): Promise<boolean> {
  const c = await getCollection();
  const res = await c.findOneAndUpdate(
    { id, downloadNotified: { $ne: true } },
    { $set: { downloadNotified: true } },
    { returnDocument: "after" },
  );
  return !!res;
}

/** Atomically mark "payment confirmed" notified, so it fires exactly once per kundali. */
export async function markKundaliPaymentNotified(id: string): Promise<boolean> {
  const c = await getCollection();
  const res = await c.findOneAndUpdate(
    { id, paymentNotified: { $ne: true } },
    { $set: { paymentNotified: true } },
    { returnDocument: "after" },
  );
  return !!res;
}

/** Atomically mark "report generation failed" notified, so retries don't spam Telegram. */
export async function markKundaliFailureNotified(id: string): Promise<boolean> {
  const c = await getCollection();
  const res = await c.findOneAndUpdate(
    { id, failureNotified: { $ne: true } },
    { $set: { failureNotified: true } },
    { returnDocument: "after" },
  );
  return !!res;
}

/**
 * Kundalis stuck mid-generation: payment succeeded ("paid") or generation
 * started ("generating") more than `staleMinutes` ago but never reached
 * "completed". Surfaces PDF-generation failures (ProKerala quota, render
 * errors, crashed worker) that never get an explicit "failed" status.
 */
export async function getStuckKundalis(
  since: Date,
  staleMinutes = 10,
): Promise<KundaliDoc[]> {
  const c = await getCollection();
  const staleBefore = new Date(Date.now() - staleMinutes * 60 * 1000);
  return c
    .find({
      status: { $in: ["paid", "generating"] },
      createdAt: { $gte: since },
      $or: [
        { generatingAt: { $lt: staleBefore } },
        { generatingAt: { $exists: false }, createdAt: { $lt: staleBefore } },
      ],
    })
    .sort({ createdAt: -1 })
    .toArray();
}
