import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

/**
 * Shared visual system for the branded PDF reports (gold double-frame,
 * diamond corner marks, watermark, serif cover, warm ivory tables). Originally
 * built for the financial report (lib/financial-report.ts, one fixed-height
 * `.page` div per section); this module ports the same look to the flowing,
 * variable-length documents (angle reports via lib/render.ts, match report
 * via lib/match-report.ts) using `position:fixed` decoration instead of
 * per-page divs, since those documents' page count isn't known up front and
 * a fixed-height/overflow model risks silently clipping content.
 *
 * `position:fixed` elements repeat on every physical page when Chromium
 * prints to PDF — the standard technique for letterhead-style borders and
 * watermarks on a normal flowing document.
 */

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function lotus(size: number): string {
  return `<svg viewBox="0 0 24 16" width="${size}" height="${(size * 16) / 24}" fill="none" stroke="#C9A227" stroke-width="1">
    <path d="M12 15C6 15 2 11 2 11c3 0 6 1 8 3 0-4 1-8 2-11 1 3 2 7 2 11 2-2 5-3 8-3 0 0-4 4-10 4z"/>
  </svg>`;
}

let cachedLogo: string | null = null;
export async function loadLogo(): Promise<string> {
  if (cachedLogo !== null) return cachedLogo;
  let here = "";
  try {
    here = fileURLToPath(new URL(".", import.meta.url));
  } catch {
    here = process.cwd();
  }
  const candidates = [
    process.env.LOGO_PATH,
    join(process.cwd(), "assets", "shree_logo.png"),
    join(process.cwd(), "..", "..", "..", "assets", "shree_logo.png"),
    join(here, "..", "..", "..", "..", "assets", "shree_logo.png"),
  ].filter((p): p is string => Boolean(p));
  for (const p of candidates) {
    try {
      cachedLogo = `data:image/png;base64,${(await readFile(p)).toString("base64")}`;
      return cachedLogo;
    } catch {
      /* next */
    }
  }
  cachedLogo = "";
  return cachedLogo;
}

/** Frame + corner marks + watermark — rendered once, repeats on every printed page. */
export function frameMarkup(logo: string): string {
  return `<div class="theme-frame"></div>
    <span class="theme-corner tl"></span><span class="theme-corner tr"></span>
    <span class="theme-corner bl"></span><span class="theme-corner br"></span>
    ${logo ? `<div class="theme-wm"></div>` : ""}`;
}

/** Static brand footer (no live page numbers — page count isn't known up front here). */
export function footerMarkup(left: string, right: string): string {
  return `<div class="theme-foot"><span>${esc(left)}</span><span>${esc(right)}</span></div>`;
}

export interface CoverOptions {
  logo: string;
  brand: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  tagline?: string;
  preparedForLabel: string;
  name: string;
  factsLines: string[];
  footnote: string;
}

export function coverHTML(o: CoverOptions): string {
  const logoHtml = o.logo
    ? `<img src="${o.logo}" alt="${esc(o.brand)}" class="theme-cover-logo"/>`
    : `<div class="theme-cover-wordmark">${esc(o.brand)}</div>`;
  return `<div class="theme-cover">
      <div class="theme-cover-brand">
        ${logoHtml}
        <div class="theme-cover-eyebrow">${esc(o.eyebrow)}</div>
      </div>
      <div class="theme-cover-heading">
        <h1 class="theme-cover-title">${esc(o.title)}</h1>
        ${o.subtitle ? `<div class="theme-cover-subtitle">${esc(o.subtitle)}</div>` : ""}
      </div>
      ${o.tagline ? `<div class="theme-cover-rule"><span class="rule"></span>${lotus(13)}<span class="rule"></span></div>
      <div class="theme-cover-tagline">${esc(o.tagline)}</div>` : `<div class="theme-cover-rule" style="margin-top:26px"><span class="rule"></span>${lotus(13)}<span class="rule"></span></div>`}
      <div class="theme-cover-person">
        <div class="theme-cover-label">${esc(o.preparedForLabel)}</div>
        <div class="theme-cover-name">${esc(o.name)}</div>
        ${o.factsLines.map((f) => `<div class="theme-cover-facts">${f}</div>`).join("")}
      </div>
      <div class="theme-cover-footnote">${o.footnote}</div>
    </div>`;
}

/** Section heading matching the financial report's `.head` component. */
export function heading(title: string, sub?: string): string {
  return `<div class="theme-head"><div class="theme-head-title">${esc(title)}</div>` +
    `<div class="theme-head-line"><span class="rule"></span>${lotus(14)}<span class="rule"></span></div>` +
    (sub ? `<div class="theme-head-sub">${esc(sub)}</div>` : "") +
    `</div>`;
}

