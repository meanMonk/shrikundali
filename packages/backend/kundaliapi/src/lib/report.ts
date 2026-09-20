import { getCachedChart, deleteCachedChart } from "./cache.js";
import { renderPDF, renderMarkdown } from "./render.js";
import { archiveRaw, addArchiveFile } from "./archive.js";
import { logInfo, logError } from "./logger.js";
import { sendReportEmail } from "./email.js";
import { notifyAdminSale } from "./telegram.js";
import { updateOrderPayment, createOrder, getOrderByOrderId } from "./orders.js";
import { getPendingPayment, updatePendingPayment, acquireReportLock, releaseReportLock } from "./pending.js";

const API_BASE = () => process.env.APP_URL ?? "http://localhost:3400";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface PaidReportArgs {
  orderId: string;
  provider: string;
  paymentId?: string;
  cacheId?: string;
  email?: string;
  name?: string;
  amount?: number;
}

export interface PaidReportResult {
  archiveId: string;
  downloadUrl: string;
  alreadyGenerated: boolean;
}

/**
 * Idempotently generate, archive, email and notify for a paid order.
 * Safe to call from both the Razorpay callback and the webhook.
 */
export async function generatePaidReport(
  args: PaidReportArgs,
): Promise<PaidReportResult | null> {
  const endpoint = "/report/generate";
  const pending = await getPendingPayment(args.orderId);

  if (pending?.archiveId && pending.downloadUrl) {
    logInfo(`${endpoint} already generated for ${args.orderId}`);
    return { archiveId: pending.archiveId, downloadUrl: pending.downloadUrl, alreadyGenerated: true };
  }

  const cacheId = pending?.cacheId ?? args.cacheId ?? "";
  const email = pending?.email || args.email || "";
  const name = pending?.name ?? args.name;
  const amount = pending?.amount ?? args.amount ?? 0;
  const paymentId = args.paymentId ?? args.orderId;

  if (!cacheId) {
    logError(endpoint, `No cacheId for order ${args.orderId}`);
    return null;
  }

  const cached = await getCachedChart(cacheId);
  if (!cached) {
    logError(endpoint, `Cache expired for ${cacheId} (order ${args.orderId})`);
    return null;
  }

  // Another trigger (client callback or webhook) may already be generating.
  const locked = await acquireReportLock(args.orderId);
  if (!locked) {
    for (let i = 0; i < 10; i++) {
      await sleep(2000);
      const p = await getPendingPayment(args.orderId);
      if (p?.archiveId && p.downloadUrl) {
        return { archiveId: p.archiveId, downloadUrl: p.downloadUrl, alreadyGenerated: true };
      }
    }
    logInfo(`${endpoint} generation already in progress for ${args.orderId}`);
    return null;
  }

  try {
    const label = cached.label || "Financial Kundali";
    logInfo(`${endpoint} generating PDF for ${cacheId} (order ${args.orderId})`);

    const pdf = await renderPDF(cached.parsed, label);
    const md = renderMarkdown(cached.parsed, label);

    const archive = await archiveRaw(
      "/kundali/pdf",
      { cacheId, orderId: args.orderId, provider: args.provider },
      "pdf",
      cached.raw,
      pdf,
    );
    await addArchiveFile(archive.id, "report.md", Buffer.from(md), "text/markdown");

    const downloadUrl = `${API_BASE()}/download/${archive.id}/pdf`;

    await updatePendingPayment(args.orderId, {
      archiveId: archive.id,
      downloadUrl,
      email,
      name,
      amount,
      paidAt: new Date().toISOString(),
    });

    await updateOrderPayment(args.orderId, paymentId, "completed", archive.id, downloadUrl)
      .catch((e) => logError(`${endpoint}/updateOrder`, e));

    const existing = await getOrderByOrderId(args.orderId);
    if (!existing) {
      await createOrder({
        orderId: args.orderId,
        cacheId,
        email,
        name,
        reportType: label,
        amount,
        currency: "INR",
        provider: args.provider,
        paymentId,
        status: "completed",
        archiveId: archive.id,
        downloadUrl,
        createdAt: new Date(),
        paidAt: new Date(),
      }).catch((e) => logError(`${endpoint}/createOrder`, e));
    }

    sendReportEmail(email || cached.email, name || cached.label || "", downloadUrl, label, amount, paymentId, pdf)
      .catch((e) => logError(`${endpoint}/email`, e));

    const saleNotified = await notifyAdminSale({
      name: name || "",
      email: email || cached.email,
      reportType: label,
      amount,
      paymentId,
      paymentProvider: args.provider,
      pdfGenerated: true,
      downloadUrl,
    }).catch(() => false);
    if (saleNotified) await updatePendingPayment(args.orderId, { purchaseNotified: true });

    await deleteCachedChart(cacheId);
    logInfo(`${endpoint} done for ${args.orderId}: ${archive.id}`);
    return { archiveId: archive.id, downloadUrl, alreadyGenerated: false };
  } catch (e) {
    logError(endpoint, e);
    return null;
  } finally {
    await releaseReportLock(args.orderId);
  }
}
