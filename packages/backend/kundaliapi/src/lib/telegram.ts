import { logInfo, logError } from "./logger.js";

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

export async function notifyAdminSale(data: SaleNotification): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN ?? "";
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID ?? "";

  if (!botToken || !chatId) {
    logError("telegram/notify", "TELEGRAM_BOT_TOKEN and TELEGRAM_ADMIN_CHAT_ID required");
    return false;
  }

  const status = data.pdfGenerated ? "PDF generated ✅" : "PDF pending ⏳";
  const downloadLine = data.downloadUrl ? `\n📥 [Download](${data.downloadUrl})` : "";

  const message = `🔔 *New Sale*

👤 ${data.name || "N/A"}
📧 ${data.email}
📋 ${data.reportType}
💰 ₹${data.amount} via ${data.paymentProvider}
🔑 \`${data.paymentId}\`
${status}${downloadLine}

⏰ ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`;

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
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

    logInfo(`telegram/notify sent for payment ${data.paymentId}`);
    return true;
  } catch (e) {
    logError("telegram/notify", e);
    return false;
  }
}
