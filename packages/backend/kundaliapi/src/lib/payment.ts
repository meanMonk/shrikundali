import { logInfo, logError } from "./logger.js";

export type PaymentProvider = "razorpay" | "cashfree";

export interface CreateOrderParams {
  provider: PaymentProvider;
  amount: number;
  currency: string;
  receipt: string;
  customerEmail: string;
  customerPhone?: string;
  customerName?: string;
  metadata?: Record<string, string>;
}

export interface OrderResult {
  provider: PaymentProvider;
  orderId: string;
  amount: number;
  currency: string;
  status: string;
}

export interface VerifyPaymentParams {
  provider: PaymentProvider;
  orderId: string;
  paymentId: string;
  signature: string;
}

export interface RazorpayOrderInfo {
  id: string;
  status: string;
  amount: number;
  receipt?: string;
  paymentId?: string;
}

/** Fetch an order from Razorpay to confirm payment server-side (webhook-independent). */
export async function getRazorpayOrder(orderId: string): Promise<RazorpayOrderInfo | null> {
  const keyId = process.env.RAZORPAY_KEY_ID ?? "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET ?? "";
  if (!keyId || !keySecret) return null;

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  try {
    const res = await fetch(`https://api.razorpay.com/v1/orders/${orderId}`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!res.ok) {
      logError("razorpay/get-order", `${orderId}: ${res.status}`);
      return null;
    }
    const data = await res.json() as Record<string, unknown>;
    return {
      id: String(data.id ?? orderId),
      status: String(data.status ?? ""),
      amount: Number(data.amount) || 0,
      receipt: data.receipt ? String(data.receipt) : undefined,
      paymentId: data.payment_id ? String(data.payment_id) : undefined,
    };
  } catch (e) {
    logError("razorpay/get-order", e);
    return null;
  }
}

// ─── Razorpay ──────────────────────────────────────────────

async function razorpayCreateOrder(params: CreateOrderParams): Promise<OrderResult> {
  const keyId = process.env.RAZORPAY_KEY_ID ?? "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET ?? "";
  if (!keyId || !keySecret) throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET required");

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: params.amount * 100,
      currency: params.currency,
      receipt: params.receipt,
      notes: params.metadata ?? {},
    }),
  });

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    logError("razorpay/create-order", data);
    throw new Error(`Razorpay order failed: ${res.status} ${JSON.stringify(data)}`);
  }

  logInfo(`Razorpay order created: ${data.id}`);
  return {
    provider: "razorpay",
    orderId: String(data.id),
    amount: params.amount,
    currency: params.currency,
    status: String(data.status),
  };
}

export async function razorpayVerifyPayment(params: VerifyPaymentParams): Promise<boolean> {
  const keySecret = process.env.RAZORPAY_KEY_SECRET ?? "";
  if (!keySecret) throw new Error("RAZORPAY_KEY_SECRET required");

  const crypto = await import("node:crypto");
  const expectedSig = crypto
    .createHmac("sha256", keySecret)
    .update(`${params.orderId}|${params.paymentId}`)
    .digest("hex");

  return expectedSig === params.signature;
}

// ─── Cashfree ──────────────────────────────────────────────

async function cashfreeCreateOrder(params: CreateOrderParams): Promise<OrderResult> {
  const appId = process.env.CASHFREE_APP_ID ?? "";
  const secretKey = process.env.CASHFREE_SECRET_KEY ?? "";
  const env = process.env.CASHFREE_ENV ?? "sandbox";
  if (!appId || !secretKey) throw new Error("CASHFREE_APP_ID and CASHFREE_SECRET_KEY required");

  const baseUrl = env === "production" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";

  const res = await fetch(`${baseUrl}/orders`, {
    method: "POST",
    headers: {
      "x-client-id": appId,
      "x-client-secret": secretKey,
      "x-api-version": "2023-08-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      order_amount: params.amount,
      order_currency: params.currency,
      order_id: params.receipt,
      customer_details: {
        customer_id: params.receipt,
        customer_email: params.customerEmail,
        customer_phone: params.customerPhone ?? "9999999999",
        customer_name: params.customerName ?? "Customer",
      },
      order_meta: {
        return_url: `${process.env.APP_URL}/payment/verify?order_id={order_id}`,
      },
    }),
  });

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    logError("cashfree/create-order", data);
    throw new Error(`Cashfree order failed: ${res.status} ${JSON.stringify(data)}`);
  }

  logInfo(`Cashfree order created: ${data.cf_order_id}`);
  return {
    provider: "cashfree",
    orderId: String(data.cf_order_id ?? data.order_id),
    amount: params.amount,
    currency: params.currency,
    status: String(data.order_status),
  };
}

