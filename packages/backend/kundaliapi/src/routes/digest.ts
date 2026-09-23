import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { buildFounderDigest, sendFounderDigest } from "../lib/digest.js";
import { logError } from "../lib/logger.js";

const digestApp = new OpenAPIHono();

/** Admin guard — when ADMIN_TOKEN is unset the endpoints stay open (ops convenience). */
function isAuthorized(token: string | undefined): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return true;
  return token === expected;
}

digestApp.openapi(
  createRoute({
    method: "get",
    path: "/preview",
    tags: ["Digest"],
    summary: "Preview the founder daily digest (no send)",
    responses: { 200: { description: "Digest text" }, 401: { description: "Unauthorized" } },
  }),
  async (c) => {
    if (!isAuthorized(c.req.header("x-admin-token"))) return c.json({ error: "Unauthorized" }, 401);
    const digest = await buildFounderDigest();
    return c.json({ subject: digest.subject, telegram: digest.telegram }, 200);
  },
);

digestApp.openapi(
  createRoute({
    method: "post",
    path: "/run",
    tags: ["Digest"],
    summary: "Send the founder daily digest now (Telegram + email)",
    responses: {
      200: { description: "Send result", content: { "application/json": { schema: z.object({ ok: z.boolean(), telegram: z.boolean(), email: z.boolean() }) } } },
      401: { description: "Unauthorized" },
    },
  }),
  async (c) => {
    if (!isAuthorized(c.req.header("x-admin-token"))) return c.json({ error: "Unauthorized" }, 401);
    try {
      const result = await sendFounderDigest();
      return c.json({ ok: result.telegram || result.email, ...result }, 200);
    } catch (e) {
      logError("/digest/run", e);
      return c.json({ ok: false, telegram: false, email: false }, 200);
    }
  },
);

export { digestApp };
