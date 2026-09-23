import { REPORT_PRICING } from "./pricing.js";
import type { ReportType } from "./store.js";
import {
  getAllPricingDocs,
  upsertPricingDoc,
  type ReportPricingDoc,
} from "./pricing-store.js";

/** Shared presets so the CLI script and the Telegram bot stay in lockstep. */

export type PricingPreset = "test" | "actual";

export const PRICING_TYPES = Object.keys(REPORT_PRICING) as ReportType[];

/** ₹9 flat price used while testing the payment flow end-to-end. */
export const TEST_PRICE = 9;

export function presetPatch(
  preset: PricingPreset,
  reportType: ReportType,
): Parameters<typeof upsertPricingDoc>[1] {
  const p = REPORT_PRICING[reportType];
  if (preset === "test") {
    return {
      amount: TEST_PRICE,
      discountPrice: TEST_PRICE,
      listPrice: p.listPrice,
      offerLabel: "TEST ₹9",
      note: `test pricing (₹${TEST_PRICE})`,
    };
  }
  return {
    amount: p.amount,
    discountPrice: p.discountPrice,
    listPrice: p.listPrice,
    offerLabel: "",
    note: "restored to launch pricing",
  };
}

export async function applyPricingPreset(
  preset: PricingPreset,
  updatedBy = "bot",
): Promise<ReportPricingDoc[]> {
  for (const t of PRICING_TYPES) {
    await upsertPricingDoc(t, presetPatch(preset, t), updatedBy);
  }
  return getAllPricingDocs();
}

/** Telegram-friendly (Markdown) pricing table. */
export function formatPricing(docs: ReportPricingDoc[]): string {
  const lines: string[] = [];
  const isTest = docs.length > 0 && docs.every((d) => d.amount === TEST_PRICE);
  lines.push(`💰 *Current Pricing*${isTest ? " (TEST MODE — ₹" + TEST_PRICE + ")" : ""}`);
  lines.push("");
  for (const d of docs) {
    const was = d.listPrice > d.discountPrice ? `  ~~₹${d.listPrice}~~` : "";
    const state = d.active === false ? " _(inactive)_" : "";
    lines.push(`• ${d.reportType}: *₹${d.discountPrice}*${was} (charge ₹${d.amount})${state}`);
  }
  return lines.join("\n");
}
