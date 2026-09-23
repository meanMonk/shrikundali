import { logInfo, logError } from "./logger.js";

export interface EmailParams {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
}

async function sendViaSMTP(params: EmailParams): Promise<boolean> {
  const host = process.env.ZOHO_SMTP_HOST ?? "smtp.zoho.com";
  const port = Number(process.env.ZOHO_SMTP_PORT ?? 465);
  const user = process.env.ZOHO_SMTP_USER ?? "";
  const pass = process.env.ZOHO_SMTP_PASS ?? "";
  const from = process.env.ZOHO_SMTP_FROM ?? user;

  if (!user || !pass) {
    logError("email/smtp", "ZOHO_SMTP_USER and ZOHO_SMTP_PASS required");
    return false;
  }

  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.default.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      attachments: params.attachments,
    });

    logInfo(`email/smtp sent to ${params.to}`);
    return true;
  } catch (e) {
    logError("email/smtp", e);
    return false;
  }
}

export interface ReportEmailFeature {
  title: string;
  detail?: string;
}

export async function sendReportEmail(
  to: string,
  name: string,
  downloadUrl: string,
  reportType: string,
  amount: number,
  paymentId: string,
  pdf?: Buffer,
  features?: ReportEmailFeature[],
): Promise<boolean> {
  const featureList = (features && features.length > 0 ? features : [
    { title: "Complete birth chart analysis", detail: "Planet positions, houses & degrees" },
    { title: "Dasha & Antardasha timeline", detail: "Financial timing for the next 10+ years" },
    { title: "Yogas & Doshas with remedies", detail: "What helps you and what to avoid" },
    { title: "Money-axis scores", detail: "Wealth, career, business & investment" },
    { title: "Print-ready PDF", detail: "Mobile & WhatsApp friendly" },
  ])
    .map(
      (f) => `
      <tr>
        <td style="vertical-align: top; padding: 0.35rem 0.5rem 0.35rem 0; color: #1a7f37; font-weight: 700;">✔</td>
        <td style="padding: 0.35rem 0; color: #333; font-size: 0.92rem;">
          <strong>${f.title}</strong>${f.detail ? `<br><span style="color:#777;font-size:0.82rem;">${f.detail}</span>` : ""}
        </td>
      </tr>`,
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Georgia, serif; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 2rem;">
  <h1 style="color: #8b4513; border-bottom: 2px solid #d4a373; padding-bottom: 0.5rem;">Your Kundali Report is Ready</h1>
  <p>Hi ${name || "there"},</p>
  <p>Thank you for your purchase. Your <strong>${reportType}</strong> report has been generated and is ready. Download it instantly using the button below — a copy is also attached to this email as a backup.</p>

  <div style="background: #faf3e8; border: 1px solid #d4a373; border-radius: 8px; padding: 1.5rem; margin: 1.5rem 0;">
    <p style="margin: 0 0 0.5rem 0;"><strong>Amount Paid:</strong> ₹${amount}</p>
    <p style="margin: 0 0 0.5rem 0;"><strong>Payment ID:</strong> ${paymentId}</p>
    <p style="margin: 0;"><strong>Report Type:</strong> ${reportType}</p>
  </div>

  <a href="${downloadUrl}" style="display: inline-block; background: #8b4513; color: white; padding: 0.8rem 2rem; text-decoration: none; border-radius: 4px; font-weight: 600;">Download Full Report (PDF)</a>

  <div style="background: #f1f7ff; border: 1px solid #cfe3ff; border-radius: 8px; padding: 1.25rem 1.5rem; margin: 1.5rem 0;">
    <h2 style="color: #8b4513; font-size: 1.05rem; margin: 0 0 0.75rem 0;">What's inside your PDF</h2>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
      ${featureList}
    </table>
  </div>

  <p style="margin-top: 1rem; font-size: 0.9rem; color: #666;">This download link will remain active for 7 days. If you have any issues, email us at <a href="mailto:support@rashikundali.com" style="color: #8b4513">support@rashikundali.com</a>.</p>

  <hr style="border: none; border-top: 1px solid #d4a373; margin: 2rem 0;">
  <p style="font-size: 0.8rem; color: #888; text-align: center;"><a href="https://rashikundali.com" style="color: #888;">rashikundali.com</a></p>
</body>
</html>`;

  return sendViaSMTP({
    to,
    subject: `Your Kundali Report — Payment Confirmed (₹${amount})`,
    html,
    attachments: pdf
      ? [{ filename: `kundali-report-${paymentId}.pdf`, content: pdf, contentType: "application/pdf" }]
      : undefined,
  });
}

export async function sendPaymentFailureEmail(
  to: string,
  name: string,
  error: string,
): Promise<boolean> {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Georgia, serif; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 2rem;">
  <h1 style="color: #8b4513;">Payment Received — Report Generation Pending</h1>
  <p>Hi ${name || "there"},</p>
  <p>We received your payment, but encountered a technical issue while generating your report.</p>
  <p>Our team has been notified and will resolve this shortly. You will receive your report via email within the next 30 minutes.</p>
  <p>If you don't receive it, please contact us with your payment details.</p>
  <hr style="border: none; border-top: 1px solid #d4a373; margin: 2rem 0;">
  <p style="font-size: 0.8rem; color: #888; text-align: center;">rashikundali.com</p>
</body>
</html>`;

  return sendViaSMTP({
    to,
    subject: "Your Kundali Report — Processing",
    html,
  });
}

/** Where support tickets are delivered. Override with SUPPORT_EMAIL. */
export function supportInbox(): string {
  return process.env.SUPPORT_EMAIL || "support@rashikundali.com";
}

/** Founder daily digest recipient. Override with FOUNDER_EMAIL. */
export function founderInbox(): string {
  return process.env.FOUNDER_EMAIL || "sahil.k@vaayulabs.com";
}

/** Daily business overview email to the founder. */
export async function sendFounderDigestEmail(subject: string, html: string): Promise<boolean> {
  return sendViaSMTP({ to: founderInbox(), subject, html });
}

export interface SupportEmailContext {
  id: string;
  reason: string;
  orderId?: string;
  cacheId?: string;
  email?: string;
  name?: string;
  reportType?: string;
  amount?: number;
  paymentId?: string;
  orderStatus?: string;
  message?: string;
  createdAt: Date;
}

function escapeHtml(v: string): string {
  return v.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch] ?? ch));
}

