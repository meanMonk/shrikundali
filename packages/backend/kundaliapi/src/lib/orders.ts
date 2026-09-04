import { logInfo, logError } from "./logger.js";
import type { Collection, MongoClient } from "mongodb";

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
  createdAt: Date;
  paidAt?: Date;
}

let col: Collection<Order> | null = null;
let client: MongoClient | null = null;

async function getCollection(): Promise<Collection<Order>> {
  if (col) return col;

  const type = process.env.DB_TYPE ?? "none";
  if (type !== "mongo") {
    throw new Error("Orders require MongoDB (DB_TYPE=mongo)");
  }

  const { MongoClient } = await import("mongodb");
  client = new MongoClient(process.env.MONGODB_URI ?? "");
  const db = client.db(process.env.DB_NAME ?? "app_kundaliapi");
  col = db.collection<Order>("orders");

  await col.createIndex({ orderId: 1 }, { unique: true });
  await col.createIndex({ email: 1 });
  await col.createIndex({ createdAt: -1 });
  await col.createIndex({ status: 1 });

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
