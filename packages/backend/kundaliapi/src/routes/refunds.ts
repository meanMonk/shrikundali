import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { createRazorpayRefund, getRazorpayPayment } from "../lib/payment.js";
import { getKundaliByOrderId } from "../lib/store.js";
import { getOrderByOrderId, markOrderRefunded } from "../lib/orders.js";
import { logInfo, logError } from "../lib/logger.js";

const refundsApp = new OpenAPIHono();

/**
 * Admin guard. Set ADMIN_TOKEN in the environment; when unset the endpoint
 * stays open for local/ops scripts (same convention as /api/pricing writes).
 */
function isAuthorized(token: string | undefined): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    logInfo("refund: ADMIN_TOKEN unset — allowing (set it to lock refunds)");
    return true;
  }
  return token === expected;
}

const RefundInput = z.object({
  orderId: z.string().describe("Razorpay/Cashfree order id to refund"),
  amount: z.number().positive().optional()
    .describe("Partial refund amount in INR — omit for a full refund"),
  reason: z.string().max(500).optional()
    .describe("Ops note: duplicate_charge | report_failed | goodwill | ..."),
});

refundsApp.openapi(
  createRoute({
    method: "post",
    path: "/refund",
    tags: ["Payment"],
    summary: "Issue a refund for a paid order (admin only)",
    request: { body: { content: { "application/json": { schema: RefundInput } } } },
    responses: {
      200: { description: "Refund issued" },
      400: { description: "Order not refundable" },
      401: { description: "Unauthorized" },
    },
  }),
  async (c) => {
    const endpoint = "/payment/refund";
    try {
      if (!isAuthorized(c.req.header("x-admin-token"))) {
        return c.json({ error: "Unauthorized" }, 401);
      }
      const { orderId, amount, reason } = c.req.valid("json");

      const doc = await getKundaliByOrderId(orderId);
      if (!doc) return c.json({ error: "Unknown order." }, 400);
      const order = await getOrderByOrderId(orderId);
      if (order?.status === "refunded") {
        return c.json({ error: "Order is already refunded." }, 400);
      }
      if (order && order.status !== "paid" && order.status !== "completed") {
        return c.json({ error: `Only paid/completed orders can be refunded (status: ${order.status}).` }, 400);
      }
      if (doc.provider && doc.provider !== "razorpay") {
        return c.json({ error: `Refunds for ${doc.provider} orders must be issued from the provider dashboard.` }, 400);
      }
      const paymentId = doc.paymentId;
      if (!paymentId) {
        return c.json({ error: "No captured payment on this order — nothing to refund." }, 400);
      }

      // Confirm the payment is captured before issuing the refund.
      const payment = await getRazorpayPayment(paymentId);
      if (!payment) return c.json({ error: "Could not verify the payment with Razorpay." }, 400);
      if (payment.status && payment.status !== "captured" && payment.status !== "refunded") {
        return c.json({ error: `Payment status is ${payment.status} — only captured payments can be refunded.` }, 400);
      }

      const refund = await createRazorpayRefund(paymentId, amount, {
        ...(reason ? { reason } : {}),
        order_id: orderId,
      });

      await markOrderRefunded(orderId, {
        refundId: refund.id,
        amount: refund.amount,
        reason,
      }).catch((e) => logError(endpoint, e));

      logInfo(`${endpoint} ${orderId} refunded (${refund.id})`);
      return c.json({
        ok: true,
        orderId,
        refundId: refund.id,
        amount: refund.amount,
        status: refund.status,
      }, 200);
    } catch (e) {
      logError(endpoint, e);
      return c.json({ error: String(e) }, 400);
    }
  },
);

export { refundsApp };
