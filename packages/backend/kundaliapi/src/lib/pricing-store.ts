import type { Collection } from "mongodb";
import { getDb } from "./mongo.js";
import { logInfo } from "./logger.js";
import { REPORT_PRICING, type ReportPricing } from "./pricing.js";
import { REPORT_LABELS, type ReportType } from "./store.js";

/**
 * Editable per-template pricing, stored in Mongo so prices can be changed
 * without a redeploy. The static REPORT_PRICING map remains the fallback and
 * the seed source.
 *
 * Mongo schema:
 *   pricing {
 *     reportType   : ReportType   unique template key
 *     title        : string       display name
 *     currency     : string       e.g. "INR"
 *     amount       : number       amount actually charged at checkout
 *     listPrice    : number       MRP shown struck-through
 *     discountPrice: number       displayed discounted price
 *     offerCode    : string?      coupon code (display / support)
 *     offerLabel   : string?      e.g. "Launch offer"
 *     offerPercent : number?      discount %, informational
 *     active       : boolean      false hides the template
 *     note         : string?      internal note (who/why changed)
 *     updatedAt    : Date
 *     updatedBy    : string?      admin/script id
 *   }
 */
export interface ReportPricingDoc {
  reportType: ReportType;
  title: string;
  currency: string;
  amount: number;
  listPrice: number;
  discountPrice: number;
  offerCode?: string;
  offerLabel?: string;
  offerPercent?: number;
  active: boolean;
  note?: string;
  updatedAt: Date;
  updatedBy?: string;
}

const REPORT_TYPES = Object.keys(REPORT_PRICING) as ReportType[];

/** Seed/fallback document for a report type, built from the static map. */
export function defaultPricingDoc(reportType: ReportType): ReportPricingDoc {
  const p = REPORT_PRICING[reportType] ?? REPORT_PRICING.financial_kundali;
  return {
    reportType,
    title: REPORT_LABELS[reportType] ?? reportType,
    currency: "INR",
    amount: p.amount,
    listPrice: p.listPrice,
    discountPrice: p.discountPrice,
    active: true,
    updatedAt: new Date(),
    updatedBy: "default",
  };
}

export function allDefaultPricingDocs(): ReportPricingDoc[] {
  return REPORT_TYPES.map(defaultPricingDoc);
}

let col: Collection<ReportPricingDoc> | null = null;

async function getCollection(): Promise<Collection<ReportPricingDoc>> {
  if (col) return col;
  const db = await getDb();
  const c = db.collection<ReportPricingDoc>("pricing");
  try {
    await c.createIndex({ reportType: 1 }, { unique: true });
    logInfo("pricing collection initialized");
  } catch (e) {
    logInfo(`pricing index creation skipped (${String(e)}) — check Mongo privileges`);
  }
  col = c;
  return col;
}

/* ── Short-lived read cache so checkout/config don't hit Mongo every request ── */

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { doc: ReportPricingDoc | null; at: number }>();

export function invalidatePricingCache(reportType?: ReportType): void {
  if (reportType) cache.delete(reportType);
  else cache.clear();
}

export async function getPricingDoc(reportType: ReportType): Promise<ReportPricingDoc | null> {
  const cached = cache.get(reportType);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.doc;
  const c = await getCollection();
  const doc = await c.findOne({ reportType });
  cache.set(reportType, { doc, at: Date.now() });
  return doc;
}

/** Effective pricing for a template: Mongo value wins, static map is fallback. */
export async function getEffectivePricing(reportType: ReportType): Promise<ReportPricing> {
  const doc = await getPricingDoc(reportType).catch(() => null);
  if (doc && doc.active !== false) {
    return { amount: doc.amount, listPrice: doc.listPrice, discountPrice: doc.discountPrice };
  }
  return REPORT_PRICING[reportType] ?? REPORT_PRICING.financial_kundali;
}

/** Amount to charge: per-type env override, then Mongo, then static default. */
export async function getReportAmount(reportType: ReportType): Promise<number> {
  const override = Number(process.env[`REPORT_PRICE_${reportType.toUpperCase()}`]);
  if (Number.isFinite(override) && override > 0) return override;
  return (await getEffectivePricing(reportType)).amount;
}

export async function getAllPricingDocs(): Promise<ReportPricingDoc[]> {
  const c = await getCollection();
  const docs = await c.find({}).toArray();
  const byType = new Map(docs.map((d) => [d.reportType, d]));
  // Always return every known template, falling back to the static defaults.
  return REPORT_TYPES.map((t) => {
    const existing = byType.get(t);
    return existing ? { ...defaultPricingDoc(t), ...existing } : defaultPricingDoc(t);
  });
}

export async function upsertPricingDoc(
  reportType: ReportType,
  patch: Partial<Omit<ReportPricingDoc, "reportType" | "updatedAt">>,
  updatedBy = "api",
): Promise<ReportPricingDoc> {
  const c = await getCollection();
  const base = defaultPricingDoc(reportType);
  const update = { ...patch, updatedAt: new Date(), updatedBy };
  await c.updateOne(
    { reportType },
    { $set: update, $setOnInsert: { reportType } },
    { upsert: true },
  );
  invalidatePricingCache(reportType);
  const saved = await c.findOne({ reportType });
  return saved ?? { ...base, ...update };
}

/** Insert defaults for any template missing from the collection. */
export async function seedPricingDocs(updatedBy = "seed"): Promise<number> {
  const c = await getCollection();
  let inserted = 0;
  for (const doc of allDefaultPricingDocs()) {
    const res = await c.updateOne(
      { reportType: doc.reportType },
      { $setOnInsert: { ...doc, updatedBy } },
      { upsert: true },
    );
    if (res.upsertedCount) inserted += 1;
  }
  invalidatePricingCache();
  return inserted;
}
