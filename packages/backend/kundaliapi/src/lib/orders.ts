import type { Collection } from "mongodb";
import { getDb } from "./mongo.js";
import { logInfo, logError } from "./logger.js";

export interface Order {
  _id?: string;
  orderId: string;
  cacheId: string;
  email: string;
  name?: string;
  reportType: string;
  amount: number;
  currency: string;
  provider: string;
  paymentId?: string;
  /**
   * pending    = order created at checkout, payment not yet confirmed
   * paid       = payment confirmed (webhook / client verify), report not yet ready
   * completed  = PDF generated and delivered
   * failed     = payment failed / abandoned
   * refunded   = refunded after completion
   */
  status: "pending" | "paid" | "completed" | "failed" | "refunded";
  archiveId?: string;
  downloadUrl?: string;
  attribution?: Record<string, string>;
  createdAt: Date;
  paidAt?: Date;
}

let col: Collection<Order> | null = null;

async function getCollection(): Promise<Collection<Order>> {
  if (col) return col;
  const db = await getDb();
  const c = db.collection<Order>("orders");
  await Promise.all([
    c.createIndex({ orderId: 1 }, { unique: true }),
    c.createIndex({ email: 1 }),
    c.createIndex({ createdAt: -1 }),
    c.createIndex({ status: 1 }),
  ]);
  col = c;
  logInfo("orders collection initialized");
  return col;
}

/** Create the order row at checkout time, status "pending". Safe to call more
 * than once for the same orderId — a duplicate insert is logged and ignored. */
export async function createOrder(order: Omit<Order, "_id">): Promise<void> {
  const col = await getCollection();
  try {
    await col.insertOne(order as Order);
    logInfo(`order created: ${order.orderId} (pending)`);
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code?: number }).code === 11000) {
      logInfo(`order ${order.orderId} already exists, skipping create`);
      return;
    }
    throw e;
  }
}

/** Payment confirmed (webhook or client verify) — report generation not started/finished yet. */
export async function markOrderPaid(
  orderId: string,
  paymentId: string,
  amount?: number,
): Promise<void> {
  const col = await getCollection();
  await col.updateOne(
    { orderId },
    { $set: { status: "paid", paymentId, paidAt: new Date(), ...(amount != null ? { amount } : {}) } },
  );
  logInfo(`order ${orderId} marked paid`);
}

/** Payment failed / abandoned. */
export async function markOrderFailed(orderId: string, reason?: string): Promise<void> {
  const col = await getCollection();
  await col.updateOne({ orderId }, { $set: { status: "failed" } });
  logInfo(`order ${orderId} marked failed${reason ? `: ${reason}` : ""}`);
}

/**
 * Report generated and delivered — the terminal success state. Upserts so an
 * order is never lost even if it somehow wasn't created at checkout time
 * (e.g. legacy rows from before this flow existed).
 */
export async function markOrderCompleted(
  orderId: string,
  archiveId: string,
  downloadUrl: string,
  fallback: Omit<Order, "_id" | "orderId" | "status" | "archiveId" | "downloadUrl">,
): Promise<void> {
  const col = await getCollection();
  await col.updateOne(
    { orderId },
    {
      $set: { status: "completed", archiveId, downloadUrl, paidAt: new Date() },
      $setOnInsert: { orderId, ...fallback },
    },
    { upsert: true },
  );
  logInfo(`order ${orderId} marked completed`);
}

export async function getOrderByOrderId(orderId: string): Promise<Order | null> {
  try {
    const col = await getCollection();
    return (await col.findOne({ orderId })) as Order | null;
  } catch (e) {
    logError("orders/get", e);
    return null;
  }
}

export async function getOrdersByDateRange(
  startDate: Date,
  endDate: Date,
  status: Order["status"] = "completed",
): Promise<Order[]> {
  const col = await getCollection();
  return col
    .find({ createdAt: { $gte: startDate, $lte: endDate }, status })
    .sort({ createdAt: -1 })
    .toArray();
}

export async function getAllTimeOrderStats() {
  return getOrderStats(new Date(0), new Date());
}

export async function getOrderStats(startDate: Date, endDate: Date) {
  const orders = await getOrdersByDateRange(startDate, endDate);

  const totalSales = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + o.amount, 0);

  const byReport: Record<string, { count: number; revenue: number }> = {};
  for (const o of orders) {
    const entry = byReport[o.reportType];
    if (entry) {
      entry.count++;
      entry.revenue += o.amount;
    } else {
      byReport[o.reportType] = { count: 1, revenue: o.amount };
    }
  }

  return { totalSales, totalRevenue, byReport, orders };
}

/**
 * Every order in the window broken down by status (pending/paid/completed/
 * failed/refunded), for the Telegram "success vs failed" report.
 */
export async function getOrderStatusBreakdown(startDate: Date, endDate: Date) {
  const col = await getCollection();
  const all = await col
    .find({ createdAt: { $gte: startDate, $lte: endDate } })
    .sort({ createdAt: -1 })
    .toArray();

  const byStatus: Record<string, { count: number; revenue: number }> = {};
  for (const o of all) {
    const entry = (byStatus[o.status] ??= { count: 0, revenue: 0 });
    entry.count++;
    if (o.status === "completed") entry.revenue += o.amount;
  }

  return { total: all.length, byStatus, orders: all };
}

/** Failed/abandoned orders in the window — for the Telegram "/failed" command. */
export async function getFailedOrders(startDate: Date, endDate: Date): Promise<Order[]> {
  return getOrdersByDateRange(startDate, endDate, "failed");
}
