import { getDb } from "./mongo.js";

/**
 * Ad-attribution reporting. Reads the `attribution` object persisted on the
 * `kundalis` (teaser/lead) and `orders` (conversion) collections by the
 * frontend `checkoutAttribution()` payload + backend IP/user-agent.
 */

export const ATTRIBUTION_FIELDS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
  "gbraid",
  "wbraid",
  "fbclid",
  "landing_page",
] as const;

export type AttributionField = (typeof ATTRIBUTION_FIELDS)[number];

export interface AttributionRow {
  /** utm_source / utm_campaign value, or "(direct)" when absent. */
  key: string;
  /** Teaser/form submissions (kundalis docs) in the window. */
  leads: number;
  /** Orders created at checkout. */
  orders: number;
  /** Orders that reached "completed" (paid + PDF delivered). */
  completed: number;
  /** Revenue from completed orders, in INR. */
  revenue: number;
}

function dateMatch(startDate?: Date, endDate?: Date): Record<string, unknown> {
  if (!startDate && !endDate) return {};
  const createdAt: Record<string, Date> = {};
  if (startDate) createdAt.$gte = startDate;
  if (endDate) createdAt.$lte = endDate;
  return { createdAt };
}

/**
 * Merge lead counts (kundalis) with order/conversion stats (orders) grouped by
 * one attribution field, sorted by conversions then orders then leads.
 */
export async function getAttributionBreakdown(
  field: AttributionField,
  startDate?: Date,
  endDate?: Date,
): Promise<AttributionRow[]> {
  if (!(ATTRIBUTION_FIELDS as readonly string[]).includes(field)) {
    throw new Error(`unsupported attribution field: ${field}`);
  }
  const db = await getDb();
  const path = `$attribution.${field}`;
  const match = dateMatch(startDate, endDate);

  const [leadsAgg, ordersAgg] = await Promise.all([
    db
      .collection("kundalis")
      .aggregate<{ _id: string | null; n: number }>([
        { $match: match },
        { $group: { _id: { $ifNull: [path, "(direct)"] }, n: { $sum: 1 } } },
      ])
      .toArray(),
    db
      .collection("orders")
      .aggregate<{ _id: string | null; orders: number; completed: number; revenue: number }>([
        { $match: match },
        {
          $group: {
            _id: { $ifNull: [path, "(direct)"] },
            orders: { $sum: 1 },
            completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
            revenue: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$amount", 0] } },
          },
        },
      ])
      .toArray(),
  ]);

  const map = new Map<string, AttributionRow>();
  const row = (k: string): AttributionRow => {
    let r = map.get(k);
    if (!r) {
      r = { key: k, leads: 0, orders: 0, completed: 0, revenue: 0 };
      map.set(k, r);
    }
    return r;
  };

  for (const r of leadsAgg) row(String(r._id ?? "(direct)")).leads += r.n;
  for (const r of ordersAgg) {
    const acc = row(String(r._id ?? "(direct)"));
    acc.orders += r.orders;
    acc.completed += r.completed;
    acc.revenue += r.revenue;
  }

  return [...map.values()].sort(
    (a, b) => b.completed - a.completed || b.orders - a.orders || b.leads - a.leads,
  );
}
