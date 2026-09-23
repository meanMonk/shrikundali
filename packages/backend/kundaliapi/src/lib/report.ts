import { getKundli, getPersonalReportPdf } from "./prokerala.js";
import { renderReportPDF, renderMarkdown, type ReportMeta } from "./render.js";
import { archiveRaw, addArchiveFile } from "./archive.js";
import { logInfo, logError } from "./logger.js";
import { sendReportEmail } from "./email.js";
import { notifyAdminSale, notifyAdminPaymentConfirmed, notifyAdminReportFailure } from "./telegram.js";
import { markOrderCompleted } from "./orders.js";
import {
  getKundali,
  getKundaliByOrderId,
  claimKundaliForReport,
  updateKundali,
  markKundaliConversionSent,
  markKundaliPaymentNotified,
  markKundaliFailureNotified,
  REPORT_LABELS,
  type KundaliDoc,
} from "./store.js";
import { sendPurchaseConversion } from "./conversions.js";
import { isAngleReport } from "./angle-report.js";

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
 * Ping the admin chat once payment is confirmed and generation has been
 * claimed, ahead of the (potentially slow) ProKerala + render work. Fires at
 * most once per kundali regardless of how many times generation is retried.
 */
async function notifyPaymentOnce(
  doc: KundaliDoc,
  orderId: string,
  provider: string,
  paymentId: string,
): Promise<void> {
  try {
    if (!(await markKundaliPaymentNotified(doc.id))) return;
    await notifyAdminPaymentConfirmed({
      name: doc.name,
      email: doc.email,
      reportType: doc.reportLabel || REPORT_LABELS[doc.reportType],
      amount: doc.amount ?? 0,
      paymentId: paymentId || orderId,
      paymentProvider: provider,
    });
  } catch (e) {
    logError("/report/generate/telegram-payment", e);
  }
}

/**
 * Alert the admin chat when report generation fails outright — a paying
 * customer has no report and needs manual attention. Fires at most once per
 * kundali so the self-heal retry loop (polling /payment/order) can't spam
 * the same failure over and over.
 */
