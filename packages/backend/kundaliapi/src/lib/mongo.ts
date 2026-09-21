import type { Db, MongoClient } from "mongodb";
import { logInfo } from "./logger.js";

let client: MongoClient | null = null;
let db: Db | null = null;

/** Shared Mongo connection. MONGODB_URI is the single required setting. */
export async function getDb(): Promise<Db> {
  if (db) return db;
  const uri = process.env.MONGODB_URI ?? "";
  if (!uri) throw new Error("MONGODB_URI is required");
  const { MongoClient } = await import("mongodb");
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(process.env.DB_NAME ?? "app_kundaliapi");
  logInfo("mongo: connected");
  return db;
}

export async function closeDb(): Promise<void> {
  if (!client) return;
  await client.close();
  client = null;
  db = null;
}
