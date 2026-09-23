import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { getKundli, getKundliMatching, type MatchingData, type KundliData } from "../lib/prokerala.js";
import { buildTeaser, LOCKED_SECTIONS } from "../lib/teaser.js";
import { buildMatchSummary } from "../lib/match-report.js";
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

const ReportTypeEnum = z.enum([
  "financial_kundali",
  "marriage_kundali",
  "career_kundali",
  "dosha_report",
  "match_kundali",
  "health_kundali",
]);

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
  attribution: z.record(z.string()).optional()
    .describe("UTM / gclid / fbclid / fbp / fbc for ad attribution"),
  partner: z.object({
    name: z.string().optional(),
    gender: z.string().optional(),
    datetime: z.string().optional().describe("Partner ISO 8601 birth datetime"),
    coordinates: z.string().optional().describe("Partner lat,lon"),
    place: z.string().optional(),
  }).optional().describe("Second person's birth details (match_kundali only)"),
});

const MatchingSummarySchema = z.object({
  totalPoints: z.number(),
  maximumPoints: z.number(),
  percentage: z.number(),
  band: z.string(),
  recommendation: z.string(),
  girl: z.object({ nakshatra: z.string(), pada: z.string(), rasi: z.string(), lord: z.string() }),
  boy: z.object({ nakshatra: z.string(), pada: z.string(), rasi: z.string(), lord: z.string() }),
  koots: z.array(
    z.object({ koota: z.string(), max: z.number(), girl: z.string(), boy: z.string(), note: z.string() }),
  ),
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
  matching: MatchingSummarySchema.optional(),
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
        const storedMatching = existing.matching
          ? buildMatchSummary({ status: "ok", data: existing.matching } as unknown as MatchingData)
          : undefined;
        return c.json({
          cacheId: existing.id,
          reportType: existing.reportType,
          teaser: {
            ...(existing.teaser ?? {}),
            ...(storedMatching ? { matching: storedMatching } : {}),
          } as z.infer<typeof TeaserSchema>,
          locked: existing.locked ?? LOCKED_SECTIONS[existing.reportType],
        }, 200);
      }
    }

    if (!body.coordinates || !body.datetime) {
      return c.json({ error: "coordinates and datetime are required to generate a teaser" }, 400);
    }

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

    // The match_kundali teaser is driven entirely by /kundli-matching — the
    // native person's own chart (lagna/rashi/nakshatra) is never shown for
    // this report type, so skip fetching it and save 3 ProKerala credits.
    const isMatch = reportType === "match_kundali";
    const { parsed, raw } = isMatch
      ? { parsed: { status: "ok", data: {} } as KundliData, raw: {} as Record<string, unknown> }
      : await getKundli({
          coordinates: body.coordinates,
          datetime: body.datetime,
          ayanamsa: body.ayanamsa,
          la: body.la,
        });

    // Match Kundali needs both charts: compare the native with the partner.
    let matching: MatchingData | null = null;
    if (isMatch && body.partner?.datetime && body.partner?.coordinates) {
      const nativeIsBoy = (body.gender ?? "").toLowerCase().startsWith("m");
      const girl = nativeIsBoy
        ? { datetime: body.partner.datetime, coordinates: body.partner.coordinates }
        : { datetime: body.datetime, coordinates: body.coordinates };
      const boy = nativeIsBoy
        ? { datetime: body.datetime, coordinates: body.coordinates }
        : { datetime: body.partner.datetime, coordinates: body.partner.coordinates };
      try {
        matching = await getKundliMatching({
          girlDob: girl.datetime,
          girlCoordinates: girl.coordinates,
          boyDob: boy.datetime,
          boyCoordinates: boy.coordinates,
          ayanamsa: body.ayanamsa,
          la: body.la,
        });
      } catch (e) {
        logError(`${endpoint}/matching`, e);
      }
    }

    const { teaser, locked } = buildTeaser(reportType, parsed, reportName, birth);
    const matchingSummary = matching ? buildMatchSummary(matching) : undefined;
    const teaserOut = matchingSummary ? { ...teaser, matching: matchingSummary } : teaser;
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
      teaser: teaserOut as unknown as Record<string, unknown>,
      locked,
      attribution: body.attribution,
      partner: body.partner
        ? {
            name: body.partner.name,
            gender: body.partner.gender,
            birth: {
              coordinates: body.partner.coordinates ?? "",
              datetime: body.partner.datetime ?? "",
              place: body.partner.place,
            },
          }
        : undefined,
      matching: matching?.data as Record<string, unknown> | undefined,
      status: "teaser",
      createdAt: new Date(),
    });

    return c.json({ cacheId, reportType, teaser: teaserOut, locked }, 200);
  } catch (e) {
    logError(endpoint, e);
    return c.json({ error: String(e) }, 400);
  }
});

export { teaserApp };
