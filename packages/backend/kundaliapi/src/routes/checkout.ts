import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  createPaymentOrder,
  verifyPayment,
  getRazorpayOrder,
  cashfreeVerifyPayment,
  type PaymentProvider,
} from "../lib/payment.js";
import { getCachedChart } from "../lib/cache.js";
import {
  getPendingPayment,
  savePendingPayment,
  updatePendingPayment,
} from "../lib/pending.js";
import { generatePaidReport } from "../lib/report.js";
import { readArchiveFile } from "../lib/archive.js";
import { notifyAdminDownload } from "../lib/telegram.js";
import { logGeneration, logInfo, logError } from "../lib/logger.js";

const checkoutApp = new OpenAPIHono();

// Must match config.ts DEFAULT_CONFIGS.financial_kundali.discountPrice
const REPORT_PRICE_INR = Number(process.env.REPORT_PRICE_INR) || 99;

const CheckoutInput = z.object({
  cacheId: z.string().describe("Cache ID from /teaser response"),
  provider: z.enum(["razorpay", "cashfree"]).default("razorpay"),
  email: z.string().email(),
  phone: z.string().optional(),
  name: z.string().optional(),
});

const CheckoutResponse = z.object({
  orderId: z.string(),
  provider: z.string(),
  amount: z.number(),
  currency: z.string(),
  key: z.string().describe("Public key for frontend SDK"),
  prefill: z.object({
    email: z.string(),
    name: z.string().optional(),
    contact: z.string().optional(),
  }),
});

const checkoutRoute = createRoute({
  method: "post",
  path: "/checkout",
  tags: ["Payment"],
  summary: "Create payment order for full report",
  request: { body: { content: { "application/json": { schema: CheckoutInput } } } },
  responses: {
    200: { description: "Payment order created", content: { "application/json": { schema: CheckoutResponse } } },
    400: { description: "Bad request or invalid cache", content: { "application/json": { schema: z.object({ error: z.string() }) } } },
  },
});

checkoutApp.openapi(checkoutRoute, async (c) => {
  const endpoint = "/payment/checkout";
  try {
    const body = c.req.valid("json");

    const cached = await getCachedChart(body.cacheId);
    if (!cached) {
      return c.json({ error: "Invalid or expired cache ID. Please generate a new teaser." }, 400);
    }

    const receipt = `kundali_${body.cacheId}_${Date.now()}`;

    const order = await createPaymentOrder({
      provider: body.provider as PaymentProvider,
      amount: REPORT_PRICE_INR,
      currency: "INR",
      receipt,
      customerEmail: body.email,
      customerPhone: body.phone,
      customerName: body.name,
      metadata: {
        cacheId: body.cacheId,
        reportType: "financial_kundali",
      },
    });

    // Remember the mapping so the webhook / verify step can recover the chart
    // and the real customer email, without trusting anything from the client.
    await savePendingPayment({
      orderId: order.orderId,
      cacheId: body.cacheId,
      email: body.email,
      name: body.name,
      amount: order.amount,
      provider: order.provider,
      reportLabel: cached.label,
      birth: cached.birth,
      createdAt: new Date().toISOString(),
    });

    logGeneration(endpoint, { ...body, orderId: order.orderId });

    const publicKey = body.provider === "razorpay"
      ? (process.env.RAZORPAY_KEY_ID ?? "")
      : (process.env.CASHFREE_APP_ID ?? "");

    return c.json({
      orderId: order.orderId,
      provider: order.provider,
      amount: order.amount,
      currency: order.currency,
      key: publicKey,
      prefill: {
        email: body.email,
        name: body.name,
        contact: body.phone,
      },
    }, 200);
  } catch (e) {
    logError(endpoint, e);
    return c.json({ error: String(e) }, 400);
  }
});

/* ── Self-heal helper ─────────────────────────────────────── */

/**
 * If an order is paid but its report was never generated (webhook not
 * configured, or a transient render failure), generate it now. Payment is
 * always re-confirmed against the provider before generating.
 */
async function ensureReportGenerated(orderId: string) {
  const pending = await getPendingPayment(orderId);
  if (!pending) return null;
  if (pending.archiveId && pending.downloadUrl) {
    return { archiveId: pending.archiveId, downloadUrl: pending.downloadUrl, alreadyGenerated: true };
  }

  let paid = false;
  let paymentId: string | undefined;
  if (pending.provider === "razorpay") {
    const order = await getRazorpayOrder(orderId);
    paid = order?.status === "paid";
    paymentId = order?.paymentId;
  } else if (pending.provider === "cashfree") {
    paid = await cashfreeVerifyPayment({ provider: "cashfree", orderId, paymentId: "", signature: "" });
  }

  if (!paid) return null;

  return generatePaidReport({
    orderId,
    provider: pending.provider,
    paymentId,
    cacheId: pending.cacheId,
    email: pending.email,
    name: pending.name,
    amount: pending.amount,
  });
}

/* ── Verify payment (client callback) ─────────────────────── */

const VerifyInput = z.object({
  orderId: z.string(),
  cacheId: z.string().optional(),
  provider: z.enum(["razorpay", "cashfree"]).default("razorpay"),
  paymentId: z.string().optional(),
  signature: z.string().optional(),
});

