import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { logInfo, logError } from "../lib/logger.js";
import {
  allDefaultPricingDocs,
  getAllPricingDocs,
  getPricingDoc,
  seedPricingDocs,
  upsertPricingDoc,
} from "../lib/pricing-store.js";
import { REPORT_LABELS, type ReportType } from "../lib/store.js";

const pricingApp = new OpenAPIHono();

const KNOWN_TYPES = Object.keys(REPORT_LABELS) as ReportType[];

function isKnownType(t: string): t is ReportType {
  return (KNOWN_TYPES as string[]).includes(t);
}

/** Public shape: drop Mongo internals, serialize dates. */
function serialize(doc: object) {
  const { _id, ...rest } = doc as { _id?: unknown } & Record<string, unknown>;
  void _id;
  return {
    ...rest,
    updatedAt: (rest.updatedAt as Date | undefined)?.toISOString?.() ?? rest.updatedAt,
  };
}

/**
 * Admin guard for writes. Set ADMIN_TOKEN in the environment; when it is not
 * set the endpoints stay open (handy for local/ops scripts) and log a warning.
 */
function isAuthorized(token: string | undefined): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    logInfo("pricing write: ADMIN_TOKEN unset — allowing (set it to lock writes)");
    return true;
  }
  return token === expected;
}

const PricingDocSchema = z.object({
  reportType: z.string(),
  title: z.string(),
  currency: z.string(),
  amount: z.number(),
  listPrice: z.number(),
  discountPrice: z.number(),
  offerCode: z.string().optional(),
  offerLabel: z.string().optional(),
  offerPercent: z.number().optional(),
  active: z.boolean(),
  note: z.string().optional(),
  updatedAt: z.union([z.string(), z.date()]).optional(),
  updatedBy: z.string().optional(),
});

const PricingPatchSchema = z.object({
  title: z.string().optional(),
  currency: z.string().optional(),
  amount: z.number().positive().optional(),
  listPrice: z.number().nonnegative().optional(),
  discountPrice: z.number().nonnegative().optional(),
  offerCode: z.string().optional(),
  offerLabel: z.string().optional(),
  offerPercent: z.number().min(0).max(100).optional(),
  active: z.boolean().optional(),
  note: z.string().optional(),
});

/* ── GET all pricing ──────────────────────────────────────── */

pricingApp.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: ["Pricing"],
    summary: "List effective pricing for every report template",
    responses: { 200: { description: "Pricing docs" } },
  }),
  async (c) => {
    const docs = await getAllPricingDocs();
    return c.json(docs.map(serialize), 200);
  },
);

/* ── Seed defaults ────────────────────────────────────────── */

pricingApp.openapi(
  createRoute({
    method: "post",
    path: "/seed",
    tags: ["Pricing"],
    summary: "Insert default pricing for templates missing from the collection",
    responses: {
      200: { description: "Seed result" },
      401: { description: "Unauthorized" },
    },
  }),
  async (c) => {
    if (!isAuthorized(c.req.header("x-admin-token"))) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const inserted = await seedPricingDocs("api:seed");
    logInfo(`/api/pricing/seed inserted ${inserted}`);
    return c.json({ inserted, total: allDefaultPricingDocs().length }, 200);
  },
);

/* ── GET one template ─────────────────────────────────────── */

pricingApp.openapi(
  createRoute({
    method: "get",
    path: "/{reportType}",
    tags: ["Pricing"],
    summary: "Get effective pricing for one report template",
    request: { params: z.object({ reportType: z.string() }) },
    responses: {
      200: { description: "Pricing doc", content: { "application/json": { schema: PricingDocSchema } } },
      404: { description: "Unknown report type" },
    },
  }),
  async (c) => {
    const { reportType } = c.req.param();
    if (!isKnownType(reportType)) {
      return c.json({ error: `Unknown report type: ${reportType}` }, 404);
    }
    const doc = (await getPricingDoc(reportType)) ?? allDefaultPricingDocs().find((d) => d.reportType === reportType);
    if (!doc) return c.json({ error: "Not found" }, 404);
    return c.json(serialize(doc as unknown as Record<string, unknown>), 200);
  },
);

/* ── PUT (upsert) one template ────────────────────────────── */

pricingApp.openapi(
  createRoute({
    method: "put",
    path: "/{reportType}",
    tags: ["Pricing"],
    summary: "Create/update pricing for one report template (admin)",
    request: {
      params: z.object({ reportType: z.string() }),
      body: { content: { "application/json": { schema: PricingPatchSchema } } },
    },
    responses: {
      200: { description: "Updated pricing doc" },
      401: { description: "Unauthorized" },
      404: { description: "Unknown report type" },
    },
  }),
  async (c) => {
    const endpoint = "/api/pricing";
    try {
      if (!isAuthorized(c.req.header("x-admin-token"))) {
        return c.json({ error: "Unauthorized" }, 401);
      }
      const { reportType } = c.req.param();
      if (!isKnownType(reportType)) {
        return c.json({ error: `Unknown report type: ${reportType}` }, 404);
      }
      const patch = c.req.valid("json");
      const doc = await upsertPricingDoc(reportType, patch, "api");
      logInfo(`${endpoint} updated ${reportType} ${JSON.stringify(patch)}`);
      return c.json(serialize(doc as unknown as Record<string, unknown>), 200);
    } catch (e) {
      logError(endpoint, e);
      return c.json({ error: String(e) }, 500);
    }
  },
);

export { pricingApp, KNOWN_TYPES };
