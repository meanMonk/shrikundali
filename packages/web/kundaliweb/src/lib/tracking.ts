import { attributionParams, captureAttribution } from "./attribution";

type TrackParams = Record<string, unknown>;
type TrackingContext = { angle?: string; reportType?: string };

const env = import.meta.env as Record<string, string | undefined>;

const GOOGLE_ADS_ID = env.PUBLIC_GOOGLE_ADS_ID || "";
const ADS_LEAD_LABEL = env.PUBLIC_GOOGLE_ADS_LEAD_LABEL || "";
const ADS_CHECKOUT_LABEL = env.PUBLIC_GOOGLE_ADS_CHECKOUT_LABEL || "";
const ADS_PURCHASE_LABEL = env.PUBLIC_GOOGLE_ADS_PURCHASE_LABEL || "";

let context: TrackingContext = {};

export function setTrackingContext(ctx: TrackingContext) {
  context = { ...context, ...ctx };
}

export function initTracking(ctx?: TrackingContext) {
  captureAttribution();
  if (ctx) setTrackingContext(ctx);
}

function withContext(params: TrackParams = {}): TrackParams {
  const merged: TrackParams = { ...attributionParams(), ...params };
  if (context.angle) {
    merged.angle = context.angle;
    if (!merged.content_name) merged.content_name = context.angle;
  }
  if (context.reportType) merged.report_type = context.reportType;
  return merged;
}

function fbq(...args: unknown[]) {
  if (typeof window !== "undefined" && typeof (window as any).fbq === "function") {
    (window as any).fbq(...args);
  }
}

function gtag(...args: unknown[]) {
  if (typeof window !== "undefined" && typeof (window as any).gtag === "function") {
    (window as any).gtag(...args);
  }
}

function clarity(...args: unknown[]) {
  if (typeof window !== "undefined" && typeof (window as any).clarity === "function") {
    (window as any).clarity(...args);
  }
}

function adsConversion(label: string, params: TrackParams) {
  if (!GOOGLE_ADS_ID || !label) return;
  gtag("event", "conversion", {
    send_to: `${GOOGLE_ADS_ID}/${label}`,
    value: params.value,
    currency: params.currency || "INR",
    transaction_id: params.transaction_id,
  });
}

function toItems(params: TrackParams) {
  const raw = params.content_ids;
  const ids = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const name = String(params.content_name || "Financial Kundali Report");
  const items: Array<Record<string, unknown>> = ids.length
    ? ids.map((id) => ({ item_id: String(id), item_name: name }))
    : [{ item_id: "financial_kundali", item_name: name }];
  if (typeof params.value === "number" && items.length === 1) {
    items[0].price = params.value;
    items[0].quantity = 1;
  }
  return items;
}

function commerce(params: TrackParams) {
  return {
    value: params.value,
    currency: params.currency || "INR",
    transaction_id: params.transaction_id,
    items: toItems(params),
  };
}

export function trackPageView(page?: string) {
  fbq("track", "PageView");
  gtag("event", "page_view", {
    page_path: page || (typeof window !== "undefined" ? window.location.pathname : undefined),
    page_location: typeof window !== "undefined" ? window.location.href : undefined,
    page_title: typeof document !== "undefined" ? document.title : undefined,
  });
}

export function trackLead(params: TrackParams = {}) {
  const p = withContext(params);
  fbq("track", "Lead", { currency: "INR", ...p });
  gtag("event", "generate_lead", { currency: "INR", ...p });
  adsConversion(ADS_LEAD_LABEL, p);
  clarity("set", "conversion", "lead");
}

export function trackViewContent(params: TrackParams = {}) {
  const p = withContext(params);
  fbq("track", "ViewContent", { currency: "INR", ...p });
  gtag("event", "view_item", commerce(p));
}

export function trackBeginCheckout(params: TrackParams = {}) {
  const p = withContext(params);
  fbq("track", "InitiateCheckout", { currency: "INR", ...p });
  gtag("event", "begin_checkout", commerce(p));
  adsConversion(ADS_CHECKOUT_LABEL, p);
  clarity("set", "conversion", "begin_checkout");
}

export function trackAddPaymentInfo(params: TrackParams = {}) {
  const p = withContext(params);
  fbq("track", "AddPaymentInfo", { currency: "INR", ...p });
  gtag("event", "add_payment_info", commerce(p));
}

export function trackPurchase(params: TrackParams = {}) {
  const p = withContext(params);
  const eventId = typeof p.transaction_id === "string" ? p.transaction_id : undefined;
  if (eventId) {
    fbq("track", "Purchase", { currency: "INR", ...p }, { eventID: eventId });
  } else {
    fbq("track", "Purchase", { currency: "INR", ...p });
  }
  gtag("event", "purchase", commerce(p));
  adsConversion(ADS_PURCHASE_LABEL, p);
  clarity("set", "conversion", "purchase");
}

export function trackPurchaseOnce(orderId: string, params: TrackParams = {}) {
  if (!orderId) return;
  const key = `sk_purchase_tracked_${orderId}`;
  try {
    if (window.localStorage.getItem(key)) return;
    window.localStorage.setItem(key, "1");
  } catch {}
  trackPurchase({ transaction_id: orderId, content_ids: [orderId], ...params });
}

export function trackDownload(params: TrackParams = {}) {
  const p = withContext(params);
  fbq("trackCustom", "ReportDownload", p);
  gtag("event", "file_download", p);
  clarity("event", "report_download");
}

export function trackCustom(eventName: string, params: TrackParams = {}) {
  const p = withContext(params);
  fbq("trackCustom", eventName, p);
  gtag("event", eventName, p);
  clarity("event", eventName);
}

export function trackEvent(eventName: string, params?: TrackParams) {
  trackCustom(eventName, params);
}

export function trackServerEvent(eventName: string, data: Record<string, unknown>) {
  const API = env.VITE_API_URL ?? env.PUBLIC_API_URL ?? "http://localhost:3400";
  fetch(`${API}/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event: eventName, data }),
  }).catch(() => {});
}

export const Funnel = {
  pageView: (page: string) => trackPageView(page),

  formStart: () => trackBeginCheckout({ content_name: "kundali_form" }),

  formSubmit: (email: string) => trackLead({ content_name: "kundali_form", email }),

  paymentInitiated: (orderId: string, amount: number) =>
    trackAddPaymentInfo({ transaction_id: orderId, value: amount, currency: "INR", content_ids: [orderId] }),

  paymentSuccess: (orderId: string, amount: number) =>
    trackPurchase({ transaction_id: orderId, value: amount, currency: "INR", content_ids: [orderId] }),

  downloadStarted: (archiveId: string) => trackDownload({ content_ids: [archiveId] }),
};
