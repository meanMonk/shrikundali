import { Hono } from "hono";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { razorpayVerifyPayment, cashfreeVerifyPayment } from "../lib/payment.js";
import { getCachedChart, deleteCachedChart } from "../lib/cache.js";
import { renderPDF, renderMarkdown } from "../lib/render.js";
import { archiveRaw } from "../lib/archive.js";
import { logInfo, logError } from "../lib/logger.js";
import { sendReportEmail, sendPaymentFailureEmail } from "../lib/email.js";
import { notifyAdminSale } from "../lib/telegram.js";
import { createOrder, updateOrderPayment } from "../lib/orders.js";

const webhookApp = new OpenAPIHono();

const RazorpayWebhookSchema = z.object({
  event: z.string(),
  payload: z.object({
    payment: z.object({
      entity: z.object({
        id: z.string(),
        order_id: z.string(),
        status: z.string(),
        method: z.string().optional(),
        amount: z.number().optional(),
      }),
    }),
  }),
});

const CashfreeWebhookSchema = z.object({
  type: z.string(),
  data: z.object({
    order: z.object({
      order_id: z.string(),
      order_status: z.string(),
      cf_order_id: z.string().optional(),
    }),
    payment: z.object({
      cf_payment_id: z.string().optional(),
      payment_status: z.string(),
    }).optional(),
  }),
});

const razorpayRoute = createRoute({
  method: "post",
  path: "/razorpay",
  tags: ["Webhook"],
  summary: "Razorpay payment webhook",
  responses: {
    200: { description: "Webhook processed" },
  },
});

webhookApp.openapi(razorpayRoute, async (c) => {
  const endpoint = "/webhook/razorpay";
  try {
    const body = await c.req.json();
    const signature = c.req.header("x-razorpay-signature") ?? "";

    logInfo(`${endpoint} received: ${body.event}`);

    if (body.event === "payment.captured") {
      const payment = body.payload?.payment?.entity;
      if (!payment) {
        logError(endpoint, "No payment entity in payload");
        return c.json({ status: "ok" });
      }

      const verified = await razorpayVerifyPayment({
        provider: "razorpay",
        orderId: payment.order_id,
        paymentId: payment.id,
        signature,
      });

      if (!verified) {
        logError(endpoint, "Signature verification failed");
        return c.json({ status: "error", message: "Invalid signature" }, 400);
      }

      const parts = payment.order_id.split("_");
      const cacheId = parts[1] ?? "";
      const cached = await getCachedChart(cacheId).catch(() => null);

      await createOrder({
        orderId: payment.order_id,
        cacheId,
        email: cached?.email ?? "",
        name: cached?.label,
        reportType: cached?.label ?? "financial_kundali",
        amount: Number(parts[3]) || 199,
        currency: "INR",
        provider: "razorpay",
        paymentId: payment.id,
        status: "pending",
        createdAt: new Date(),
      }).catch(e => logError(`${endpoint}/createOrder`, e));

      await handleSuccessfulPayment(payment.order_id, "razorpay");
    }

    return c.json({ status: "ok" });
  } catch (e) {
    logError(endpoint, e);
    return c.json({ status: "error" }, 500);
  }
});

const cashfreeRoute = createRoute({
  method: "post",
  path: "/cashfree",
  tags: ["Webhook"],
  summary: "Cashfree payment webhook",
  responses: {
    200: { description: "Webhook processed" },
  },
});

webhookApp.openapi(cashfreeRoute, async (c) => {
  const endpoint = "/webhook/cashfree";
  try {
    const body = await c.req.json();

    logInfo(`${endpoint} received: ${body.type}`);

    if (body.type === "PAYMENT_SUCCESS_WEBHOOK") {
      const order = body.data?.order;
      const payment = body.data?.payment;

      if (order?.order_status === "PAID" && payment?.cf_payment_id) {
        const verified = await cashfreeVerifyPayment({
          provider: "cashfree",
          orderId: order.order_id,
          paymentId: payment.cf_payment_id,
          signature: "",
        });

        if (verified) {
          const parts = order.order_id.split("_");
          const cacheId = parts[1] ?? "";
          const cached = await getCachedChart(cacheId).catch(() => null);

          await createOrder({
            orderId: order.order_id,
            cacheId,
            email: cached?.email ?? "",
            name: cached?.label,
            reportType: cached?.label ?? "financial_kundali",
            amount: Number(parts[3]) || 199,
            currency: "INR",
            provider: "cashfree",
            paymentId: payment.cf_payment_id,
            status: "pending",
            createdAt: new Date(),
          }).catch(e => logError(`${endpoint}/createOrder`, e));

          await handleSuccessfulPayment(order.order_id, "cashfree");
        }
      }
    }

    return c.json({ status: "ok" });
  } catch (e) {
    logError(endpoint, e);
    return c.json({ status: "error" }, 500);
  }
});

async function handleSuccessfulPayment(orderId: string, provider: string): Promise<void> {
  const endpoint = `/webhook/${provider}`;
  try {
    const parts = orderId.split("_");
    const cacheId = parts[1];

    if (!cacheId) {
      logError(endpoint, `Cannot extract cacheId from orderId: ${orderId}`);
      return;
    }

    const cached = await getCachedChart(cacheId);
    if (!cached) {
      logError(endpoint, `Cache expired for ${cacheId}. Cannot generate PDF.`);
      return;
    }

    logInfo(`${endpoint} Generating PDF for cacheId: ${cacheId}`);

    const reportLabel = cached.label || "Financial Kundali";
    const pdf = await renderPDF(cached.parsed, reportLabel);
    const md = renderMarkdown(cached.parsed, reportLabel);

    const archive = await archiveRaw(
      "/kundali/pdf",
      { cacheId, orderId, provider },
      "pdf",
      cached.raw,
      pdf,
    );

    await archiveRaw(
      "/kundali/markdown",
      { cacheId, orderId, provider },
      "markdown",
      cached.raw,
      md,
    );

    logInfo(`${endpoint} PDF generated and archived: ${archive.id}`);

    const downloadUrl = `${process.env.APP_URL ?? "http://localhost:3400"}/download/${archive.id}/pdf`;

    await updateOrderPayment(orderId, orderId, "completed", archive.id, downloadUrl)
      .catch(e => logError(`${endpoint}/updateOrder`, e));

    // Fire-and-forget: email user
    const paymentAmount = Number(parts[3]) || 199;
    sendReportEmail(
      cached.email,
      cached.label || "",
      downloadUrl,
      reportLabel,
      paymentAmount,
      orderId,
    ).catch((e) => logError(`${endpoint}/email`, e));

    // Fire-and-forget: notify admin
    notifyAdminSale({
      name: cached.label || "",
      email: cached.email,
      reportType: reportLabel,
      amount: paymentAmount,
      paymentId: orderId,
      paymentProvider: provider,
      pdfGenerated: true,
      downloadUrl,
    }).catch((e) => logError(`${endpoint}/telegram`, e));

    await deleteCachedChart(cacheId);
  } catch (e) {
    logError(endpoint, e);
  }
}

export { webhookApp };
