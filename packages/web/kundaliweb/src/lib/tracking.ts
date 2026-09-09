export function trackEvent(eventName: string, params?: Record<string, unknown>) {
  // Meta Pixel
  if (typeof window !== "undefined" && typeof (window as any).fbq === "function") {
    (window as any).fbq("track", eventName, params);
  }

  // Google Analytics
  if (typeof window !== "undefined" && typeof (window as any).gtag === "function") {
    (window as any).gtag("event", eventName, params);
  }
}

export function trackServerEvent(eventName: string, data: Record<string, unknown>) {
  const API = import.meta.env?.VITE_API_URL ?? "http://localhost:3400";
  fetch(`${API}/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event: eventName, data }),
  }).catch(() => {});
}

// Funnel events
export const Funnel = {
  pageView: (page: string) => trackEvent("PageView", { page }),

  formStart: () => trackEvent("InitiateCheckout"),

  formSubmit: (email: string) => {
    trackEvent("Lead", { content_name: "kundali_form" });
    trackServerEvent("form_submit", { email });
  },

  paymentInitiated: (orderId: string, amount: number) => {
    trackEvent("InitiateCheckout", { value: amount, currency: "INR", content_ids: [orderId] });
    trackServerEvent("payment_initiated", { orderId, amount });
  },

  paymentSuccess: (orderId: string, amount: number) => {
    trackEvent("Purchase", { value: amount, currency: "INR", content_ids: [orderId], content_type: "product" });
    trackServerEvent("payment_success", { orderId, amount });
  },

  downloadStarted: (archiveId: string) => {
    trackEvent("ViewContent", { content_name: "kundali_pdf", content_ids: [archiveId] });
    trackServerEvent("download_started", { archiveId });
  },
};