function supportDetailsRows(t: SupportEmailContext): string {
  const rows: [string, string | number | undefined][] = [
    ["Ticket", t.id],
    ["Reason", t.reason],
    ["Order ID", t.orderId],
    ["Kundali / cache ID", t.cacheId],
    ["Email", t.email],
    ["Name", t.name],
    ["Report", t.reportType],
    ["Amount", t.amount != null ? `₹${t.amount}` : undefined],
    ["Payment ID", t.paymentId],
    ["Order status", t.orderStatus],
    ["Raised at", t.createdAt.toISOString()],
    ["Message", t.message],
  ];
  return rows
    .filter(([, v]) => v !== undefined && v !== "")
    .map(
      ([k, v]) =>
        `<tr><td style="padding:0.3rem 0.75rem 0.3rem 0;color:#777;">${k}</td><td style="padding:0.3rem 0;color:#111;font-family:monospace;">${escapeHtml(String(v))}</td></tr>`,
    )
    .join("");
}

/** Internal alert to the support inbox. */
export async function sendSupportTicketEmail(t: SupportEmailContext): Promise<boolean> {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Georgia, serif; color: #1a1a1a; max-width: 640px; margin: 0 auto; padding: 2rem;">
  <h1 style="color: #8b4513; border-bottom: 2px solid #d4a373; padding-bottom: 0.5rem;">New Support Ticket</h1>
  <p>A customer reported a problem after payment.</p>
  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:#faf3e8;border:1px solid #e8dfd1;border-radius:8px;padding:0.5rem;">
    ${supportDetailsRows(t)}
  </table>
  <p style="font-size:0.85rem;color:#666;margin-top:1rem;">Look up the order in the \`orders\` / \`kundalis\` collections using the IDs above.</p>
</body>
</html>`;
  return sendViaSMTP({
    to: supportInbox(),
    subject: `[Support] ${t.reason} — ${t.orderId ?? t.id}`,
    html,
  });
}

/** Acknowledgement to the customer. */
export async function sendSupportAckEmail(t: SupportEmailContext): Promise<boolean> {
  if (!t.email) return false;
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Georgia, serif; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 2rem;">
  <h1 style="color: #8b4513;">We're on it</h1>
  <p>Hi ${escapeHtml(t.name || "there")},</p>
  <p>Thanks for letting us know. We've received your report and our team will get back to you over email as soon as possible — usually within a few hours.</p>
  <p>For reference, your ticket number is <strong>${escapeHtml(t.id)}</strong>${t.orderId ? ` (order <strong>${escapeHtml(t.orderId)}</strong>)` : ""}.</p>
  <p style="font-size:0.9rem;color:#666;">If your report is already on its way, you can ignore this — a fresh download link will also be emailed to you.</p>
  <hr style="border: none; border-top: 1px solid #d4a373; margin: 2rem 0;">
  <p style="font-size: 0.8rem; color: #888; text-align: center;"><a href="https://rashikundali.com" style="color:#888;">rashikundali.com</a></p>
</body>
</html>`;
  return sendViaSMTP({
    to: t.email,
    subject: "We've received your request — Rashi Kundali Support",
    html,
  });
}
