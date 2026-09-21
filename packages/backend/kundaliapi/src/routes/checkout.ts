import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  createPaymentOrder,
  verifyPayment,
  getRazorpayOrder,
  cashfreeVerifyPayment,
  type PaymentProvider,
} from "../lib/payment.js";
import {
  getKundali,
  getKundaliByOrderId,
  updateKundali,
  markKundaliDownloadNotified,
} from "../lib/store.js";
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

    const doc = await getKundali(body.cacheId);
    if (!doc) {
      return c.json({ error: "Invalid cache ID. Please generate a new teaser." }, 400);
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
        reportType: doc.reportType,
      },
    });

    // Attach the order to the kundali doc so the webhook / verify step can
    // recover the chart and the real customer email without trusting the client.
    await updateKundali(body.cacheId, {
      orderId: order.orderId,
      provider: order.provider,
      amount: order.amount,
      email: body.email,
      name: body.name ?? doc.name,
      status: doc.status === "completed" ? "completed" : "ordered",
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
  const doc = await getKundaliByOrderId(orderId);
  if (!doc) return null;
  if (doc.archiveId && doc.downloadUrl) {
    return { archiveId: doc.archiveId, downloadUrl: doc.downloadUrl, alreadyGenerated: true };
  }

  let paid = false;
  let paymentId: string | undefined;
  if (doc.provider === "razorpay") {
    const order = await getRazorpayOrder(orderId);
    paid = order?.status === "paid";
    paymentId = order?.paymentId;
  } else if (doc.provider === "cashfree") {
    paid = await cashfreeVerifyPayment({ provider: "cashfree", orderId, paymentId: "", signature: "" });
  }

  if (!paid) return null;

  return generatePaidReport({
    orderId,
    provider: doc.provider ?? "razorpay",
    paymentId,
    cacheId: doc.id,
    email: doc.email,
    name: doc.name,
    amount: doc.amount,
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
      const doc = await getKundaliByOrderId(body.orderId);

      if (!doc) {
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
        } else if (!doc.archiveId) {
          return c.json({ error: "Payment is not verified yet. Please wait a moment." }, 400);
        }
      }

      const report = await generatePaidReport({
        orderId: body.orderId,
        provider: body.provider,
        paymentId: body.paymentId,
        cacheId: doc.id,
        email: doc.email,
        name: doc.name,
        amount: doc.amount,
      });

      if (!report) {
        return c.json({ error: "Report is being generated. Please retry in a moment." }, 400);
      }

      const updated = await getKundaliByOrderId(body.orderId);
      return c.json({
        success: true,
        orderId: body.orderId,
        archiveId: report.archiveId,
        downloadUrl: report.downloadUrl,
        email: updated?.email ?? doc.email,
        name: updated?.name ?? doc.name,
        amount: updated?.amount ?? doc.amount,
        reportLabel: updated?.reportLabel ?? doc.reportLabel ?? "Financial Kundali Report",
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
    let doc = await getKundaliByOrderId(orderId);
    if (!doc) return c.json({ error: "Unknown order" }, 404);

    // Self-heal a paid order whose report never got generated.
    if (!doc.archiveId) {
      await ensureReportGenerated(orderId).catch((e) => logError("/payment/order", e));
      doc = (await getKundaliByOrderId(orderId)) ?? doc;
    }

    return c.json({
      orderId,
      status: doc.archiveId ? "completed" : "processing",
      archiveId: doc.archiveId ?? null,
      downloadUrl: doc.downloadUrl ?? null,
      email: doc.email,
      name: doc.name ?? null,
      amount: doc.amount,
      reportLabel: doc.reportLabel ?? "Financial Kundali Report",
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
      let doc = await getKundaliByOrderId(orderId);

      if (!doc) {
        return c.json({ error: "Unknown order" }, 404);
      }

      // Self-heal: generate on demand if the order is paid but not yet rendered.
      if (!doc.archiveId) {
        await ensureReportGenerated(orderId).catch((e) => logError(endpoint, e));
        doc = (await getKundaliByOrderId(orderId)) ?? doc;
      }

      if (!doc.archiveId) {
        return c.json({ error: "Report not ready yet", status: "processing" }, 404);
      }

      const data = await readArchiveFile(doc.archiveId, "report.pdf");
      if (!data) {
        return c.json({ error: "Report file missing" }, 404);
      }

      // Notify admin once per kundali that the user actually downloaded.
      if (await markKundaliDownloadNotified(doc.id)) {
        notifyAdminDownload({
          name: doc.name,
          email: doc.email,
          reportType: doc.reportLabel ?? "Financial Kundali Report",
          paymentId: orderId,
          paymentProvider: doc.provider ?? "razorpay",
          archiveId: doc.archiveId,
        }).catch((e) => logError(`${endpoint}/telegram`, e));
      }

      logInfo(`${endpoint} serving ${doc.archiveId} for ${orderId}`);
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
