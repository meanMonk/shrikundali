/**
 * Switch report pricing without a redeploy.
 *
 *   pnpm --filter kundaliapi pricing:set test      # every report → ₹9 (for testing)
 *   pnpm --filter kundaliapi pricing:set actual    # restore the real prices
 *   pnpm --filter kundaliapi pricing:set show      # print current DB prices
 *
 * Reads MONGODB_URI / DB_NAME from the environment (.env is loaded). For local
 * testing against a local Mongo, pass an override, e.g.:
 *
 *   MONGODB_URI=mongodb://localhost:27017/app_kundaliapi \
 *     pnpm --filter kundaliapi pricing:set test
 */
import "dotenv/config";
import {
  getAllPricingDocs,
  seedPricingDocs,
  upsertPricingDoc,
} from "../src/lib/pricing-store.js";
import {
  PRICING_TYPES,
  presetPatch,
  type PricingPreset,
} from "../src/lib/pricing-presets.js";
import { closeDb } from "../src/lib/mongo.js";

function inr(n: number): string {
  return `₹${n}`;
}

function printTable(docs: Awaited<ReturnType<typeof getAllPricingDocs>>): void {
  console.log("\nreportType            amount   discount   list");
  console.log("------------------------------------------------");
  for (const d of docs) {
    console.log(
      `${d.reportType.padEnd(20)}  ${inr(d.amount).padStart(6)}  ${inr(d.discountPrice).padStart(8)}  ${inr(d.listPrice).padStart(6)}`,
    );
  }
  console.log("");
}

const mode = (process.argv[2] ?? "show").toLowerCase();

try {
  const inserted = await seedPricingDocs("script");
  if (inserted) console.log(`[pricing] seeded ${inserted} missing template(s)`);

  if (mode === "show") {
    printTable(await getAllPricingDocs());
    console.log("[pricing] no change (pass 'test' or 'actual' to update)");
  } else if (mode === "test" || mode === "9" || mode === "actual" || mode === "real") {
    const preset: PricingPreset = mode === "test" || mode === "9" ? "test" : "actual";
    for (const t of PRICING_TYPES) await upsertPricingDoc(t, presetPatch(preset, t), `script:${preset}`);
    console.log(preset === "test" ? "[pricing] set all reports to ₹9" : "[pricing] restored launch prices");
    printTable(await getAllPricingDocs());
  } else {
    console.error(`Unknown mode: ${mode}\nUse: test | actual | show`);
    process.exitCode = 1;
  }
} catch (e) {
  console.error("[pricing] failed:", String(e));
  process.exitCode = 1;
} finally {
  console.log(`[pricing] known templates: ${PRICING_TYPES.join(", ")}`);
  await closeDb();
}
