import type { Collection } from "mongodb";
import { getDb } from "./mongo.js";
import { logInfo } from "./logger.js";

/**
 * Support tickets raised from the post-payment modal when something goes wrong
 * (report failed to generate, download didn't work, double payment). Stored so
 * ops can follow up, with enough context to find the original order + kundali.
 *
 * Mongo schema:
 *   support_tickets {
 *     id, reason, status: "open"|"resolved",
 *     orderId?, cacheId?, email?, name?, reportType?, amount?, paymentId?,
 *     orderStatus?, archiveId?, message?, clientIp?, userAgent?, createdAt
 *   }
 */
export const SUPPORT_REASONS = [
  "download_failed",
  "payment_no_report",
  "double_payment",
  "other",
] as const;

export type SupportReason = (typeof SUPPORT_REASONS)[number];
export type SupportStatus = "open" | "resolved";

export interface SupportTicket {
  id: string;
  reason: SupportReason;
  status: SupportStatus;
  orderId?: string;
  cacheId?: string;
  email?: string;
  name?: string;
  reportType?: string;
  amount?: number;
  paymentId?: string;
  orderStatus?: string;
  archiveId?: string;
  message?: string;
  clientIp?: string;
  userAgent?: string;
  createdAt: Date;
}

let col: Collection<SupportTicket> | null = null;

async function getCollection(): Promise<Collection<SupportTicket>> {
  if (col) return col;
  const db = await getDb();
  const c = db.collection<SupportTicket>("support_tickets");
  try {
    await Promise.all([
      c.createIndex({ id: 1 }, { unique: true }),
      c.createIndex({ createdAt: -1 }),
      c.createIndex({ status: 1 }),
      c.createIndex({ orderId: 1 }, { sparse: true }),
    ]);
  } catch (e) {
    logInfo(`support_tickets index creation skipped (${String(e)})`);
  }
  col = c;
  return col;
}

function newTicketId(): string {
  return "tkt_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export async function createSupportTicket(
  doc: Omit<SupportTicket, "id" | "createdAt" | "status">,
): Promise<SupportTicket> {
  const c = await getCollection();
  const ticket: SupportTicket = { id: newTicketId(), status: "open", createdAt: new Date(), ...doc };
  await c.insertOne(ticket);
  logInfo(`support ticket ${ticket.id} raised (${ticket.reason}) order=${ticket.orderId ?? "-"}`);
  return ticket;
}

export async function listSupportTickets(limit = 15): Promise<SupportTicket[]> {
  const c = await getCollection();
  return c.find({}).sort({ createdAt: -1 }).limit(limit).toArray();
}

export async function getSupportTicketStats(): Promise<{ total: number; open: number }> {
  const c = await getCollection();
  const [total, open] = await Promise.all([
    c.countDocuments({}),
    c.countDocuments({ status: "open" }),
  ]);
  return { total, open };
}