/** Shared CSS for the flowing (non-fixed-page-height) branded documents. */
export function themeCSS(logo: string): string {
  return `
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin:0; }
    body { color:#222; background:#fff; font-family:'Noto Sans Devanagari','Noto Serif Devanagari',Georgia,'Times New Roman',serif;
      padding:16mm 16mm 20mm; position:relative; font-size:12.6px; line-height:1.68; }
    h1,h2,h3 { font-family:'Noto Serif Devanagari',Georgia,serif; }
    .theme-frame { position:fixed; inset:9mm; border:2px double #D4A72C; pointer-events:none; z-index:2; }
    .theme-corner { position:fixed; width:7px; height:7px; background:#D4A72C; z-index:2; transform:rotate(45deg); }
    .theme-corner.tl { top:9mm; left:9mm; margin:-4px 0 0 -4px; }
    .theme-corner.tr { top:9mm; right:9mm; margin:-4px -4px 0 0; }
    .theme-corner.bl { bottom:9mm; left:9mm; margin:0 0 -4px -4px; }
    .theme-corner.br { bottom:9mm; right:9mm; margin:0 -4px -4px 0; }
    ${logo ? `.theme-wm { position:fixed; top:0; left:0; right:0; bottom:0; z-index:0;
      background-image:url("${logo}"); background-repeat:no-repeat; background-position:center;
      background-size:120mm auto; opacity:0.06; }` : ""}
    .theme-foot { position:fixed; left:16mm; right:16mm; bottom:11mm; z-index:2; display:flex; justify-content:space-between;
      font-size:8.5px; color:#7A5B00; letter-spacing:0.4px; }
    .theme-content { position:relative; z-index:1; }

    .theme-cover { min-height:calc(297mm - 36mm); display:flex; flex-direction:column; align-items:center; justify-content:center;
      text-align:center; page-break-after:always; }
    .theme-cover-brand { display:flex; flex-direction:column; align-items:center; }
    .theme-cover-logo { height:82px; display:block; }
    .theme-cover-wordmark { font-size:22px; font-weight:700; color:#7A1F2B; letter-spacing:2px; }
    .theme-cover-eyebrow { font-size:9.5px; font-weight:600; letter-spacing:6px; color:#A67C00; text-transform:uppercase; margin-top:12px; }
    .theme-cover-heading { margin-top:26px; }
    .theme-cover-title { font-size:30px; font-weight:700; color:#7A1F2B; letter-spacing:0.3px; line-height:1.3; margin:0; }
    .theme-cover-subtitle { font-size:12.5px; color:#5B5040; font-weight:500; letter-spacing:0.3px; margin-top:8px; }
    .theme-cover-rule { display:flex; align-items:center; justify-content:center; gap:12px; margin:26px 0 12px; }
    .theme-cover-rule .rule { width:44px; height:1px; background:#D4A72C; }
    .theme-cover-tagline { font-size:9.5px; letter-spacing:2.2px; color:#A67C00; text-transform:uppercase; }
    .theme-cover-person { margin-top:46px; }
    .theme-cover-label { font-size:9.5px; font-weight:600; letter-spacing:3.5px; color:#8A7A4A; text-transform:uppercase; }
    .theme-cover-name { font-family:'Noto Serif Devanagari',Georgia,serif; font-size:23px; font-weight:700; color:#26327A; margin-top:10px; }
    .theme-cover-facts { font-size:11.5px; color:#555; margin-top:8px; letter-spacing:0.2px; }
    .theme-cover-footnote { font-size:9px; color:#8A7A4A; letter-spacing:0.5px; margin-top:52px; }

    .theme-head { border-bottom:2px solid #C9760B; padding-bottom:6px; margin:0 0 12px; page-break-before:always; }
    .theme-head-title { font-size:19px; font-weight:700; color:#7A1F2B; }
    .theme-head-line { display:flex; align-items:center; gap:6px; margin:3px 0; }
    .theme-head-line .rule { flex:0 0 34px; height:1px; background:#D4A72C; }
    .theme-head-sub { font-size:12px; color:#555; }
    h2 { font-size:14px; font-weight:700; color:#7A1F2B; margin:16px 0 6px; border-left:3px solid #C9760B; padding-left:8px; }
    h3 { font-size:12.5px; font-weight:700; color:#7A1F2B; margin:12px 0 4px; }
    p { font-size:12.6px; line-height:1.68; color:#222; margin:8px 0; text-align:justify; }
    p.muted { color:#777; font-size:11px; text-align:left; }
    ul { margin:8px 0; padding-left:20px; font-size:12.2px; line-height:1.6; }
    table { width:100%; border-collapse:collapse; margin:8px 0 14px; font-size:12.2px; }
    th,td { border:1px solid #C8B27A; padding:5px 8px; text-align:left; vertical-align:top; }
    th { background:#F7EFDC; color:#7A1F2B; font-weight:700; }
    tr:nth-child(even) td { background:#FBF7EE; }
    .note { background:#F7EFDC; border-left:3px solid #C9760B; padding:8px 11px; font-size:12.2px; margin:10px 0; line-height:1.55; color:#222; }
    .pagebreak { page-break-after:always; }
    .score { text-align:center; border:1px solid #C8B27A; border-radius:8px; padding:16px; margin:16px 0; background:#FBF7EE; }
    .score .big { font-size:34px; color:#7A1F2B; font-weight:700; line-height:1; font-family:'Noto Serif Devanagari',Georgia,serif; }
    .score .band { font-size:13px; color:#5B5040; margin-top:6px; }
  `;
}
