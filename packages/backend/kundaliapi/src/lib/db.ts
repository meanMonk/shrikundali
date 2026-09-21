import { getDb } from "./mongo.js";

export type DbInfo = {
  type: string;
  db: string;
  status: "ok" | "error";
  latencyMs?: number;
};

/** Mongo-only health ping. */
export async function ping(): Promise<DbInfo> {
  const db = process.env.DB_NAME ?? "app_kundaliapi";
  try {
    const mongo = await getDb();
    const start = Date.now();
    await mongo.command({ ping: 1 });
    return { type: "mongo", db, status: "ok", latencyMs: Date.now() - start };
  } catch {
    return { type: "mongo", db, status: "error" };
  }
}
