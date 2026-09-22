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
  paymentId: string;
  status: "pending" | "completed" | "failed" | "refunded";
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

export async function createOrder(order: Omit<Order, "_id">): Promise<string> {
  const col = await getCollection();
  const result = await col.insertOne(order as Order);
  logInfo(`order created: ${order.orderId}`);
  return result.insertedId.toString();
}

export async function updateOrderPayment(
  orderId: string,
  paymentId: string,
  status: "completed" | "failed",
  archiveId?: string,
  downloadUrl?: string,
): Promise<void> {
  const col = await getCollection();
  await col.updateOne(
    { orderId },
    {
      $set: {
        paymentId,
        status,
        archiveId,
        downloadUrl,
        paidAt: status === "completed" ? new Date() : undefined,
      },
    },
  );
  logInfo(`order ${orderId} updated: ${status}`);
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
): Promise<Order[]> {
  const col = await getCollection();
  return col
    .find({
      createdAt: { $gte: startDate, $lte: endDate },
      status: "completed",
    })
    .sort({ createdAt: -1 })
    .toArray();
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
