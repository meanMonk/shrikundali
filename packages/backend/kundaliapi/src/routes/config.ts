import { Hono } from "hono";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { logInfo } from "../lib/logger.js";
import { REPORT_PRICING } from "../lib/pricing.js";

const configApp = new OpenAPIHono();

const ReportConfigSchema = z.object({
  reportType: z.string(),
  title: z.string(),
  description: z.string(),
  price: z.number(),
  discountPrice: z.number().optional(),
  currency: z.string(),
  ctaText: z.string(),
  countdownMinutes: z.number(),
  refundPolicy: z.string(),
  features: z.array(z.string()),
  deliveryNote: z.string(),
});

const DEFAULT_CONFIGS: Record<string, z.infer<typeof ReportConfigSchema>> = {
  financial_kundali: {
    reportType: "financial_kundali",
    title: "Financial Kundali Report",
    description: "Unlock your financial destiny with Vedic astrology. Get personalized insights on wealth, career, investments, and money management based on your birth chart.",
    price: REPORT_PRICING.financial_kundali.listPrice,
    discountPrice: REPORT_PRICING.financial_kundali.discountPrice,
    currency: "INR",
    ctaText: "Download Full Report",
    countdownMinutes: 15,
    refundPolicy: "Full refund within 24 hours of purchase, no questions asked.",
    features: [
      "6 Money-Axis Scores (Wealth, Career, Business, Property, Investment, Stability)",
      "Detailed Planet Positions & Degrees",
      "House (Bhava) Analysis",
      "Dasha Periods & Timing",
      "Complete Yoga Interpretations",
      "Dosha Analysis & Remedies",
      "Numerology Insights",
      "PDF Report Download",
    ],
    deliveryNote: "Your report will be emailed and available for instant download after payment.",
  },
  match_kundali: {
    reportType: "match_kundali",
    title: "Match Kundali Report",
    description: "Compare two birth charts for compatibility analysis. Get detailed insights on mental, physical, and financial compatibility.",
    price: REPORT_PRICING.match_kundali.listPrice,
    discountPrice: REPORT_PRICING.match_kundali.discountPrice,
    currency: "INR",
    ctaText: "Download Match Report",
    countdownMinutes: 15,
    refundPolicy: "Full refund within 24 hours of purchase, no questions asked.",
    features: [
      "Gun Milan Analysis",
      "Mental Compatibility",
      "Physical Compatibility",
      "Financial Compatibility",
      "Detailed Compatibility Report",
      "PDF Report Download",
    ],
    deliveryNote: "Your match report will be emailed and available for instant download after payment.",
  },
};

const configRoute = createRoute({
  method: "get",
  path: "/:reportType",
  tags: ["Config"],
  summary: "Get report configuration (frontend-configurable values)",
  responses: {
    200: { description: "Report config", content: { "application/json": { schema: ReportConfigSchema } } },
    404: { description: "Report type not found" },
  },
});

configApp.openapi(configRoute, async (c) => {
  const reportType = c.req.param("reportType");

  const config = DEFAULT_CONFIGS[reportType];
  if (!config) {
    return c.json({ error: `Unknown report type: ${reportType}` }, 404);
  }

  logInfo(`/config/${reportType} served`);
  return c.json(config, 200);
});

const allConfigsRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Config"],
  summary: "Get all available report configurations",
  responses: {
    200: { description: "All report configs" },
  },
});

configApp.openapi(allConfigsRoute, async (c) => {
  logInfo("/config served (all)");
  return c.json(Object.values(DEFAULT_CONFIGS), 200);
});

export { configApp };
