import { Hono } from "hono";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { getKundli } from "../lib/prokerala.js";
import { cacheChart } from "../lib/cache.js";
import { calculateMoneyAxisScores, val, str } from "../lib/scores.js";
import { logGeneration, logError } from "../lib/logger.js";

const teaserApp = new OpenAPIHono();

const TeaserInput = z.object({
  coordinates: z.string().describe("lat,lon — e.g. 23.1765,75.7885"),
  datetime: z.string().describe("ISO 8601 datetime with timezone offset"),
  ayanamsa: z.number().optional().default(1),
  la: z.string().optional().describe("Language: en, ta, ml, hi"),
  label: z.string().optional().describe("Name for the report"),
  name: z.string().optional().describe("Name for the report (alias of label)"),
  gender: z.string().optional(),
  place: z.string().optional().describe("Human-readable birthplace"),
  email: z.string().email().describe("Required — used for report delivery"),
});

const TeaserResponse = z.object({
  cacheId: z.string().describe("Use this ID after payment to get full report"),
  teaser: z.object({
    name: z.string(),
    birthDetails: z.object({
      date: z.string(),
      time: z.string(),
      location: z.string(),
    }),
    lagna: z.object({
      name: z.string(),
      lord: z.string(),
    }),
    rashi: z.object({
      name: z.string(),
      lord: z.string(),
    }),
    nakshatra: z.object({
      name: z.string(),
      lord: z.string(),
      pada: z.number(),
    }),
    planetSummary: z.array(z.object({
      name: z.string(),
      sign: z.string(),
    })),
    moneyAxisScores: z.object({
      wealthPotential: z.number().describe("1-10 score"),
      careerGrowth: z.number(),
      businessLuck: z.number(),
      propertyAssets: z.number(),
      investmentSense: z.number(),
      financialStability: z.number(),
    }),
    mangalDosha: z.boolean(),
    majorYogas: z.number(),
  }),
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

    const { parsed, raw } = await getKundli({
      coordinates: body.coordinates,
      datetime: body.datetime,
      ayanamsa: body.ayanamsa,
      la: body.la,
    });

    const reportName = body.name || body.label || "Janam Kundali";

    const cacheId = await cacheChart(
      raw,
      parsed,
      body.email,
      reportName,
      60,
      {
        coordinates: body.coordinates,
        datetime: body.datetime,
        ayanamsa: body.ayanamsa,
        la: body.la,
        name: reportName,
        gender: body.gender,
        place: body.place,
      },
    );

    const d = parsed.data;
    const nd = val(d, "nakshatra_details") as Record<string, unknown> | undefined;
    const nakshatra = val(nd, "nakshatra") as Record<string, unknown> | undefined;
    const chandraRasi = val(nd, "chandra_rasi") as Record<string, unknown> | undefined;
    const nakLord = val(nakshatra, "lord") as Record<string, unknown> | undefined;
    const rasiLord = val(chandraRasi, "lord") as Record<string, unknown> | undefined;
    const md = val(d, "mangal_dosha") as Record<string, unknown> | undefined;
    const yogas = (d.yoga_details ?? []) as Record<string, unknown>[];

    const planets = ((d.planet_positions ?? d.planets) ?? []) as Record<string, unknown>[];
    const ascendant = planets.find(
      (p) => str(val(p, "name")).toLowerCase() === "ascendant",
    );
    const ascRasi = val(ascendant, "rasi") as Record<string, unknown> | undefined;
    const ascLord = val(ascRasi, "lord") as Record<string, unknown> | undefined;

    const planetSummary = planets
      .filter((p) => str(val(p, "name")).toLowerCase() !== "ascendant")
      .slice(0, 9)
      .map((p) => {
        const rasi = val(p, "rasi") as Record<string, unknown> | undefined;
        return {
          name: str(val(p, "planet_name") ?? val(p, "name")),
          sign: str(val(rasi, "name") ?? val(p, "sign_name")),
        };
      });

    return c.json({
      cacheId,
      teaser: {
        name: reportName,
        birthDetails: {
          date: body.datetime.split("T")[0] ?? "",
          time: body.datetime.split("T")[1]?.split("+")[0] ?? body.datetime,
          location: body.coordinates,
        },
        lagna: {
          name: str(val(ascRasi, "name")),
          lord: str(val(ascLord, "name")),
        },
        rashi: {
          name: str(val(chandraRasi, "name")),
          lord: str(val(rasiLord, "name")),
        },
        nakshatra: {
          name: str(val(nakshatra, "name")),
          lord: str(val(nakLord, "name")),
          pada: Number(val(nakshatra, "pada")) || 0,
        },
        planetSummary,
        moneyAxisScores: calculateMoneyAxisScores(d as Record<string, unknown>),
        mangalDosha: Boolean(val(md, "has_dosha")),
        majorYogas: yogas.length,
      },
      locked: [
        "Detailed planet positions & degrees",
        "House (Bhava) analysis",
        "Dasha periods & timing",
        "Complete yoga interpretations",
        "Dosha analysis & remedies",
        "Numerology insights",
        "Full PDF report download",
      ],
    }, 200);
  } catch (e) {
    logError(endpoint, e);
    return c.json({ error: String(e) }, 400);
  }
});

export { teaserApp };
