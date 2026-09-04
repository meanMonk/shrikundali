import { Hono } from "hono";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { getKundli } from "../lib/prokerala.js";
import { cacheChart } from "../lib/cache.js";
import { logGeneration, logError } from "../lib/logger.js";

const teaserApp = new OpenAPIHono();

const TeaserInput = z.object({
  coordinates: z.string().describe("lat,lon — e.g. 23.1765,75.7885"),
  datetime: z.string().describe("ISO 8601 datetime with timezone offset"),
  ayanamsa: z.number().optional().default(1),
  la: z.string().optional().describe("Language: en, ta, ml, hi"),
  label: z.string().optional().describe("Name for the report"),
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

function val(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
}

function str(v: unknown, fallback = "N/A"): string {
  if (v == null || v === "") return fallback;
  return String(v);
}

function calculateMoneyAxisScores(data: Record<string, unknown>): {
  wealthPotential: number;
  careerGrowth: number;
  businessLuck: number;
  propertyAssets: number;
  investmentSense: number;
  financialStability: number;
} {
  const planets = (data.planet_positions ?? data.planets) as Record<string, unknown>[] | undefined;
  const yogas = (data.yoga_details ?? []) as Record<string, unknown>[];

  let jupiterStrength = 5;
  let venusStrength = 5;
  let saturnStrength = 5;
  let mercuryStrength = 5;

  if (planets) {
    for (const p of planets) {
      const name = str(val(p, "planet_name") ?? val(p, "name")).toLowerCase();
      const degree = Number(val(p, "degree")) || 0;

      if (name === "jupiter" || name === "guru") jupiterStrength = Math.min(10, 5 + Math.floor(degree / 30));
      if (name === "venus" || name === "shukra") venusStrength = Math.min(10, 5 + Math.floor(degree / 30));
      if (name === "saturn" || name === "shani") saturnStrength = Math.min(10, 5 + Math.floor(degree / 30));
      if (name === "mercury" || name === "budh") mercuryStrength = Math.min(10, 5 + Math.floor(degree / 30));
    }
  }

  const hasLakshmiYoga = yogas.some(y => str(val(y, "yoga_name") ?? val(y, "name")).toLowerCase().includes("lakshmi"));
  const hasDhanaYoga = yogas.some(y => str(val(y, "yoga_name") ?? val(y, "name")).toLowerCase().includes("dhana"));

  const bonus = (hasLakshmiYoga ? 1 : 0) + (hasDhanaYoga ? 1 : 0);

  return {
    wealthPotential: Math.min(10, Math.round((jupiterStrength + venusStrength) / 2 + bonus)),
    careerGrowth: Math.min(10, Math.round((saturnStrength + mercuryStrength) / 2 + bonus)),
    businessLuck: Math.min(10, Math.round((jupiterStrength + mercuryStrength) / 2 + bonus)),
    propertyAssets: Math.min(10, Math.round((saturnStrength + venusStrength) / 2)),
    investmentSense: Math.min(10, Math.round((mercuryStrength + saturnStrength) / 2)),
    financialStability: Math.min(10, Math.round((jupiterStrength + saturnStrength) / 2 + bonus)),
  };
}

const teaserRoute = createRoute({
  method: "post",
  path: "/teaser",
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

    const cacheId = await cacheChart(raw, parsed, body.email, body.label, 60);

    const d = parsed.data;
    const nd = val(d, "nakshatra_details") as Record<string, unknown> | undefined;
    const nakshatra = val(nd, "nakshatra") as Record<string, unknown> | undefined;
    const chandraRasi = val(nd, "chandra_rasi") as Record<string, unknown> | undefined;
    const zodiac = val(nd, "zodiac") as Record<string, unknown> | undefined;
    const lord = val(nakshatra, "lord") as Record<string, unknown> | undefined;
    const rasiLord = val(chandraRasi, "lord") as Record<string, unknown> | undefined;
    const md = val(d, "mangal_dosha") as Record<string, unknown> | undefined;
    const yogas = (d.yoga_details ?? []) as Record<string, unknown>[];

    const planets = ((d.planet_positions ?? d.planets) ?? []) as Record<string, unknown>[];
    const planetSummary = planets.slice(0, 9).map(p => ({
      name: str(val(p, "planet_name") ?? val(p, "name")),
      sign: str(val(p, "sign_name") ?? val(p, "rashi")),
    }));

    return c.json({
      cacheId,
      teaser: {
        name: body.label || "Janam Kundali",
        birthDetails: {
          date: body.datetime.split("T")[0] ?? "",
          time: body.datetime.split("T")[1]?.split("+")[0] ?? body.datetime,
          location: body.coordinates,
        },
        lagna: {
          name: str(val(nd, "lagna_name")),
          lord: str(val(nd, "lagna_lord")),
        },
        rashi: {
          name: str(chandraRasi, "N/A"),
          lord: str(rasiLord, "N/A"),
        },
        nakshatra: {
          name: str(nakshatra, "N/A"),
          lord: str(lord, "N/A"),
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
