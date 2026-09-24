import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { logInfo, logError } from "../lib/logger.js";
import { readArchiveFile } from "../lib/archive.js";
import { getKundaliByArchiveId, markKundaliDownloadNotified } from "../lib/store.js";
import { getOrderByOrderId } from "../lib/orders.js";
import { notifyAdminDownload } from "../lib/telegram.js";

const downloadApp = new OpenAPIHono();

// Only the PDF format is ever linked to a customer (report.ts's downloadUrl
// is always `/download/:archiveId/pdf`, sent by email/Telegram/checkout).
// The markdown/json archive files still get written for internal record
// (see lib/report.ts's addArchiveFile), but nothing serves them publicly —
// so the route only accepts "pdf" and skips any generation work entirely.
const downloadRoute = createRoute({
  method: "get",
  path: "/:archiveId/:format",
  tags: ["Download"],
  summary: "Download generated report (PDF)",
  responses: {
    200: { description: "Report PDF" },
    404: { description: "Report not found" },
  },
});

downloadApp.openapi(downloadRoute, async (c) => {
  const endpoint = "/download";
  try {
    const archiveId = c.req.param("archiveId");
    const format = c.req.param("format");
    if (format !== "pdf") {
      return c.json({ error: "Report not found" }, 404);
    }

    const data = await readArchiveFile(archiveId, "report.pdf");
    if (!data) {
      return c.json({ error: "Report not found or not yet generated" }, 404);
    }

    // Refunded orders lose download access — checked here too because this
    // route is keyed by archive id (shared in emails), not order id.
    const doc0 = await getKundaliByArchiveId(archiveId);
    if (doc0?.orderId) {
      const order = await getOrderByOrderId(doc0.orderId).catch(() => null);
      if (order?.status === "refunded") {
        return c.json({ error: "This order was refunded, so the report is no longer available for download." }, 410);
      }
    }

    logInfo(`${endpoint} serving pdf for ${archiveId}`);

    // Admin download alert, once per kundali.
    const doc = await getKundaliByArchiveId(archiveId);
    if (doc && (await markKundaliDownloadNotified(doc.id))) {
      notifyAdminDownload({
        name: doc.name,
        email: doc.email,
        reportType: doc.reportLabel ?? "Financial Kundali Report",
        paymentId: doc.orderId ?? archiveId,
        paymentProvider: doc.provider ?? "razorpay",
        archiveId,
      }).catch((e) => logError(`${endpoint}/telegram`, e));
    }

    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="kundali-${archiveId}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    logError(endpoint, e);
    return c.json({ error: String(e) }, 500);
  }
});

export { downloadApp };
