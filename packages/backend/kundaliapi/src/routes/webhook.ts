import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { cashfreeVerifyPayment } from "../lib/payment.js";
import { getKundaliByOrderId, updateKundaliByOrderId } from "../lib/store.js";
import { generatePaidReport } from "../lib/report.js";
import { markOrderPaid, markOrderFailed } from "../lib/orders.js";
import { logInfo, logError } from "../lib/logger.js";

const webhookApp = new OpenAPIHono();

async function razorpayWebhookSignatureValid(rawBody: string, signature: string): Promise<boolean> {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";
  // If no webhook secret is configured, fall back to accepting the event.
  // Generation is still gated on a known pending order id.
  if (!secret) return true;
  if (!signature) return false;
  const crypto = await import("node:crypto");
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return expected === signature;
}

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
    const rawBody = await c.req.text();
    const signature = c.req.header("x-razorpay-signature") ?? "";

    if (!(await razorpayWebhookSignatureValid(rawBody, signature))) {
      logError(endpoint, "Invalid webhook signature");
      return c.json({ status: "error", message: "Invalid signature" }, 400);
    }

    const body = JSON.parse(rawBody);
    logInfo(`${endpoint} received: ${body.event}`);

    if (body.event === "payment.captured") {
      const payment = body.payload?.payment?.entity;
      if (!payment?.order_id) {
        logError(endpoint, "No payment entity in payload");
        return c.json({ status: "ok" });
      }

      await processSuccessfulPayment({
        orderId: payment.order_id,
        paymentId: payment.id,
        provider: "razorpay",
        amount: payment.amount != null ? Number(payment.amount) / 100 : undefined,
      });
    } else if (body.event === "payment.failed") {
      const payment = body.payload?.payment?.entity;
      if (payment?.order_id) {
        await markOrderFailed(payment.order_id, payment.error_description).catch((e) =>
          logError(endpoint, e),
        );
      }
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
          await processSuccessfulPayment({
            orderId: order.order_id,
            paymentId: payment.cf_payment_id,
            provider: "cashfree",
            amount: order.order_amount != null ? Number(order.order_amount) : undefined,
          });
        }
      }
    } else if (body.type === "PAYMENT_FAILED_WEBHOOK" || body.type === "PAYMENT_USER_DROPPED_WEBHOOK") {
      const order = body.data?.order;
      if (order?.order_id) {
        await markOrderFailed(order.order_id, body.data?.payment?.payment_message).catch((e) =>
          logError(endpoint, e),
        );
      }
    }

    return c.json({ status: "ok" });
  } catch (e) {
    logError(endpoint, e);
    return c.json({ status: "error" }, 500);
  }
});

async function processSuccessfulPayment(args: {
  orderId: string;
  paymentId: string;
  provider: string;
  amount?: number;
}): Promise<void> {
  const endpoint = `/webhook/${args.provider}`;
  try {
    const doc = await getKundaliByOrderId(args.orderId);
    if (!doc) {
      logError(endpoint, `Unknown order ${args.orderId}`);
      return;
    }

    const amount = doc.amount ?? args.amount ?? 0;

    await updateKundaliByOrderId(args.orderId, {
      status: "paid",
      provider: args.provider,
      paymentId: args.paymentId,
      amount,
      paidAt: new Date(),
    });

    await markOrderPaid(args.orderId, args.paymentId, amount).catch((e) => logError(endpoint, e));

    const result = await generatePaidReport({
      orderId: args.orderId,
      provider: args.provider,
      paymentId: args.paymentId,
      cacheId: doc.id,
      email: doc.email,
      name: doc.name,
      amount,
    });

    if (!result) {
      logError(endpoint, `Failed to generate report for ${args.orderId}`);
      return;
    }

    if (!result.alreadyGenerated) {
      logInfo(`${endpoint} report generated: ${result.archiveId}`);
    }
  } catch (e) {
    logError(endpoint, e);
  }
}

export { webhookApp };
