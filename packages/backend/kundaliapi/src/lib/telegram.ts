import { hostname } from "node:os";
import { logError, logInfo } from "./logger.js";

export interface SaleNotification {
  name: string;
  email: string;
  reportType: string;
  amount: number;
  paymentId: string;
  paymentProvider: string;
  pdfGenerated: boolean;
  downloadUrl?: string;
}

async function sendTelegram(text: string): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN ?? "";
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_CHAT_ID || "";

  if (!botToken || !chatId) {
    logError("telegram/notify", "TELEGRAM_BOT_TOKEN and TELEGRAM_ADMIN_CHAT_ID (or TELEGRAM_CHAT_ID) required");
    return false;
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "Markdown",
          disable_web_page_preview: true,
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      logError("telegram/notify", `Failed: ${res.status} ${err}`);
      return false;
    }

    return true;
  } catch (e) {
    logError("telegram/notify", e);
    return false;
  }
}

function istNow(): string {
  return new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

export async function notifyAdminSale(data: SaleNotification): Promise<boolean> {
  const status = data.pdfGenerated ? "PDF generated ✅" : "PDF pending ⏳";
  const downloadLine = data.downloadUrl ? `\n📥 [Download](${data.downloadUrl})` : "";

  const message = `🔔 *New Sale (Purchase)*

👤 ${data.name || "N/A"}
📧 ${data.email}
📋 ${data.reportType}
💰 ₹${data.amount} via ${data.paymentProvider}
🔑 \`${data.paymentId}\`
${status}${downloadLine}

⏰ ${istNow()}`;

  const ok = await sendTelegram(message);
  if (ok) logInfo(`telegram/notify sale sent for payment ${data.paymentId}`);
  return ok;
}

export interface PaymentConfirmedNotification {
  name?: string;
  email?: string;
  reportType: string;
  amount: number;
  paymentId: string;
  paymentProvider: string;
}

export async function notifyAdminPaymentConfirmed(data: PaymentConfirmedNotification): Promise<boolean> {
  const message = `💳 *Payment Confirmed*

👤 ${data.name || "N/A"}
📧 ${data.email || "N/A"}
📋 ${data.reportType}
💰 ₹${data.amount} via ${data.paymentProvider}
🔑 \`${data.paymentId}\`
⏳ Generating report...

⏰ ${istNow()}`;

  const ok = await sendTelegram(message);
  if (ok) logInfo(`telegram/notify payment confirmed sent for ${data.paymentId}`);
  return ok;
}

export interface ReportFailureNotification {
  name?: string;
  email?: string;
  reportType: string;
  orderId?: string;
  cacheId?: string;
  paymentId?: string;
  paymentProvider?: string;
  error: string;
}

export async function notifyAdminReportFailure(data: ReportFailureNotification): Promise<boolean> {
  const message = `🚨 *Report Generation FAILED*

👤 ${data.name || "N/A"}
📧 ${data.email || "N/A"}
📋 ${data.reportType}
🔑 order: \`${data.orderId || "N/A"}\` · kundali: \`${data.cacheId || "N/A"}\`
💳 \`${data.paymentId || "N/A"}\` via ${data.paymentProvider || "N/A"}
❗ ${data.error}

Customer has paid but has no report — needs manual attention.

⏰ ${istNow()}`;

  const ok = await sendTelegram(message);
  if (ok) logInfo(`telegram/notify report failure sent for ${data.orderId || data.cacheId}`);
  return ok;
}

export interface DownloadNotification {
  name?: string;
  email?: string;
  reportType: string;
  paymentId: string;
  paymentProvider: string;
  archiveId: string;
}

export async function notifyAdminDownload(data: DownloadNotification): Promise<boolean> {
  const message = `📥 *Report Downloaded*

👤 ${data.name || "N/A"}
📧 ${data.email || "N/A"}
📋 ${data.reportType}
🔑 \`${data.paymentId}\` via ${data.paymentProvider}
🗂 archive: \`${data.archiveId}\`

⏰ ${istNow()}`;

  const ok = await sendTelegram(message);
  if (ok) logInfo(`telegram/notify download sent for ${data.paymentId}`);
  return ok;
}

export interface SupportTicketNotification {
  id: string;
  reason: string;
  orderId?: string;
  cacheId?: string;
  email?: string;
  name?: string;
  reportType?: string;
  amount?: number;
  orderStatus?: string;
  message?: string;
}

export async function notifyAdminSupportTicket(t: SupportTicketNotification): Promise<boolean> {
  const message = `🆘 *Support Ticket*

🏷 \`${t.id}\`
❓ ${t.reason}
👤 ${t.name || "N/A"} — ${t.email || "N/A"}
📋 ${t.reportType || "N/A"}${t.amount != null ? ` · ₹${t.amount}` : ""}
🔑 order: \`${t.orderId || "N/A"}\` (status: ${t.orderStatus || "?"})
🗂 kundali: \`${t.cacheId || "N/A"}\`${t.message ? `\n💬 ${t.message}` : ""}

⏰ ${istNow()}`;

  const ok = await sendTelegram(message);
  if (ok) logInfo(`telegram/notify support ticket ${t.id} sent`);
  return ok;
}

export interface ServiceStartInfo {
  service: string;
  port?: string | number;
  env?: string;
}

/** Daily founder digest (Markdown). */
export async function notifyFounderDigest(text: string): Promise<boolean> {
  const ok = await sendTelegram(text);
  if (ok) logInfo("telegram/notify founder digest sent");
  return ok;
}

export async function notifyAdminServiceStart(info: ServiceStartInfo): Promise<boolean> {
  const message = `🚀 *Service Restarted*

🛠 ${info.service}
🌐 port: ${info.port ?? "N/A"}
🧩 env: ${info.env ?? "N/A"}
🖥 ${hostname()}

⏰ ${istNow()}`;

  const ok = await sendTelegram(message);
  if (ok) logInfo("telegram/notify startup sent");
  return ok;
}
