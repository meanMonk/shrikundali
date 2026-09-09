import { Hono } from "hono";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { createPaymentOrder, type PaymentProvider } from "../lib/payment.js";
import { getCachedChart } from "../lib/cache.js";
import { logGeneration, logError } from "../lib/logger.js";

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

export { checkoutApp };
