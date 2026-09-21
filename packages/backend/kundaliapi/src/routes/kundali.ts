import { Hono } from "hono";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { getKundli } from "../lib/prokerala.js";
import { renderMarkdown, renderPDF } from "../lib/render.js";
import { archiveKundali, archiveRaw } from "../lib/archive.js";
import { saveKundali, newId, REPORT_LABELS } from "../lib/store.js";
import { logGeneration, logError, rotateLogs } from "../lib/logger.js";

const kundaliApp = new OpenAPIHono();

rotateLogs().catch(() => {});

/* ── Zod schemas ──────────────────────────────────────── */

const KundaliInput = z.object({
  coordinates: z.string().describe("lat,lon — e.g. 23.1765,75.7885"),
  datetime: z.string().describe("ISO 8601 datetime with timezone offset — e.g. 2026-09-04T09:54:15+05:30"),
  ayanamsa: z.number().optional().default(1).describe("1=Lahiri, 3=Raman, 5=KP"),
  la: z.string().optional().describe("Language: en, ta, ml, hi"),
  label: z.string().optional().describe("Name/title for the report"),
});

const ErrorResponse = z.object({ error: z.string() });

const KundliSchema = z.object({
  status: z.string(),
  data: z.record(z.unknown()),
});

/** Persist one kundali document so every generated chart is stored in Mongo. */
async function persistKundali(
  body: { coordinates: string; datetime: string; ayanamsa?: number; la?: string; label?: string },
  raw: Record<string, unknown>,
  parsed: { status: string; data: Record<string, unknown> },
): Promise<string> {
  const id = newId();
  await saveKundali({
    id,
    reportType: "financial_kundali",
    reportLabel: body.label || REPORT_LABELS.financial_kundali,
    name: body.label,
    birth: {
      coordinates: body.coordinates,
      datetime: body.datetime,
      ayanamsa: body.ayanamsa,
      la: body.la,
      name: body.label,
    },
    raw,
    parsed,
    status: "teaser",
    createdAt: new Date(),
  });
  return id;
}

/* ── POST /kundali/generate ───────────────────────────── */

const generateRoute = createRoute({
  method: "post",
  path: "/generate",
  tags: ["Kundali"],
  summary: "Generate Kundali (JSON)",
  request: { body: { content: { "application/json": { schema: KundaliInput } } } },
  responses: {
    200: { description: "Kundali data", content: { "application/json": { schema: KundliSchema } } },
    400: { description: "Bad request", content: { "application/json": { schema: ErrorResponse } } },
  },
});

kundaliApp.openapi(generateRoute, async (c) => {
  const endpoint = "/kundali/generate";
  try {
    const body = c.req.valid("json");
    logGeneration(endpoint, body);
    const { parsed, raw } = await getKundli({
      coordinates: body.coordinates,
      datetime: body.datetime,
      ayanamsa: body.ayanamsa,
      la: body.la,
    });
    const archive = await archiveKundali(endpoint, body, raw, parsed);
    const kundaliId = await persistKundali(body, raw, parsed);
    return c.json({ ...parsed, _archive: archive, _kundaliId: kundaliId }, 200);
  } catch (e) {
    logError(endpoint, e);
    return c.json({ error: String(e) }, 400);
  }
});

/* ── POST /kundali/markdown ───────────────────────────── */

const markdownRoute = createRoute({
  method: "post",
  path: "/markdown",
  tags: ["Kundali"],
  summary: "Generate Kundali report as Markdown",
  request: { body: { content: { "application/json": { schema: KundaliInput } } } },
  responses: {
    200: { description: "Markdown report", content: { "text/markdown": { schema: z.string() } } },
    400: { description: "Bad request", content: { "application/json": { schema: ErrorResponse } } },
  },
});

kundaliApp.openapi(markdownRoute, async (c) => {
  const endpoint = "/kundali/markdown";
  try {
    const body = c.req.valid("json");
    logGeneration(endpoint, body);
    const { parsed, raw } = await getKundli({
      coordinates: body.coordinates,
      datetime: body.datetime,
      ayanamsa: body.ayanamsa,
      la: body.la,
    });
    const md = renderMarkdown(parsed, body.label, {
      name: body.label,
      datetime: body.datetime,
      coordinates: body.coordinates,
      ayanamsa: body.ayanamsa,
      language: body.la,
    });
    const archive = await archiveRaw(endpoint, body, "markdown", raw, md);
    const kundaliId = await persistKundali(body, raw, parsed);
    return new Response(md, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "X-Archive-Id": archive.id,
        "X-Archive-Dir": archive.dir,
        "X-Kundali-Id": kundaliId,
      },
    });
  } catch (e) {
    logError(endpoint, e);
    return c.json({ error: String(e) }, 400);
  }
});

/* ── POST /kundali/pdf ────────────────────────────────── */

const pdfRoute = createRoute({
  method: "post",
  path: "/pdf",
  tags: ["Kundali"],
  summary: "Generate Kundali report as PDF",
  request: { body: { content: { "application/json": { schema: KundaliInput } } } },
  responses: {
    200: { description: "PDF report", content: { "application/pdf": { schema: z.string() } } },
    400: { description: "Bad request", content: { "application/json": { schema: ErrorResponse } } },
  },
});

kundaliApp.openapi(pdfRoute, async (c) => {
  const endpoint = "/kundali/pdf";
  try {
    const body = c.req.valid("json");
    logGeneration(endpoint, body);
    const { parsed, raw } = await getKundli({
      coordinates: body.coordinates,
      datetime: body.datetime,
      ayanamsa: body.ayanamsa,
      la: body.la,
    });
    const pdf = await renderPDF(parsed, body.label, {
      name: body.label,
      datetime: body.datetime,
      coordinates: body.coordinates,
      ayanamsa: body.ayanamsa,
      language: body.la,
    });
    const archive = await archiveRaw(endpoint, body, "pdf", raw, pdf);
    const kundaliId = await persistKundali(body, raw, parsed);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="kundali-${archive.id}.pdf"`,
        "X-Archive-Id": archive.id,
        "X-Archive-Dir": archive.dir,
        "X-Kundali-Id": kundaliId,
      },
    });
  } catch (e) {
    logError(endpoint, e);
    return c.json({ error: String(e) }, 400);
  }
});

export { kundaliApp };
