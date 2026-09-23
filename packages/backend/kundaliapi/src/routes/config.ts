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
  marriage_kundali: {
    reportType: "marriage_kundali",
    title: "Marriage Kundali Report",
    description: "Know your marriage timing, the strength of your 7th house, and the planetary periods that favour or delay marriage — from your exact birth chart.",
    price: REPORT_PRICING.marriage_kundali.listPrice,
    discountPrice: REPORT_PRICING.marriage_kundali.discountPrice,
    currency: "INR",
    ctaText: "Download Marriage Report",
    countdownMinutes: 15,
    refundPolicy: "Full refund within 24 hours of purchase, no questions asked.",
    features: [
      "7th house & marriage-timing analysis",
      "Venus & Jupiter placement reading",
      "Favourable marriage windows (dasha)",
      "Delay & dosha checks with remedies",
      "Compatibility pointers",
      "Full PDF report download",
    ],
    deliveryNote: "Your report will be emailed and available for instant download after payment.",
  },
  career_kundali: {
    reportType: "career_kundali",
    title: "Career Kundali Report",
    description: "Discover your strongest career periods, ideal fields of work, and the windows for job changes, promotions or starting a business — from your exact birth chart.",
    price: REPORT_PRICING.career_kundali.listPrice,
    discountPrice: REPORT_PRICING.career_kundali.discountPrice,
    currency: "INR",
    ctaText: "Download Career Report",
    countdownMinutes: 15,
    refundPolicy: "Full refund within 24 hours of purchase, no questions asked.",
    features: [
      "10th house & career-path analysis",
      "Saturn, Sun & Mars strength reading",
      "Job-change & promotion windows (dasha)",
      "Business vs. job suitability",
      "Periods to avoid major moves",
      "Full PDF report download",
    ],
    deliveryNote: "Your report will be emailed and available for instant download after payment.",
  },
  dosha_report: {
    reportType: "dosha_report",
    title: "Dosha Report",
    description: "Check Manglik, Kaal Sarp, Pitra and Shani (Sade Sati) doshas in your chart, with simple practical remedies — from your exact birth chart.",
    price: REPORT_PRICING.dosha_report.listPrice,
    discountPrice: REPORT_PRICING.dosha_report.discountPrice,
    currency: "INR",
    ctaText: "Download Dosha Report",
    countdownMinutes: 15,
    refundPolicy: "Full refund within 24 hours of purchase, no questions asked.",
    features: [
      "Manglik (Mangal) dosha check",
      "Kaal Sarp dosha check",
      "Pitra & Shani dosha check",
      "Sade Sati status",
      "Simple, practical remedies",
      "Full PDF report download",
    ],
    deliveryNote: "Your report will be emailed and available for instant download after payment.",
  },
  health_kundali: {
    reportType: "health_kundali",
    title: "Health Kundali Report",
    description: "Identify your health-sensitive planetary periods and get simple preventive guidance, alongside your full Kundali — from your exact birth chart.",
    price: REPORT_PRICING.health_kundali.listPrice,
    discountPrice: REPORT_PRICING.health_kundali.discountPrice,
    currency: "INR",
    ctaText: "Download Health Report",
    countdownMinutes: 15,
    refundPolicy: "Full refund within 24 hours of purchase, no questions asked.",
    features: [
      "6th house & vitality analysis",
      "Health-sensitive planetary periods",
      "Saturn & Mars affliction reading",
      "Preventive guidance",
      "Simple remedies",
      "Full PDF report download",
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
