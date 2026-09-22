#!/usr/bin/env node
/**
 * fal.ai Image Asset Generator
 *
 * Reads prompts from ai-image-generation-prompts.md and generates assets via fal.ai.
 *
 * Usage:
 *   node generate.mjs                    # generate all assets
 *   node generate.mjs --only A1,A2       # generate specific assets only
 *   node generate.mjs --dry-run          # print prompts without calling API
 *   node generate.mjs --list             # list all available asset IDs
 *   node generate.mjs --category website # generate all assets in a category
 *   node generate.mjs --category pdf     # generate PDF assets only
 *   node generate.mjs --category campaign # generate campaign assets only
 */

import { readFileSync, mkdirSync, writeFileSync, existsSync, cpSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env: local package dir first, then project root (3 levels up)
dotenv.config({ path: join(__dirname, ".env") });
dotenv.config({ path: join(__dirname, "..", "..", "..", ".env") });

const OUTPUT_DIR = join(__dirname, "output");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PROMPTS_SRC = join(__dirname, "..", "..", "..", "docs", "prd", "ai-image-generation-prompts.md");

// ── Asset definitions ──────────────────────────────────────────────────────────
// Each asset maps an ID to its fal.ai call config.
// Dimensions come from the prompt doc; we pass them to the model.

const ASSETS = {
  // A. Website assets
  A1: {
    name: "Hero section background / stylized report mockup",
    category: "website",
    model: "fal-ai/recraft-v3",
    params: {
      prompt: `A premium, minimalist 3D-rendered mockup of an elegant printed astrology report document floating at a slight angle, cover page visible showing an abstract geometric Vedic birth chart (kundli square-chart motif, NOT a zodiac wheel) rendered in deep indigo (#241E4E) linework with muted gold (#C9A227) accent lines on a warm off-white (#FBF6EF) paper texture. Soft studio lighting, subtle drop shadow, shallow depth of field, clean negative space around the object suitable for compositing onto a website hero background. Style: modern fintech/legal-document product photography, premium editorial feel, NOT mystical or cosmic. No text, no logos, no human figures.`,
      negative_prompt: "zodiac wheel, tarot, crystal ball, cosmic swirl, stars background, cartoonish, stock photo watermark, text, logo, low quality, cluttered",
      image_size: "portrait_4_3", // recraft-v3 enum (was invalid: portrait_4_5)
      style: "realistic_image",
    },
    outputName: "A1-hero-mockup",
  },
  A2: {
    name: "Kundli-chart motif — recurring visual anchor",
    category: "website",
    model: "fal-ai/recraft-v3",
    params: {
      prompt: `A subtle, elegant line-art pattern of a Vedic kundli square birth-chart diagram (North Indian chart style, geometric diamond-and-triangle grid), rendered in thin single-weight gold (#C9A227) strokes on transparent/warm off-white (#FBF6EF) background, low contrast, minimal, suitable as a faint decorative background texture behind text. No numbers, no planetary symbols cluttering it, no text. Clean, premium, editorial — think fintech annual-report background texture, not mystical poster art.`,
      negative_prompt: "zodiac wheel, planets illustration, stars, cosmic, cluttered symbols, text, numbers, bright colors, cartoonish",
      image_size: "square_hd", // recraft-v3 enum (was invalid: square_2000x2000)
      style: "vector_illustration",
    },
    outputName: "A2-kundli-motif",
  },
  A3: {
    name: "Open Graph / social share image",
    category: "website",
    model: "fal-ai/recraft-v3",
    params: {
      prompt: `A clean, premium social-share banner background, warm off-white (#FBF6EF) base with a deep indigo (#241E4E) geometric kundli-chart motif accent in one corner and a thin muted-gold (#C9A227) divider line, large empty central negative space reserved for overlaid headline text (added separately, do not render any text). Premium fintech/document-product aesthetic, not mystical.`,
      negative_prompt: "text, logo, zodiac wheel, cosmic swirl, stock photo, cluttered, low quality",
      image_size: "landscape_16_9", // recraft-v3 enum (was invalid: landscape_1200x630)
      style: "digital_illustration",
    },
    outputName: "A3-og-social",
  },

  // B. PDF backgrounds
  B1: {
    name: "Cover page (page 1) full-bleed background",
    category: "pdf",
    model: "fal-ai/recraft-v3",
    params: {
      prompt: `A premium full-bleed document cover-page background, portrait orientation, deep indigo (#241E4E) base gradating subtly toward warm off-white (#FBF6EF) at the vertical center, with a large, elegant, low-opacity gold (#C9A227) line-art Vedic kundli square-chart motif centered as a watermark-style graphic element — NOT a zodiac wheel, NOT cluttered with planetary glyphs. A thin gold border/frame line inset from the page edge. The upper-middle third of the composition must remain visually calm and high-contrast-safe (for dark indigo text or light text to be legibly overlaid later) — do not place dense pattern detail there. Aesthetic: premium legal/financial report cover, think high-end annual report or law-firm document cover, NOT mystical or spiritual poster art. No text, no numbers, no human figures.`,
      negative_prompt: "zodiac wheel, tarot cards, crystal ball, stars, cosmic swirl, cartoonish, cluttered symbols, text, logo, low quality, watermark text",
      image_size: "portrait_4_3", // recraft-v3 enum, closest to A4 (was invalid: portrait_3_4)
      style: "realistic_image",
    },
    outputName: "B1-cover-page",
  },
  B2: {
    name: "Closing/last page full-bleed background",
    category: "pdf",
    model: "fal-ai/recraft-v3",
    params: {
      prompt: `A premium full-bleed document closing-page background, portrait orientation, warm off-white (#FBF6EF) base with a single small, elegant gold (#C9A227) line-art kundli-chart glyph positioned in the lower corner only (much smaller and lighter-weight than a cover page would use), rest of the page calm and nearly blank with a very subtle indigo (#241E4E) thin border frame. Generous open space through the vertical and horizontal center for a closing message, support contact details, and legal/footer text to be overlaid later. Aesthetic: premium document closing page, calm, understated, NOT busy or mystical.`,
      negative_prompt: "zodiac wheel, cosmic swirl, cluttered pattern, dense graphics, dark heavy background, text, logo, low quality",
      image_size: "portrait_4_3", // recraft-v3 enum, closest to A4 (was invalid: portrait_3_4)
      style: "vector_illustration",
    },
    outputName: "B2-closing-page",
  },

  // C. Campaign creatives
  C1: {
    name: "Pain-point / hook creative",
    category: "campaign",
    model: "fal-ai/flux-pro/v1.1-ultra",
    params: {
      prompt: `A calm, premium editorial photo of a young Indian professional (late 20s) sitting at a home desk at night, looking thoughtfully at a laptop screen with a soft warm desk lamp glow, expression pensive but not distressed — conveying quiet uncertainty about a career or financial decision, not despair. Warm off-white and deep indigo color grading matching a premium fintech-brand photoshoot, soft natural shadows, shallow depth of field. No visible screen content, no on-screen text, no logos, no astrology imagery in frame (no charts, no zodiac symbols) — this creative is pure emotional-hook photography.`,
      negative_prompt: "cartoonish, stock-photo cliché forced-smile, cosmic imagery, zodiac wheel, text, logo, low quality, overexposed",
      aspect_ratio: "1:1", // flux-pro/v1.1-ultra uses aspect_ratio, not image_size
    },
    outputName: "C1-pain-hook",
  },
  C2: {
    name: "Outcome / aspiration creative",
    category: "campaign",
    model: "fal-ai/flux-pro/v1.1-ultra",
    params: {
      prompt: `A premium, warm-toned editorial photo of an Indian professional (late 20s-30s) smiling with quiet confidence, looking slightly off-camera as if reading good news, seated in a bright naturally-lit room with warm off-white (#FBF6EF) tones and a hint of deep indigo (#241E4E) in the wardrobe or background décor for brand color consistency. Soft, optimistic, aspirational but not exaggerated/theatrical. No text, no logos, no astrology iconography in frame.`,
      negative_prompt: "cartoonish, cosmic imagery, zodiac wheel, tarot, exaggerated expression, text, logo, low quality",
      aspect_ratio: "1:1", // flux-pro/v1.1-ultra uses aspect_ratio, not image_size
    },
    outputName: "C2-outcome",
  },
  C3: {
    name: "Trust / authority creative",
    category: "campaign",
    model: "fal-ai/flux-pro/v1.1-ultra",
    params: {
      prompt: `A premium flat-lay product photograph of a bound, elegant astrology report document (matching the cover design described in prompt B1: deep indigo cover with a subtle gold kundli-chart line-art motif) resting on a warm off-white desk surface next to a minimalist pen and a cup of tea, soft natural window light, styled like a premium financial/legal document product shoot. No human figures, no text overlays, no logos.`,
      negative_prompt: "cartoonish, cosmic imagery, zodiac wheel, tarot cards, crystal ball, cluttered desk, text, logo, low quality",
      aspect_ratio: "16:9", // flux-pro/v1.1-ultra uses aspect_ratio, not image_size
    },
    outputName: "C3-trust-authority",
  },
  C4: {
    name: "Cultural/festive relevance creative",
    category: "campaign",
    model: "fal-ai/flux-pro/v1.1-ultra",
    params: {
      prompt: `A warm, premium lifestyle photo of an Indian family or individual at home during a quiet Diwali evening with soft diya candlelight, color-graded toward warm off-white and gold tones consistent with the brand palette (#FBF6EF, #C9A227), calm and intimate mood, not a loud festival-poster aesthetic. No text, no logos, no astrology iconography, no zodiac imagery.`,
      negative_prompt: "loud festival poster style, fireworks clipart, cosmic imagery, zodiac wheel, text, logo, low quality, oversaturated",
      aspect_ratio: "9:16", // flux-pro/v1.1-ultra uses aspect_ratio, not image_size
    },
    outputName: "C4-festive",
  },
  C5: {
    name: "Direct offer / discount creative",
    category: "campaign",
    model: "fal-ai/recraft-v3",
    params: {
      prompt: `A clean, premium background graphic for a price-offer ad: warm off-white (#FBF6EF) base, a bold deep-indigo (#241E4E) diagonal ribbon/banner shape in one corner reserved for a "% OFF" badge overlay (leave that corner visually simple, not detailed — it will have text added), a single elegant gold (#C9A227) line-art kundli-chart accent graphic off to one side balancing the composition, generous clean negative space in the center-lower area for a CTA button overlay. Premium fintech-offer aesthetic, not a loud e-commerce sale banner.`,
      negative_prompt: "cluttered sale-banner clipart, cosmic imagery, zodiac wheel, starburst shapes, text, logo, low quality, oversaturated red/yellow sale colors",
      image_size: "square_hd",
      style: "digital_illustration",
    },
    outputName: "C5-offer-discount",
  },

  // D. Money/Debt sprint creatives (2-week focus, see docs/ads/money-debt-sprint-copy.md)
  D1: {
    name: "Debt-loop pain point (V1, V8)",
    category: "campaign",
    model: "fal-ai/flux-pro/v1.1-ultra",
    params: {
      prompt: `A calm, premium editorial photo of an Indian professional (late 20s-30s) at a kitchen table at night, looking at a phone showing a banking app with a slightly worried but composed expression — conveying the quiet, recurring stress of money coming in and going straight back out, not dramatic despair. A stack of bill-like papers sits softly out of focus in the foreground. Warm off-white and deep indigo (#241E4E) color grading matching a premium fintech-brand photoshoot, soft desk-lamp lighting, shallow depth of field. No visible screen content, no text, no logos, no astrology imagery in frame.`,
      negative_prompt: "cartoonish, stock-photo cliché forced distress, cosmic imagery, zodiac wheel, text, logo, low quality, overexposed",
      aspect_ratio: "4:5",
    },
    outputName: "D1-debt-loop",
  },
  D2: {
    name: "Savings leak (V2)",
    category: "campaign",
    model: "fal-ai/recraft-v3",
    params: {
      prompt: `A minimalist, premium line-art illustration of a terracotta piggy bank with a single thin gold (#C9A227) coin stream leaking from a small crack, set against a warm off-white (#FBF6EF) background with deep indigo (#241E4E) accent shadow beneath it. Clean, editorial, fintech-infographic style — not cute or cartoonish. Generous negative space above and below for headline and CTA text to be added separately. No text, no logos, no zodiac or mystical symbols.`,
      negative_prompt: "cute cartoon character, cosmic imagery, zodiac wheel, cluttered, text, logo, low quality, oversaturated",
      image_size: "square_hd",
      style: "vector_illustration",
    },
    outputName: "D2-savings-leak",
  },
  D3: {
    name: "EMI / financial pressure (V3, V5, V9)",
    category: "campaign",
    model: "fal-ai/flux-pro/v1.1-ultra",
    params: {
      prompt: `A premium, symbolic editorial photograph: a neat stack of coins on a warm off-white (#FBF6EF) surface, with a soft, diffuse dark indigo (#241E4E) shadow shaped like a gentle overhead weight or cloud cast across the top of the stack, suggesting quiet financial pressure without being literal or ominous. Soft directional light, shallow depth of field, minimalist product-photography styling. No text, no logos, no astrology iconography, no human figures.`,
      negative_prompt: "cartoonish, cosmic imagery, zodiac wheel, dark/scary mood, text, logo, low quality",
      aspect_ratio: "4:5",
    },
    outputName: "D3-emi-pressure",
  },
  D4: {
    name: "Flagship anchor offer ₹499→₹199 (V4, V6)",
    category: "campaign",
    model: "fal-ai/recraft-v3",
    params: {
      prompt: `A clean, premium price-offer graphic on a flat warm off-white (#FBF6EF) background. Top-right: a simple deep-indigo (#241E4E) rounded price-tag shape reserved for a struck-through "₹499 → ₹199" price overlay (leave that tag area visually blank/simple — text added separately). Center-left: a single closed hardcover document/booklet rendered as flat gold (#C9A227) line-art icon (a simple rectangle with a bookmark ribbon, NOT an open book, NOT any architecture), floating at a slight angle with a soft drop shadow. Generous clean negative space in the lower third for a CTA button overlay. Flat 2D vector graphic design only, premium fintech-offer aesthetic, calm and trustworthy.`,
      negative_prompt: "cluttered sale-banner clipart, cosmic imagery, zodiac wheel, starburst shapes, text, logo, low quality, oversaturated red/yellow sale colors, open book, mosque, temple, church, religious building, religious iconography, lantern, crescent moon, architecture, photorealistic, 3D render",
      image_size: "square_hd",
      style: "digital_illustration",
    },
    outputName: "D4-anchor-offer",
  },
  D5: {
    name: "English/urban outcome creative (V7)",
    category: "campaign",
    model: "fal-ai/flux-pro/v1.1-ultra",
    params: {
      prompt: `A premium, warm-toned editorial photo of an Indian professional (late 20s-30s) in a bright, naturally-lit modern apartment, exhaling with quiet relief while looking at a laptop, one hand relaxed on a coffee cup — conveying the moment financial clarity replaces low-grade money anxiety. Warm off-white (#FBF6EF) tones with a hint of deep indigo (#241E4E) in wardrobe/décor for brand consistency. Calm, understated, aspirational — not theatrical. No text, no logos, no astrology iconography in frame.`,
      negative_prompt: "cartoonish, cosmic imagery, zodiac wheel, exaggerated expression, text, logo, low quality",
      aspect_ratio: "1:1",
    },
    outputName: "D5-english-outcome",
  },
  D6: {
    name: "Career + money decision fork (V10)",
    category: "campaign",
    model: "fal-ai/recraft-v3",
    params: {
      prompt: `A minimalist, premium line-art illustration of a single path splitting into two: one branch leading to a small briefcase icon, the other to a small rupee-coin icon, rendered in thin gold (#C9A227) linework on a warm off-white (#FBF6EF) background with a subtle deep-indigo (#241E4E) horizon shadow. Clean, editorial, fintech-infographic style. Generous negative space for headline and CTA text to be added separately. No text, no logos, no zodiac or mystical symbols.`,
      negative_prompt: "cluttered, cosmic imagery, zodiac wheel, cute cartoon, text, logo, low quality, oversaturated",
      image_size: "square_hd",
      style: "vector_illustration",
    },
    outputName: "D6-career-money-fork",
  },

  // E. Money/Debt sprint — gpt-image-1 replicas of scraped competitor layouts.
  // flux-pro/recraft-v3 render fake/garbled text — gpt-image-1 (OpenAI, proxied via
  // the same FAL_KEY) renders real legible in-image text, which is the point here:
  // these poster layouts carry price tags, badges and a book title as actual pixels,
  // not overlay text added later. See docs/ads/money-debt-creatives/README.md.
  E1: {
    name: "Anchor offer + book cover (replicates Astro Arun Pandit layout)",
    category: "campaign",
    model: "fal-ai/gpt-image-1/text-to-image",
    params: {
      prompt: `A clean, premium vertical poster-style ad creative for an astrology report brand. Warm off-white (#FBF6EF) background. Small clean sans-serif brand wordmark "ShriKundali" centered at the very top. Below it, bold dark indigo headline text reading "The Answers Are Already In Your Kundali" and smaller gray subtext "Finding them costs less than a consultation." In the upper-right area, a deep-indigo rounded price tag/badge with two lines of bold white text clearly rendered: small crossed-out line "Astrologer consult: ₹500+" above a large bold line "₹199 Only". Center-left, a photorealistic 3D-rendered closed hardcover book standing upright at a slight angle, its cover deep indigo (#241E4E) with gold (#C9A227) foil-stamped title text clearly reading "YOUR MONEY KUNDALI" on one line and smaller subtitle text "Personalized Financial Report" below it, with a small minimalist gold line-art kundli-chart emblem beneath the title. Soft studio lighting, realistic shadow. Bottom third left clean and empty for a CTA button to be added later. Poster layout, sober and premium, not mystical or cluttered, all text crisp and legible.`,
      image_size: "1024x1536",
      quality: "high",
      output_format: "png",
    },
    outputName: "E1-anchor-book-cover",
  },
  E2: {
    name: "Premium Kundli PDF template replica (V4, V6, V8)",
    category: "campaign",
    model: "fal-ai/gpt-image-1/text-to-image",
    params: {
      prompt: `A vertical mobile ad poster for an astrology report brand. Deep purple-to-indigo gradient background with a subtle gold mandala line-art pattern in the corners. Bold large gold gradient headline text at the top clearly reading "MONEY KUNDALI REPORT". Below it, a red-orange pill-shaped badge with bold white text clearly reading "SIRF ₹199 ONLY". Below that, a vertical checklist of five rows, each with a small gold checkmark icon and clear bold white text: "Money & Wealth", "Karz (Debt) Analysis", "EMI Timing", "Career & Business", "Financial Planning". On the right side, a small 3D illustration of an open astrology birth-chart book. Near the bottom, three small badge icons with clear text underneath: "Deliver in 2 Hours", "100% Confidential", "Instant PDF Report". At the very bottom, a rounded green button with bold white text clearly reading "GET YOUR REPORT NOW". Clean poster design, legible bold sans-serif typography throughout, premium, not cluttered.`,
      image_size: "1024x1536",
      quality: "high",
      output_format: "png",
    },
    outputName: "E2-premium-pdf-template",
  },
  E3: {
    name: "Magazine cover replica (replicates Surabhi Astrology layout)",
    category: "campaign",
    model: "fal-ai/gpt-image-1/text-to-image",
    params: {
      prompt: `A premium magazine-cover style ad creative for an astrology report brand, portrait orientation. Cream/ivory background. At the top, a small elegant masthead in refined serif type clearly reading "SHRIKUNDALI". Below it, a bold headline in large dark-indigo serif type clearly reading "Your Money Clarity, Today". Smaller gray subheadline text below reading "Your Kundali already has the answers." On the right side, a soft studio-lit photograph of a closed premium hardcover book resting at an angle on a wooden desk, its cover with gold foil title text clearly reading "MONEY KUNDALI". Near the bottom, a deep-indigo ribbon banner with bold white text clearly reading "₹199 Only" and small text below it reading "Instant PDF · 100% Private". Clean editorial poster layout, generous white space, sober and trustworthy tone, all text crisp and legible, not mystical or cluttered.`,
      image_size: "1024x1536",
      quality: "high",
      output_format: "png",
    },
    outputName: "E3-magazine-cover",
  },
  E4: {
    name: "Book-only hero product shot",
    category: "campaign",
    model: "fal-ai/gpt-image-1/text-to-image",
    params: {
      prompt: `A clean, premium product photograph of a single closed hardcover book standing upright at a slight angle on a soft warm off-white surface. The book's cover is deep indigo (#241E4E) with elegant gold (#C9A227) foil-stamped title text clearly reading "YOUR PERSONALIZED MONEY KUNDALI" across two lines, with a small minimalist gold line-art Vedic kundli-chart emblem beneath the title. Soft directional studio lighting, subtle realistic shadow, shallow depth of field, poster-ready composition with generous clean negative space above and below the book for a headline and price/CTA to be added separately. Photorealistic product photography, sober and premium, not mystical or cluttered, title text crisp and legible.`,
      image_size: "1024x1536",
      quality: "high",
      output_format: "png",
    },
    outputName: "E4-book-hero",
  },
};

// ── CLI ────────────────────────────────────────────────────────────────────────

const { values } = parseArgs({
  options: {
    only: { type: "string" },
    category: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    list: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
  strict: false,
});

function printHelp() {
  console.log(`
Usage: node generate.mjs [options]

Options:
  --only <ids>       Comma-separated asset IDs to generate (e.g. A1,A2,B1)
  --category <cat>   Generate all assets in a category: website | pdf | campaign
  --dry-run          Print prompts without calling the API
  --list             List all available asset IDs
  -h, --help         Show this help message

Examples:
  node generate.mjs --list
  node generate.mjs --dry-run --only A1,A2
  node generate.mjs --category website
  node generate.mjs --only C1 --dry-run
  FAL_KEY=xxx node generate.mjs --only A1
`);
}

if (values.help) {
  printHelp();
  process.exit(0);
}

if (values.list) {
  console.log("\nAvailable assets:\n");
  for (const [id, asset] of Object.entries(ASSETS)) {
    console.log(`  ${id.padEnd(4)} [${asset.category.padEnd(8)}] ${asset.name}`);
  }
  console.log(`\nTotal: ${Object.keys(ASSETS).length} assets\n`);
  process.exit(0);
}

// ── Resolve which assets to generate ──────────────────────────────────────────

let selectedIds = Object.keys(ASSETS);

if (values.only) {
  selectedIds = values.only.split(",").map((s) => s.trim().toUpperCase());
  // validate
  for (const id of selectedIds) {
    if (!ASSETS[id]) {
      console.error(`Unknown asset ID: ${id}. Use --list to see valid IDs.`);
      process.exit(1);
    }
  }
} else if (values.category) {
  const cat = values.category.toLowerCase();
  selectedIds = Object.entries(ASSETS)
    .filter(([, a]) => a.category === cat)
    .map(([id]) => id);
  if (selectedIds.length === 0) {
    console.error(`No assets found for category: ${cat}. Use --list to see categories.`);
    process.exit(1);
  }
}

const dryRun = values["dry-run"];

// ── Ensure output dir + copy prompts ──────────────────────────────────────────

mkdirSync(OUTPUT_DIR, { recursive: true });

const promptsCopy = join(__dirname, "ai-image-generation-prompts.md");
if (existsSync(PROMPTS_SRC) && !existsSync(promptsCopy)) {
  cpSync(PROMPTS_SRC, promptsCopy);
  console.log("Copied prompts doc to package.");
}

// ── Generate ──────────────────────────────────────────────────────────────────

async function generateAsset(id, asset) {
  const outFile = join(OUTPUT_DIR, `${asset.outputName}.png`);
  const logFile = join(OUTPUT_DIR, `${asset.outputName}.json`);

  if (dryRun) {
    console.log(`\n── ${id}: ${asset.name} ──`);
    console.log(`  Model:  ${asset.model}`);
    console.log(`  Output: ${outFile}`);
    console.log(`  Params:`, JSON.stringify(asset.params, null, 2));
    return;
  }

  console.log(`\n▶ Generating ${id}: ${asset.name}...`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300000);

  try {
    const res = await fetch(`https://fal.run/${asset.model}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${process.env.FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(asset.params),
      signal: controller.signal,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`fal.ai ${res.status}: ${err}`);
    }

    const data = await res.json();
    const imageUrl = data?.images?.[0]?.url || data?.image?.url;
    if (!imageUrl) {
      console.error(`  ✗ No image URL in response for ${id}`);
      console.log(`  Response:`, JSON.stringify(data, null, 2));
      return;
    }

    const img = await fetch(imageUrl);
    if (!img.ok) throw new Error(`download failed: ${img.status}`);
    const buffer = Buffer.from(await img.arrayBuffer());
    writeFileSync(outFile, buffer);
    console.log(`  ✓ Saved: ${outFile} (${(buffer.length / 1024).toFixed(0)} KB)`);

    // Log request params for reproducibility
    writeFileSync(
      logFile,
      JSON.stringify(
        {
          id,
          model: asset.model,
          params: asset.params,
          response: data,
          generatedAt: new Date().toISOString(),
        },
        null,
        2
      )
    );
  } catch (err) {
    console.error(`  ✗ Failed ${id}:`, err.message || err);
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  console.log(`\nAssets to ${dryRun ? "preview" : "generate"}: ${selectedIds.join(", ")}\n`);

  if (!dryRun && !process.env.FAL_KEY) {
    console.error("FAL_KEY env variable not set. Set it or add to .env in project root.");
    console.error("Example: FAL_KEY=fal_xxxxx node generate.mjs --only A1\n");
    process.exit(1);
  }

  for (const id of selectedIds) {
    await generateAsset(id, ASSETS[id]);
  }

  console.log(`\nDone. ${dryRun ? "(dry run — no API calls made)" : `Outputs in ${OUTPUT_DIR}`}\n`);
}

main();
