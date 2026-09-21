import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getKundli } from "../src/lib/prokerala.js";
import { renderReportPDF, renderReportHTML } from "../src/lib/render.js";

/**
 * Quick sample generator for reviewing the Financial Kundali report template.
 *   pnpm exec tsx scripts/generate-sample-report.ts [lang]
 * lang: "en" (default) | "hi"
 */
async function main() {
  const lang = process.argv[2] === "hi" ? "hi" : "en";

  // Sample birth (sandbox requires Jan 1). Coordinates: Visakhapatnam.
  // detailed:false = 3 API calls (within free-tier 5/min). Set true on a paid
  // plan to include dasha periods in the sample.
  const birth = {
    coordinates: "17.6868,83.2185",
    datetime: "1992-01-01T13:39:00+05:30",
    ayanamsa: 1,
    la: lang,
    detailed: process.env.SAMPLE_DETAILED === "true",
  };

  console.log(`Fetching chart (${lang})…`);
  const { parsed } = await getKundli(birth);

  const meta = {
    name: "Sambhai",
    gender: "male",
    datetime: birth.datetime,
    coordinates: birth.coordinates,
    place: process.env.SAMPLE_PLACE || "Visakhapatnam, Andhra Pradesh",
    ayanamsa: birth.ayanamsa,
    language: lang,
    reportNo: "O8GHJDC0",
  };

  const html = await renderReportHTML("financial_kundali", parsed, "Janam Kundali Report", meta);
  const htmlPath = resolve(process.cwd(), `sample-financial-report.${lang}.html`);
  await writeFile(htmlPath, html);
  console.log(`HTML: ${htmlPath}`);

  const pdf = await renderReportPDF("financial_kundali", parsed, "Janam Kundali Report", meta);
  const pdfPath = resolve(process.cwd(), `sample-financial-report.${lang}.pdf`);
  await writeFile(pdfPath, pdf);
  console.log(`PDF:  ${pdfPath} (${(pdf.length / 1024).toFixed(0)} KB)`);
}

main().catch((e) => {
  console.error("sample generation failed:", e);
  process.exit(1);
});
