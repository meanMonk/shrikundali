import type { Collection } from "mongodb";
import { randomBytes } from "node:crypto";
import { getDb } from "./mongo.js";
import { logInfo } from "./logger.js";

/**
 * One-time report-correction tokens.
 *
 * Why this exists: the #1 refund trigger on ad traffic is "I entered the
 * wrong birth details". Instead of refunding a fully-delivered digital good,
 * each completed order gets a single-use link that lets the customer fix
 * their inputs and regenerate the PDF once, free. Single-use + 7-day expiry
 * keeps it from becoming an unlimited free-report endpoint.
 *
 * Mongo schema:
 *   regenerate_tokens {
 *     token      : string   one-time secret (in the URL)
 *     kundaliId  : string   kundali doc id (cacheId)
 *     orderId    : string   Razorpay/Cashfree order id
 *     email      : string   owner email (must match to redeem)
 *     reportType : string?
 *     used       : boolean
 *     createdAt, expiresAt : Date
 *     usedAt     : Date?
 *   }
 */
export interface RegenerateToken {
  token: string;
  kundaliId: string;
  orderId: string;
  email: string;
  reportType?: string;
  used: boolean;
  createdAt: Date;
  expiresAt: Date;
  usedAt?: Date;
}

/** Correction links stay valid for 7 days — same window as the download link. */
export const REGENERATE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

let col: Collection<RegenerateToken> | null = null;

async function getCollection(): Promise<Collection<RegenerateToken>> {
  if (col) return col;
  const db = await getDb();
  const c = db.collection<RegenerateToken>("regenerate_tokens");
  try {
    await Promise.all([
      c.createIndex({ token: 1 }, { unique: true }),
      c.createIndex({ orderId: 1 }),
      c.createIndex({ kundaliId: 1 }),
      c.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 }),
    ]);
    logInfo("regenerate_tokens collection initialized");
  } catch (e) {
    logInfo(`regenerate_tokens index creation skipped (${String(e)})`);
  }
  col = c;
  return col;
}

function newToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Issue a fresh one-time token for an order. Any previous *unused* tokens for
 * the same order are invalidated so there is ever at most one live link —
 * the "one-time URL" guarantee.
 */
export async function createRegenerateToken(args: {
  kundaliId: string;
  orderId: string;
  email: string;
  reportType?: string;
}): Promise<RegenerateToken> {
  const c = await getCollection();
  await c.updateMany(
    { orderId: args.orderId, used: false },
    { $set: { used: true, usedAt: new Date() } },
  );
  const doc: RegenerateToken = {
    token: newToken(),
    kundaliId: args.kundaliId,
    orderId: args.orderId,
    email: args.email,
    reportType: args.reportType,
    used: false,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + REGENERATE_TTL_MS),
  };
  await c.insertOne(doc);
  logInfo(`regenerate token issued for order ${args.orderId}`);
  return doc;
}

/** A token is redeemable when unused and unexpired. */
export async function getValidRegenerateToken(token: string): Promise<RegenerateToken | null> {
  const c = await getCollection();
  const doc = await c.findOne({ token });
  if (!doc || doc.used) return null;
  if (doc.expiresAt.getTime() < Date.now()) return null;
  return doc;
}

/**
 * Atomically consume a token (single-use). Returns the token doc when this
 * caller won the race, null when already used/expired/missing.
 */
export async function consumeRegenerateToken(token: string): Promise<RegenerateToken | null> {
  const c = await getCollection();
  return c.findOneAndUpdate(
    { token, used: false, expiresAt: { $gt: new Date() } },
    { $set: { used: true, usedAt: new Date() } },
    { returnDocument: "after" },
  );
}

/** Release a consumed token back (only used when regeneration itself failed). */
export async function releaseRegenerateToken(token: string): Promise<void> {
  const c = await getCollection();
  await c.updateOne({ token }, { $set: { used: false }, $unset: { usedAt: "" } });
}

/** Public frontend base for correction links — never the API host. */
export function regenerateUrlFor(token: string): string {
  const base = (process.env.WEB_URL ?? "https://rashikundali.com").replace(/\/$/, "");
  return `${base}/regenerate?token=${token}`;
}