export async function cashfreeVerifyPayment(params: VerifyPaymentParams): Promise<boolean> {
  const appId = process.env.CASHFREE_APP_ID ?? "";
  const secretKey = process.env.CASHFREE_SECRET_KEY ?? "";
  const env = process.env.CASHFREE_ENV ?? "sandbox";
  if (!appId || !secretKey) throw new Error("CASHFREE_APP_ID and CASHFREE_SECRET_KEY required");

  const baseUrl = env === "production" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";

  const res = await fetch(`${baseUrl}/orders/${params.orderId}`, {
    headers: {
      "x-client-id": appId,
      "x-client-secret": secretKey,
      "x-api-version": "2023-08-01",
    },
  });

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) return false;

  return data.order_status === "PAID";
}

// ─── Unified Interface ─────────────────────────────────────

export async function createPaymentOrder(params: CreateOrderParams): Promise<OrderResult> {
  switch (params.provider) {
    case "razorpay":
      return razorpayCreateOrder(params);
    case "cashfree":
      return cashfreeCreateOrder(params);
    default:
      throw new Error(`Unknown provider: ${params.provider}`);
  }
}

export async function verifyPayment(params: VerifyPaymentParams): Promise<boolean> {
  switch (params.provider) {
    case "razorpay":
      return razorpayVerifyPayment(params);
    case "cashfree":
      return cashfreeVerifyPayment(params);
    default:
      throw new Error(`Unknown provider: ${params.provider}`);
  }
}

// ─── Razorpay refunds (admin-only) ─────────────────────────

export interface RazorpayRefundResult {
  id: string;
  status: string;
  amount: number;
  paymentId: string;
}

function razorpayAuth(): string {
  const keyId = process.env.RAZORPAY_KEY_ID ?? "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET ?? "";
  if (!keyId || !keySecret) throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET required");
  return Buffer.from(`${keyId}:${keySecret}`).toString("base64");
}

/** Fetch a single Razorpay payment — used to confirm a paymentId before refunding. */
export async function getRazorpayPayment(paymentId: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Basic ${razorpayAuth()}` },
    });
    if (!res.ok) {
      logError("razorpay/get-payment", `${paymentId}: ${res.status}`);
      return null;
    }
    return await res.json() as Record<string, unknown>;
  } catch (e) {
    logError("razorpay/get-payment", e);
    return null;
  }
}

/**
 * Issue a Razorpay refund for a captured payment. `amount` is in INR
 * (omit for a full refund). Only ever called from the admin-only
 * `POST /payment/refund` endpoint — never from customer-facing code.
 */
export async function createRazorpayRefund(
  paymentId: string,
  amount?: number,
  notes?: Record<string, string>,
): Promise<RazorpayRefundResult> {
  const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${razorpayAuth()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...(amount != null ? { amount: Math.round(amount * 100) } : {}),
      speed: "normal",
      ...(notes ? { notes } : {}),
    }),
  });

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    logError("razorpay/create-refund", data);
    throw new Error(`Razorpay refund failed: ${res.status} ${JSON.stringify(data)}`);
  }

  logInfo(`Razorpay refund issued: ${data.id} for payment ${paymentId}`);
  return {
    id: String(data.id),
    status: String(data.status ?? "processed"),
    amount: Number(data.amount ?? 0) / 100,
    paymentId,
  };
}
