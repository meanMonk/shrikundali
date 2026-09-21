import { Hono } from "hono";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { logInfo, logError } from "../lib/logger.js";
import { readArchiveFile, archiveExists, listArchiveFiles } from "../lib/archive.js";
import { getKundaliByArchiveId, markKundaliDownloadNotified } from "../lib/store.js";
import { notifyAdminDownload } from "../lib/telegram.js";

const downloadApp = new OpenAPIHono();

const DownloadInput = z.object({
  archiveId: z.string().describe("Archive ID from webhook response or email"),
  format: z.enum(["pdf", "markdown", "json"]).default("pdf"),
});

const downloadRoute = createRoute({
  method: "get",
  path: "/:archiveId/:format",
  tags: ["Download"],
  summary: "Download generated report",
  responses: {
    200: { description: "Report file" },
    404: { description: "Report not found" },
  },
});

downloadApp.openapi(downloadRoute, async (c) => {
  const endpoint = "/download";
  try {
    const archiveId = c.req.param("archiveId");
    const format = c.req.param("format") as "pdf" | "markdown" | "json";
    const ext = format === "pdf" ? "pdf" : format === "markdown" ? "md" : "json";

    const data = await readArchiveFile(archiveId, `report.${ext}`);
    if (!data) {
      return c.json({ error: "Report not found or not yet generated" }, 404);
    }

    const contentTypes: Record<string, string> = {
      pdf: "application/pdf",
      markdown: "text/markdown; charset=utf-8",
      json: "application/json",
    };

    const filenames: Record<string, string> = {
      pdf: `kundali-${archiveId}.pdf`,
      markdown: `kundali-${archiveId}.md`,
      json: `kundali-${archiveId}.json`,
    };

    logInfo(`${endpoint} serving ${format} for ${archiveId}`);

    // Admin download alert, once per kundali, for the PDF report.
    if (format === "pdf") {
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
    }

    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": contentTypes[format] ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filenames[format]}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    logError(endpoint, e);
    return c.json({ error: String(e) }, 500);
  }
});

const statusRoute = createRoute({
  method: "get",
  path: "/:archiveId/status",
  tags: ["Download"],
  summary: "Check report generation status",
  responses: {
    200: { description: "Report status" },
    404: { description: "Report not found" },
  },
});

downloadApp.openapi(statusRoute, async (c) => {
  const endpoint = "/download/status";
  try {
    const archiveId = c.req.param("archiveId");

    const exists = await archiveExists(archiveId);
    if (!exists) {
      return c.json({ error: "Report not found" }, 404);
    }

    const files = await listArchiveFiles(archiveId);
    const hasPdf = files.includes("report.pdf");
    const hasMd = files.includes("report.md");
    const hasJson = files.includes("report.json");

    let status: string;
    if (hasPdf) {
      status = "completed";
    } else if (hasMd) {
      status = "partial";
    } else {
      status = "processing";
    }

    logInfo(`${endpoint} ${archiveId}: ${status}`);

    return c.json({
      archiveId,
      status,
      available: {
        pdf: hasPdf,
        markdown: hasMd,
        json: hasJson,
      },
    }, 200);
  } catch (e) {
    logError(endpoint, e);
    return c.json({ error: String(e) }, 500);
  }
});

export { downloadApp };
