import { createHash } from "node:crypto";
import { logInfo, logError } from "./logger.js";

const META_PIXEL_ID = process.env.META_PIXEL_ID ?? "";
const META_CAPI_TOKEN = process.env.META_CAPI_ACCESS_TOKEN ?? "";
const META_TEST_EVENT_CODE = process.env.META_TEST_EVENT_CODE ?? "";
const GA4_MEASUREMENT_ID = process.env.GA4_MEASUREMENT_ID ?? "";
const GA4_API_SECRET = process.env.GA4_API_SECRET ?? "";
const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION ?? "v21.0";

export interface PurchaseConversion {
  orderId: string;
  value: number;
  currency?: string;
  email?: string;
  name?: string;
  reportType?: string;
  gaClientId?: string;
  eventSourceUrl?: string;
  fbp?: string;
  fbc?: string;
  clientIp?: string;
  userAgent?: string;
}

function sha256(value?: string): string | undefined {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) return undefined;
  return createHash("sha256").update(normalized).digest("hex");
}

function metaUserData(args: PurchaseConversion) {
  const data: Record<string, unknown> = {};
  const em = sha256(args.email);
  if (em) data.em = [em];
  const name = (args.name ?? "").trim().split(/\s+/);
  if (name[0]) data.fn = [sha256(name[0])];
  if (name.length > 1) data.ln = [sha256(name[name.length - 1])];
  if (args.fbp) data.fbp = args.fbp;
  if (args.fbc) data.fbc = args.fbc;
  if (args.clientIp) data.client_ip_address = args.clientIp;
  if (args.userAgent) data.client_user_agent = args.userAgent;
  return data;
}

async function sendMetaPurchase(args: PurchaseConversion): Promise<void> {
  if (!META_PIXEL_ID || !META_CAPI_TOKEN) return;
  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${META_PIXEL_ID}/events?access_token=${META_CAPI_TOKEN}`;
  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: args.orderId,
        action_source: "website",
        event_source_url: args.eventSourceUrl,
        user_data: metaUserData(args),
        custom_data: {
          value: args.value,
          currency: args.currency ?? "INR",
          content_type: "product",
          content_ids: [args.orderId],
          content_name: args.reportType ?? "financial_kundali",
          order_id: args.orderId,
        },
      },
    ],
  };
  if (META_TEST_EVENT_CODE) payload.test_event_code = META_TEST_EVENT_CODE;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Meta CAPI ${res.status}: ${await res.text()}`);
  }
  logInfo(`Meta CAPI purchase sent for ${args.orderId}`);
}

async function sendGa4Purchase(args: PurchaseConversion): Promise<void> {
  if (!GA4_MEASUREMENT_ID || !GA4_API_SECRET) return;
  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${GA4_MEASUREMENT_ID}&api_secret=${GA4_API_SECRET}`;
  const body = {
    client_id: args.gaClientId || args.orderId,
    events: [
      {
        name: "purchase",
        params: {
          transaction_id: args.orderId,
          value: args.value,
          currency: args.currency ?? "INR",
          items: [
            {
              item_id: args.reportType ?? "financial_kundali",
              item_name: args.reportType ?? "Financial Kundali Report",
              price: args.value,
              quantity: 1,
            },
          ],
        },
      },
    ],
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`GA4 Measurement Protocol ${res.status}`);
  }
  logInfo(`GA4 MP purchase sent for ${args.orderId}`);
}

export async function sendPurchaseConversion(args: PurchaseConversion): Promise<void> {
  await Promise.allSettled([
    sendMetaPurchase(args).catch((e) => logError("/conversions/meta", e)),
    sendGa4Purchase(args).catch((e) => logError("/conversions/ga4", e)),
  ]);
}