checkoutApp.openapi(
  createRoute({
    method: "post",
    path: "/verify",
    tags: ["Payment"],
    summary: "Verify a payment and generate the report",
    request: { body: { content: { "application/json": { schema: VerifyInput } } } },
    responses: {
      200: { description: "Report ready" },
      400: { description: "Verification or generation failed" },
    },
  }),
  async (c) => {
    const endpoint = "/payment/verify";
    try {
      const body = c.req.valid("json");
      const pending = await getPendingPayment(body.orderId);

      if (!pending) {
        return c.json({ error: "Unknown order. Please contact support." }, 400);
      }

      // When the signature is available (Razorpay client callback), verify it.
      // Otherwise only allow returning an already-generated report (webhook path).
      if (body.provider === "razorpay") {
        if (body.paymentId && body.signature) {
          const ok = await verifyPayment({
            provider: "razorpay",
            orderId: body.orderId,
            paymentId: body.paymentId,
            signature: body.signature,
          });
          if (!ok) {
            logError(endpoint, `Signature mismatch for ${body.orderId}`);
            return c.json({ error: "Payment signature verification failed." }, 400);
          }
        } else if (!pending.archiveId) {
          return c.json({ error: "Payment is not verified yet. Please wait a moment." }, 400);
        }
      }

      const report = await generatePaidReport({
        orderId: body.orderId,
        provider: body.provider,
        paymentId: body.paymentId,
        cacheId: pending.cacheId,
        email: pending.email,
        name: pending.name,
        amount: pending.amount,
      });

      if (!report) {
        return c.json({ error: "Report is being generated. Please retry in a moment." }, 400);
      }

      const updated = await getPendingPayment(body.orderId);
      return c.json({
        success: true,
        orderId: body.orderId,
        archiveId: report.archiveId,
        downloadUrl: report.downloadUrl,
        email: updated?.email ?? pending.email,
        name: updated?.name ?? pending.name,
        amount: updated?.amount ?? pending.amount,
        reportLabel: updated?.reportLabel ?? pending.reportLabel ?? "Financial Kundali",
      }, 200);
    } catch (e) {
      logError(endpoint, e);
      return c.json({ error: String(e) }, 400);
    }
  },
);

/* ── Order status (polling fallback) ──────────────────────── */

checkoutApp.openapi(
  createRoute({
    method: "get",
    path: "/order/{orderId}",
    tags: ["Payment"],
    summary: "Get order / report status",
    request: { params: z.object({ orderId: z.string() }) },
    responses: {
      200: { description: "Order status" },
      404: { description: "Unknown order" },
    },
  }),
  async (c) => {
    const orderId = c.req.param("orderId");
    let pending = await getPendingPayment(orderId);
    if (!pending) return c.json({ error: "Unknown order" }, 404);

    // Self-heal a paid order whose report never got generated.
    if (!pending.archiveId) {
      await ensureReportGenerated(orderId).catch((e) => logError("/payment/order", e));
      pending = (await getPendingPayment(orderId)) ?? pending;
    }

    return c.json({
      orderId,
      status: pending.archiveId ? "completed" : "processing",
      archiveId: pending.archiveId ?? null,
      downloadUrl: pending.downloadUrl ?? null,
      email: pending.email,
      name: pending.name ?? null,
      amount: pending.amount,
      reportLabel: pending.reportLabel ?? "Financial Kundali",
    }, 200);
  },
);

/* ── Direct download by order id ──────────────────────────── */

checkoutApp.openapi(
  createRoute({
    method: "get",
    path: "/download/{orderId}",
    tags: ["Payment"],
    summary: "Download generated report for an order (sends download notification)",
    request: { params: z.object({ orderId: z.string() }) },
    responses: {
      200: { description: "PDF file" },
      404: { description: "Not ready" },
    },
  }),
  async (c) => {
    const endpoint = "/payment/download";
    try {
      const orderId = c.req.param("orderId");
      let pending = await getPendingPayment(orderId);

      if (!pending) {
        return c.json({ error: "Unknown order" }, 404);
      }

      // Self-heal: generate on demand if the order is paid but not yet rendered.
      if (!pending.archiveId) {
        await ensureReportGenerated(orderId).catch((e) => logError(endpoint, e));
        pending = (await getPendingPayment(orderId)) ?? pending;
      }

      if (!pending.archiveId) {
        return c.json({ error: "Report not ready yet", status: "processing" }, 404);
      }

      const data = await readArchiveFile(pending.archiveId, "report.pdf");
      if (!data) {
        return c.json({ error: "Report file missing" }, 404);
      }

      // Notify admin once per order that the user actually downloaded.
      if (!pending.downloadNotified) {
        const marked = await updatePendingPayment(orderId, { downloadNotified: true });
        if (marked) {
          notifyAdminDownload({
            name: pending.name,
            email: pending.email,
            reportType: pending.reportLabel ?? "Financial Kundali",
            paymentId: orderId,
            paymentProvider: pending.provider,
            archiveId: pending.archiveId,
          }).catch((e) => logError(`${endpoint}/telegram`, e));
        }
      }

      logInfo(`${endpoint} serving ${pending.archiveId} for ${orderId}`);
      return new Response(new Uint8Array(data), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="kundali-report-${orderId}.pdf"`,
          "Cache-Control": "no-store",
        },
      });
    } catch (e) {
      logError(endpoint, e);
      return c.json({ error: String(e) }, 500);
    }
  },
);

export { checkoutApp };
