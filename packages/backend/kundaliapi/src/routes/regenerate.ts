import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { getKundli, getKundliMatching } from "../lib/prokerala.js";
import { buildTeaser } from "../lib/teaser.js";
import { generatePaidReport } from "../lib/report.js";
import {
  createRegenerateToken,
  getValidRegenerateToken,
  consumeRegenerateToken,
  releaseRegenerateToken,
  regenerateUrlFor,
} from "../lib/regenerate-tokens.js";
import { getKundali, getKundaliByOrderId, updateKundali, type BirthDetails } from "../lib/store.js";
import { getOrderByOrderId } from "../lib/orders.js";
import { sendRegenerateLinkEmail } from "../lib/email.js";
import { notifyAdminRegenerated } from "../lib/telegram.js";
import { logInfo, logError } from "../lib/logger.js";

const regenerateApp = new OpenAPIHono();

function emailsMatch(a?: string, b?: string): boolean {
  return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
}

function validCoordinates(v: string): boolean {
  const m = v.split(",").map((s) => Number(s.trim()));
  if (m.length !== 2 || m.some((n) => Number.isNaN(n))) return false;
  const lat = m[0] as number;
  const lon = m[1] as number;
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

/* ── Request a (re-)issued one-time link ──────────────────── */

const RequestInput = z.object({
  orderId: z.string().describe("Order ID from the success screen / email"),
  email: z.string().email().describe("Email used for the purchase"),
});

regenerateApp.openapi(
  createRoute({
    method: "post",
    path: "/request",
    tags: ["Regenerate"],
    summary: "Email a one-time correction link for a completed order",
    request: { body: { content: { "application/json": { schema: RequestInput } } } },
    responses: {
      200: { description: "Link sent (when the order is eligible)" },
      400: { description: "Unknown order / email mismatch / not eligible" },
    },
  }),
  async (c) => {
    const endpoint = "/regenerate/request";
    try {
      const { orderId, email } = c.req.valid("json");
      const doc = await getKundaliByOrderId(orderId);
      if (!doc) return c.json({ error: "Order not found. Check your order ID." }, 400);
      if (!emailsMatch(doc.email, email)) {
        return c.json({ error: "Order not found or email does not match." }, 400);
      }
      const order = await getOrderByOrderId(orderId);
      if (order?.status === "refunded") {
        return c.json({ error: "This order was refunded, so it can no longer be regenerated." }, 400);
      }
      if (!doc.archiveId || !doc.downloadUrl) {
        return c.json({ error: "Your report is still being prepared. Please try again in a moment." }, 400);
      }

      const token = await createRegenerateToken({
        kundaliId: doc.id,
        orderId,
        email: doc.email ?? email,
        reportType: doc.reportType,
      });
      const url = regenerateUrlFor(token.token);
      await sendRegenerateLinkEmail(
        doc.email ?? email,
        doc.name ?? "",
        url,
        doc.reportLabel ?? doc.reportType,
        token.expiresAt,
      ).catch((e) => logError(endpoint, e));

      logInfo(`${endpoint} link issued for ${orderId}`);
      return c.json({ ok: true }, 200);
    } catch (e) {
      logError(endpoint, e);
      return c.json({ error: String(e) }, 400);
    }
  },
);

/* ── Inspect a token (prefill the correction form) ────────── */

regenerateApp.openapi(
  createRoute({
    method: "get",
    path: "/{token}",
    tags: ["Regenerate"],
    summary: "Check a one-time correction token and get current details",
    request: { params: z.object({ token: z.string() }) },
    responses: {
      200: { description: "Token valid + current details" },
      404: { description: "Invalid, used or expired token" },
    },
  }),
  async (c) => {
    const token = c.req.param("token");
    const t = await getValidRegenerateToken(token);
    if (!t) return c.json({ error: "This link is invalid, already used, or expired." }, 404);
    const doc = await getKundali(t.kundaliId);
    if (!doc) return c.json({ error: "Report not found." }, 404);

    return c.json({
      orderId: t.orderId,
      reportType: doc.reportType,
      reportLabel: doc.reportLabel ?? doc.reportType,
      name: doc.name ?? "",
      gender: doc.gender ?? "",
      email: doc.email ?? t.email,
      birth: {
        datetime: doc.birth?.datetime ?? "",
        coordinates: doc.birth?.coordinates ?? "",
        place: doc.birth?.place ?? doc.place ?? "",
        la: doc.birth?.la ?? "en",
      },
      partner: doc.partner
        ? {
            name: doc.partner.name ?? "",
            birth: {
              datetime: doc.partner.birth?.datetime ?? "",
              coordinates: doc.partner.birth?.coordinates ?? "",
              place: doc.partner.birth?.place ?? "",
            },
          }
        : undefined,
      expiresAt: t.expiresAt,
    }, 200);
  },
);

/* ── Redeem: correct details + regenerate (single-use) ────── */

const RedeemInput = z.object({
  email: z.string().email().describe("Must match the purchase email"),
  name: z.string().min(1).max(120).optional(),
  gender: z.string().optional(),
  datetime: z.string().describe("ISO 8601 birth datetime with +05:30 offset"),
  coordinates: z.string().describe("lat,lon"),
  place: z.string().max(200).optional(),
  la: z.string().optional(),
  partner: z.object({
    name: z.string().optional(),
    gender: z.string().optional(),
    datetime: z.string(),
    coordinates: z.string(),
    place: z.string().optional(),
  }).optional(),
});

regenerateApp.openapi(
  createRoute({
    method: "post",
    path: "/{token}",
    tags: ["Regenerate"],
    summary: "Redeem a one-time correction token: fix inputs and regenerate the PDF",
    request: {
      params: z.object({ token: z.string() }),
      body: { content: { "application/json": { schema: RedeemInput } } },
    },
    responses: {
      200: { description: "Regenerated report" },
      400: { description: "Invalid token / bad inputs / generation failed" },
    },
  }),
  async (c) => {
    const endpoint = "/regenerate/redeem";
    const token = c.req.param("token");
    try {
      const body = c.req.valid("json");

      // Single-use claim first — the losers of a double-submit race get a 400.
      const t = await consumeRegenerateToken(token);
      if (!t) return c.json({ error: "This link is invalid, already used, or expired." }, 400);
      if (!emailsMatch(body.email, t.email)) {
        await releaseRegenerateToken(token);
        return c.json({ error: "Email does not match this order." }, 400);
      }
      if (!validCoordinates(body.coordinates)) {
        await releaseRegenerateToken(token);
        return c.json({ error: "Invalid birth coordinates." }, 400);
      }
      if (body.partner && !validCoordinates(body.partner.coordinates)) {
        await releaseRegenerateToken(token);
        return c.json({ error: "Invalid partner birth coordinates." }, 400);
      }

      const doc = await getKundali(t.kundaliId);
      if (!doc) return c.json({ error: "Report not found." }, 400);
      const order = await getOrderByOrderId(t.orderId);
      if (order?.status === "refunded") {
        return c.json({ error: "This order was refunded, so it can no longer be regenerated." }, 400);
      }

      // Re-run the astrology with the corrected inputs (same as /teaser).
      const birth: BirthDetails = {
        coordinates: body.coordinates,
        datetime: body.datetime,
        ayanamsa: doc.birth?.ayanamsa ?? 1,
        la: body.la ?? doc.birth?.la,
        name: body.name ?? doc.name,
        gender: body.gender ?? doc.gender,
        place: body.place ?? doc.place,
      };

      try {
        const isMatch = doc.reportType === "match_kundali";
        const { parsed, raw } = isMatch
          ? { parsed: doc.parsed, raw: doc.raw }
          : await getKundli({
              coordinates: birth.coordinates,
              datetime: birth.datetime,
              ayanamsa: birth.ayanamsa,
              la: birth.la,
            });

        let matching = doc.matching;
        if (isMatch && body.partner) {
          const nativeIsBoy = (body.gender ?? doc.gender ?? "").toLowerCase().startsWith("m");
          const girl = nativeIsBoy
            ? { datetime: body.partner.datetime, coordinates: body.partner.coordinates }
            : { datetime: birth.datetime, coordinates: birth.coordinates };
          const boy = nativeIsBoy
            ? { datetime: birth.datetime, coordinates: birth.coordinates }
            : { datetime: body.partner.datetime, coordinates: body.partner.coordinates };
          const m = await getKundliMatching({
            girlDob: girl.datetime,
            girlCoordinates: girl.coordinates,
            boyDob: boy.datetime,
            boyCoordinates: boy.coordinates,
            ayanamsa: birth.ayanamsa,
            la: birth.la,
          });
          matching = m.data as Record<string, unknown>;
        }

        const { teaser, locked } = buildTeaser(
          doc.reportType,
          parsed,
          body.name ?? doc.name ?? "Janam Kundali",
          birth,
        );

        // Swap in the corrected chart and reset to "paid" so the standard
        // paid-report pipeline (claim → render → archive → email) runs.
        // The old archive id is kept for audit; old PDF file stays on disk.
        await updateKundali(doc.id, {
          birth,
          raw: raw as Record<string, unknown>,
          parsed,
          teaser: teaser as unknown as Record<string, unknown>,
          locked,
          name: body.name ?? doc.name,
          gender: body.gender ?? doc.gender,
          place: body.place ?? doc.place,
          ...(isMatch && body.partner
            ? {
                partner: {
                  name: body.partner.name ?? doc.partner?.name,
                  gender: body.partner.gender ?? doc.partner?.gender,
                  birth: {
                    coordinates: body.partner.coordinates,
                    datetime: body.partner.datetime,
                    place: body.partner.place ?? doc.partner?.birth?.place,
                  },
                },
                matching,
              }
            : {}),
          previousArchiveId: doc.archiveId,
          archiveId: undefined,
          downloadUrl: undefined,
          status: "paid",
          regenerationCount: (doc.regenerationCount ?? 0) + 1,
          regeneratedAt: new Date(),
          downloadNotified: false,
          failureNotified: false,
        });
      } catch (e) {
        await releaseRegenerateToken(token);
        logError(endpoint, e);
        return c.json({ error: `Could not recalculate your chart: ${String(e)}` }, 400);
      }

      const result = await generatePaidReport({
        orderId: t.orderId,
        provider: doc.provider ?? "razorpay",
        paymentId: doc.paymentId,
        cacheId: doc.id,
        email: doc.email,
        name: body.name ?? doc.name,
        amount: doc.amount,
      });

      if (!result) {
        await releaseRegenerateToken(token);
        await updateKundali(doc.id, {
          archiveId: doc.archiveId,
          downloadUrl: doc.downloadUrl,
          status: "completed",
        }).catch(() => {});
        return c.json({ error: "Regeneration failed. Your link has been restored — please try again in a moment." }, 400);
      }

      notifyAdminRegenerated({
        name: body.name ?? doc.name,
        email: doc.email,
        reportType: doc.reportLabel ?? doc.reportType,
        orderId: t.orderId,
        archiveId: result.archiveId,
      }).catch((e) => logError(`${endpoint}/telegram`, e));

      logInfo(`${endpoint} done for ${t.orderId}: ${result.archiveId}`);
      return c.json({
        ok: true,
        orderId: t.orderId,
        archiveId: result.archiveId,
        downloadUrl: result.downloadUrl,
      }, 200);
    } catch (e) {
      logError(endpoint, e);
      return c.json({ error: String(e) }, 400);
    }
  },
);

export { regenerateApp };
