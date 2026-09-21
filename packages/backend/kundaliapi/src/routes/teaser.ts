import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { getKundli } from "../lib/prokerala.js";
import { buildTeaser, LOCKED_SECTIONS } from "../lib/teaser.js";
import {
  getKundali,
  saveKundali,
  newId,
  REPORT_LABELS,
  type BirthDetails,
  type ReportType,
} from "../lib/store.js";
import { logGeneration, logError } from "../lib/logger.js";

const teaserApp = new OpenAPIHono();

const ReportTypeEnum = z.enum(["financial_kundali", "match_kundali"]);

const TeaserInput = z.object({
  reportType: ReportTypeEnum.optional().default("financial_kundali")
    .describe("Which kundali this teaser is for"),
  cacheId: z.string().optional()
    .describe("Return the stored teaser for an existing kundali instead of regenerating"),
  coordinates: z.string().optional().describe("lat,lon — e.g. 23.1765,75.7885"),
  datetime: z.string().optional().describe("ISO 8601 datetime with timezone offset"),
  ayanamsa: z.number().optional().default(1),
  la: z.string().optional().describe("Language: en, ta, ml, hi"),
  label: z.string().optional().describe("Name for the report"),
  name: z.string().optional().describe("Name for the report (alias of label)"),
  gender: z.string().optional(),
  place: z.string().optional().describe("Human-readable birthplace"),
  email: z.string().email().optional().describe("Used for report delivery"),
});

const MoneyAxisScoresSchema = z.object({
  wealthPotential: z.number().describe("1-10 score"),
  careerGrowth: z.number(),
  businessLuck: z.number(),
  propertyAssets: z.number(),
  investmentSense: z.number(),
  financialStability: z.number(),
});

const TeaserSchema = z.object({
  name: z.string(),
  birthDetails: z.object({
    date: z.string(),
    time: z.string(),
    location: z.string(),
  }),
  lagna: z.object({ name: z.string(), lord: z.string() }),
  rashi: z.object({ name: z.string(), lord: z.string() }),
  nakshatra: z.object({ name: z.string(), lord: z.string(), pada: z.number() }),
  planetSummary: z.array(z.object({ name: z.string(), sign: z.string() })),
  moneyAxisScores: MoneyAxisScoresSchema.optional(),
  mangalDosha: z.boolean(),
  majorYogas: z.number(),
});

const TeaserResponse = z.object({
  cacheId: z.string().describe("Use this ID after payment to get full report"),
  reportType: ReportTypeEnum,
  teaser: TeaserSchema,
  locked: z.array(z.string()).describe("List of locked sections available after payment"),
});

const teaserRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Kundali"],
  summary: "Generate free teaser (locked preview)",
  request: { body: { content: { "application/json": { schema: TeaserInput } } } },
  responses: {
    200: { description: "Teaser data with cache ID", content: { "application/json": { schema: TeaserResponse } } },
    400: { description: "Bad request", content: { "application/json": { schema: z.object({ error: z.string() }) } } },
  },
});

teaserApp.openapi(teaserRoute, async (c) => {
  const endpoint = "/kundali/teaser";
  try {
    const body = c.req.valid("json");
    logGeneration(endpoint, body);

    const reportType = body.reportType as ReportType;

    // Existing kundali: serve the stored teaser, no ProKerala call.
    if (body.cacheId) {
      const existing = await getKundali(body.cacheId);
      if (existing) {
        return c.json({
          cacheId: existing.id,
          reportType: existing.reportType,
          teaser: (existing.teaser ?? {}) as z.infer<typeof TeaserSchema>,
          locked: existing.locked ?? LOCKED_SECTIONS[existing.reportType],
        }, 200);
      }
    }

    if (!body.coordinates || !body.datetime) {
      return c.json({ error: "coordinates and datetime are required to generate a teaser" }, 400);
    }

    const { parsed, raw } = await getKundli({
      coordinates: body.coordinates,
      datetime: body.datetime,
      ayanamsa: body.ayanamsa,
      la: body.la,
    });

    const reportName = body.name || body.label || "Janam Kundali";
    const birth: BirthDetails = {
      coordinates: body.coordinates,
      datetime: body.datetime,
      ayanamsa: body.ayanamsa,
      la: body.la,
      name: reportName,
      gender: body.gender,
      place: body.place,
    };

    const { teaser, locked } = buildTeaser(reportType, parsed, reportName, birth);
    const cacheId = newId();

    await saveKundali({
      id: cacheId,
      reportType,
      reportLabel: REPORT_LABELS[reportType],
      email: body.email,
      name: reportName,
      gender: body.gender,
      place: body.place,
      birth,
      raw,
      parsed,
      teaser: teaser as unknown as Record<string, unknown>,
      locked,
      status: "teaser",
      createdAt: new Date(),
    });

    return c.json({ cacheId, reportType, teaser, locked }, 200);
  } catch (e) {
    logError(endpoint, e);
    return c.json({ error: String(e) }, 400);
  }
});

export { teaserApp };