async function notifyFailureOnce(doc: KundaliDoc, orderId: string, error: unknown): Promise<void> {
  try {
    if (!(await markKundaliFailureNotified(doc.id))) return;
    await notifyAdminReportFailure({
      name: doc.name,
      email: doc.email,
      reportType: doc.reportLabel || REPORT_LABELS[doc.reportType],
      orderId,
      cacheId: doc.id,
      paymentId: doc.paymentId,
      paymentProvider: doc.provider,
      error: String(error instanceof Error ? error.message : error),
    });
  } catch (e) {
    logError("/report/generate/telegram-failure", e);
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
    reportNo: doc.id.toUpperCase(),
  };

  await notifyPaymentOnce(doc, orderId, provider, paymentId);

  try {
    logInfo(`${endpoint} generating report for ${doc.id} (order ${orderId})`);

    // The teaser chart is lean; the paid report needs dasha/timing. Fetch the
    // detailed chart once (and cache it on the doc) rather than shipping a
    // report whose timing pages are empty.
    let renderData = doc.parsed;
    const isFinancial = doc.reportType === "financial_kundali";
    const needsDetailedChart = isFinancial || isAngleReport(doc.reportType);
    if (needsDetailedChart) {
      const hasPlanets = (k: typeof doc.parsed): boolean => {
        const list = (k.data as Record<string, unknown> | undefined)?.planet_positions;
        return Array.isArray(list) && list.length > 0;
      };
      const hasAscendant = (k: typeof doc.parsed): boolean =>
        Boolean((k.data as Record<string, unknown> | undefined)?.ascendant);
      const current = (doc.parsed.data as Record<string, unknown> | undefined)?.dasha_periods;
      // Re-fetch whenever any prerequisite is missing, so an earlier partial
      // fetch that was cached on the doc (e.g. from before the ascendant-merge
      // fix) cannot poison every retry forever.
      const needsDetailed =
        !hasPlanets(doc.parsed) ||
        !hasAscendant(doc.parsed) ||
        !Array.isArray(current) ||
        current.length === 0;
      if (needsDetailed && birth) {
        try {
          const detailed = await getKundli({
            coordinates: birth.coordinates,
            datetime: birth.datetime,
            ayanamsa: birth.ayanamsa,
            la: birth.la,
            detailed: true,
          });
          if (!hasPlanets(detailed.parsed)) {
            throw new Error("detailed chart is missing planet positions");
          }
          renderData = detailed.parsed;
          await updateKundali(doc.id, { parsed: detailed.parsed, raw: detailed.raw }).catch((e) =>
            logError(`${endpoint}/cache-detailed`, e),
          );
        } catch (e) {
          logError(`${endpoint}/report-refetch`, e);
        }
      }
      if (isFinancial) {
        const dasha = (renderData.data as Record<string, unknown> | undefined)?.dasha_periods;
        if (!hasPlanets(renderData) || !hasAscendant(renderData) || !Array.isArray(dasha) || dasha.length === 0) {
          throw new Error(
            "Financial report requires a complete chart (ascendant + planet positions + dasha periods); ProKerala data incomplete",
          );
        }
      }
    }

    // Financial + angle reports use our branded templates. Match Kundali uses
    // its own branded two-chart compatibility template from the stored
    // matching data. Anything else falls back to ProKerala's paragraph report.
    let pdf: Buffer | null = null;

    if (doc.reportType === "match_kundali" && doc.matching) {
      try {
        const { renderMatchReportPDF } = await import("./match-report.js");
        const nativeIsBoy = (doc.gender ?? "").toLowerCase().startsWith("m");
        const nativePlace = doc.place || birth?.place;
        pdf = await renderMatchReportPDF(
          { status: "ok", data: doc.matching } as never,
          {
            girlName: nativeIsBoy ? doc.partner?.name : name,
            boyName: nativeIsBoy ? name : doc.partner?.name,
            girlDatetime: nativeIsBoy ? doc.partner?.birth?.datetime : birth?.datetime,
            boyDatetime: nativeIsBoy ? birth?.datetime : doc.partner?.birth?.datetime,
            girlPlace: nativeIsBoy ? doc.partner?.birth?.place : nativePlace,
            boyPlace: nativeIsBoy ? nativePlace : doc.partner?.birth?.place,
            language: birth?.la,
            reportNo: doc.id.toUpperCase(),
          },
        );
        logInfo(`${endpoint} match report ready (${pdf.length} bytes)`);
      } catch (e) {
        logError(`${endpoint}/match-report`, e);
        pdf = null;
      }
    }

    const useProkeralaReport =
      !pdf &&
      (process.env.PROKERALA_PDF_REPORT ?? "true") !== "false" &&
      doc.reportType !== "financial_kundali" &&
      !isAngleReport(doc.reportType) &&
      doc.reportType !== "match_kundali";

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
            brandName: "Rashi Kundali",
            caption: "Generated by Rashi Kundali",
            footer: "rashikundali.com",
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

    // Upserts, so the order row is created here even for legacy/edge paths
    // where checkout's createOrder never ran (e.g. an order predating this flow).
    await markOrderCompleted(orderId, archive.id, downloadUrl, {
      cacheId: doc.id,
      email,
      name,
      reportType: doc.reportType,
      amount,
      currency: "INR",
      provider,
      paymentId,
      attribution: doc.attribution,
      createdAt: doc.createdAt ?? new Date(),
    }).catch((e) => logError(`${endpoint}/updateOrder`, e));

    // Server-side conversion (Meta CAPI + GA4 Measurement Protocol) exactly
    // once per kundali. The client also sends Purchase with the same
    // transaction_id / event_id so both sides deduplicate.
    if (await markKundaliConversionSent(doc.id)) {
      sendPurchaseConversion({
        orderId,
        value: amount,
        currency: "INR",
        email,
        name: name ?? undefined,
        reportType: doc.reportType,
        gaClientId: doc.attribution?.ga_client_id,
        eventSourceUrl: doc.attribution?.landing_page,
        fbp: doc.attribution?.fbp,
        fbc: doc.attribution?.fbc,
        clientIp: doc.attribution?.client_ip,
        userAgent: doc.attribution?.user_agent,
      }).catch((e) => logError(`${endpoint}/conversion`, e));
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
    await notifyFailureOnce(doc, orderId, e);
    await updateKundali(doc.id, { status: "paid" }).catch(() => {});
    return null;
  }
}
