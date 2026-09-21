import { getKundli, getPersonalReportPdf } from "./prokerala.js";
import { renderReportPDF, renderMarkdown, type ReportMeta } from "./render.js";
import { archiveRaw, addArchiveFile } from "./archive.js";
import { logInfo, logError } from "./logger.js";
import { sendReportEmail } from "./email.js";
import { notifyAdminSale } from "./telegram.js";
import { updateOrderPayment, createOrder, getOrderByOrderId } from "./orders.js";
import {
  getKundali,
  getKundaliByOrderId,
  claimKundaliForReport,
  updateKundali,
  REPORT_LABELS,
  type KundaliDoc,
} from "./store.js";

const API_BASE = () => process.env.APP_URL ?? "http://localhost:3400";

export interface PaidReportArgs {
  orderId?: string;
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
 * Send the admin sale alert at most once per kundali. Retries on the next
 * call if a previous attempt failed, since `purchaseNotified` stays false.
 */
async function notifySaleOnce(doc: KundaliDoc): Promise<void> {
  if (doc.purchaseNotified) return;
  try {
    const ok = await notifyAdminSale({
      name: doc.name || "",
      email: doc.email || "",
      reportType: doc.reportLabel || REPORT_LABELS[doc.reportType],
      amount: doc.amount ?? 0,
      paymentId: doc.paymentId || doc.orderId || doc.id,
      paymentProvider: doc.provider || "razorpay",
      pdfGenerated: true,
      downloadUrl: doc.downloadUrl,
    });
    if (ok) await updateKundali(doc.id, { purchaseNotified: true });
  } catch (e) {
    logError("/report/generate/telegram", e);
  }
}

/**
 * Idempotently generate the paid PDF from the stored kundali document,
 * archive it, email it and notify. Safe to call from both the Razorpay
 * callback and the webhook.
 */
export async function generatePaidReport(
  args: PaidReportArgs,
): Promise<PaidReportResult | null> {
  const endpoint = "/report/generate";

  let doc: KundaliDoc | null = null;
  if (args.orderId) doc = await getKundaliByOrderId(args.orderId);
  if (!doc && args.cacheId) doc = await getKundali(args.cacheId);
  if (!doc) {
    logError(endpoint, `No kundali for order ${args.orderId} / cache ${args.cacheId}`);
    return null;
  }

  if (doc.archiveId && doc.downloadUrl) {
    logInfo(`${endpoint} already generated for ${doc.id}`);
    await notifySaleOnce(doc);
    return { archiveId: doc.archiveId, downloadUrl: doc.downloadUrl, alreadyGenerated: true };
  }

  const claimed = await claimKundaliForReport(doc.id);
  if (!claimed) {
    logInfo(`${endpoint} generation already in progress for ${doc.id}`);
    return null;
  }
  doc = claimed;

  const orderId = args.orderId ?? doc.orderId ?? doc.id;
  const provider = args.provider || doc.provider || "razorpay";
  const paymentId = args.paymentId ?? doc.paymentId ?? orderId;
  const email = doc.email || args.email || "";
  const name = doc.name ?? args.name;
  const amount = doc.amount ?? args.amount ?? 0;
  const label = doc.reportLabel || REPORT_LABELS[doc.reportType];
  const birth = doc.birth;
  const meta: ReportMeta = {
    name: name || "",
    gender: doc.gender || birth?.gender,
    datetime: birth?.datetime,
    coordinates: birth?.coordinates,
    place: doc.place || birth?.place,
    ayanamsa: birth?.ayanamsa,
    language: birth?.la,
  };

  try {
    logInfo(`${endpoint} generating report for ${doc.id} (order ${orderId})`);

    // The teaser chart is lean; the paid report needs dasha/timing. Fetch the
    // detailed chart once (and cache it on the doc) rather than shipping a
    // report whose timing pages are empty.
    let renderData = doc.parsed;
    if (doc.reportType === "financial_kundali") {
      const current = (doc.parsed.data as Record<string, unknown> | undefined)?.dasha_periods;
      const needsDasha = !Array.isArray(current) || current.length === 0;
      if (needsDasha && birth) {
        try {
          const detailed = await getKundli({
            coordinates: birth.coordinates,
            datetime: birth.datetime,
            ayanamsa: birth.ayanamsa,
            la: birth.la,
            detailed: true,
          });
          renderData = detailed.parsed;
          await updateKundali(doc.id, { parsed: detailed.parsed, raw: detailed.raw }).catch((e) =>
            logError(`${endpoint}/cache-detailed`, e),
          );
        } catch (e) {
          logError(`${endpoint}/report-refetch`, e);
        }
      }
      const dasha = (renderData.data as Record<string, unknown> | undefined)?.dasha_periods;
      if (!Array.isArray(dasha) || dasha.length === 0) {
        throw new Error("Financial report requires dasha periods; ProKerala data incomplete");
      }
    }

    // Prefer ProKerala's own full paragraph report for non-financial types.
    // Financial Kundali always uses our branded 12-page template so it stays
    // self-contained, cheap, and finance-focused.
    const useProkeralaReport =
      (process.env.PROKERALA_PDF_REPORT ?? "true") !== "false" &&
      doc.reportType !== "financial_kundali";
    let pdf: Buffer | null = null;

    if (useProkeralaReport && birth) {
      try {
        pdf = await getPersonalReportPdf(
          {
            first_name: name || birth.name || "",
            datetime: birth.datetime,
            coordinates: birth.coordinates,
            place: birth.place,
            gender: birth.gender || doc.gender,
          },
          {
            language: birth.la,
            reportName: label,
            brandName: "Shri Kundali",
            caption: "Generated by Shri Kundali",
            footer: "shrikundali.com",
          },
        );
        logInfo(`${endpoint} ProKerala report ready (${pdf.length} bytes)`);
      } catch (e) {
        logError(`${endpoint}/prokerala-report`, e);
        pdf = null;
      }
    }

    if (!pdf) {
      logInfo(`${endpoint} rendering ${doc.reportType} report with local template`);
      pdf = await renderReportPDF(doc.reportType, renderData, label, meta);
    }

    const md = renderMarkdown(renderData, label, meta);

    const archive = await archiveRaw(
      "/kundali/pdf",
      { cacheId: doc.id, orderId, provider },
      "pdf",
      doc.raw,
      pdf,
    );
    await addArchiveFile(archive.id, "report.md", Buffer.from(md), "text/markdown");

    const downloadUrl = `${API_BASE()}/download/${archive.id}/pdf`;

    await updateKundali(doc.id, {
      archiveId: archive.id,
      downloadUrl,
      status: "completed",
      orderId,
      provider,
      paymentId,
      email,
      name,
      amount,
      paidAt: new Date(),
    });

    await updateOrderPayment(orderId, paymentId, "completed", archive.id, downloadUrl)
      .catch((e) => logError(`${endpoint}/updateOrder`, e));

    const existingOrder = await getOrderByOrderId(orderId);
    if (!existingOrder) {
      await createOrder({
        orderId,
        cacheId: doc.id,
        email,
        name,
        reportType: doc.reportType,
        amount,
        currency: "INR",
        provider,
        paymentId,
        status: "completed",
        archiveId: archive.id,
        downloadUrl,
        createdAt: new Date(),
        paidAt: new Date(),
      }).catch((e) => logError(`${endpoint}/createOrder`, e));
    }

    // Notify the admin chat first — this must not depend on email delivery.
    await notifySaleOnce({ ...doc, archiveId: archive.id, downloadUrl });

    // Email is best-effort; a failure here must never affect the sale notification.
    try {
      await sendReportEmail(email, name || "", downloadUrl, label, amount, paymentId, pdf);
    } catch (e) {
      logError(`${endpoint}/email`, e);
    }

    logInfo(`${endpoint} done for ${orderId}: ${archive.id}`);
    return { archiveId: archive.id, downloadUrl, alreadyGenerated: false };
  } catch (e) {
    logError(endpoint, e);
    await updateKundali(doc.id, { status: "paid" }).catch(() => {});
    return null;
  }
}
