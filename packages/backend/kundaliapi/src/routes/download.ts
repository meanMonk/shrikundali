import { Hono } from "hono";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { logInfo, logError } from "../lib/logger.js";

const downloadApp = new OpenAPIHono();

const ARCHIVE_DIR = join(process.cwd(), "archive", "uploads");

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
    const filePath = join(ARCHIVE_DIR, archiveId, `report.${ext}`);

    try {
      const data = await readFile(filePath);

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

      return new Response(data, {
        headers: {
          "Content-Type": contentTypes[format] ?? "application/octet-stream",
          "Content-Disposition": `attachment; filename="${filenames[format]}"`,
          "Cache-Control": "no-store",
        },
      });
    } catch {
      return c.json({ error: "Report not found or not yet generated" }, 404);
    }
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
    const dir = join(ARCHIVE_DIR, archiveId);

    try {
      const { access } = await import("node:fs/promises");
      await access(dir);

      const files: string[] = [];
      const { readdir } = await import("node:fs/promises");
      const entries = await readdir(dir);
      files.push(...entries);

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
    } catch {
      return c.json({ error: "Report not found" }, 404);
    }
  } catch (e) {
    logError(endpoint, e);
    return c.json({ error: String(e) }, 500);
  }
});

export { downloadApp };
