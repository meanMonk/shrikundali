import type { MatchingData } from "./prokerala.js";
import { val, str } from "./scores.js";
import { htmlToPdf, formatBirthDateTime } from "./render.js";

export interface MatchMeta {
  girlName?: string;
  boyName?: string;
  girlDatetime?: string;
  boyDatetime?: string;
  girlPlace?: string;
  boyPlace?: string;
  language?: string;
  reportNo?: string;
}

export interface MatchKootRow {
  koota: string;
  max: number;
  girl: string;
  boy: string;
  note: string;
}

export interface MatchSummary {
  totalPoints: number;
  maximumPoints: number;
  percentage: number;
  band: string;
  recommendation: string;
  girl: { nakshatra: string; pada: string; rasi: string; lord: string };
  boy: { nakshatra: string; pada: string; rasi: string; lord: string };
  koots: MatchKootRow[];
}

const VARNA_RANK: Record<string, number> = { Brahmin: 4, Kshatriya: 3, Vaishya: 2, Shudra: 1 };
const INAUSPICIOUS_TARA = new Set(["Vipat", "Pratyari", "Vadha"]);

function bandFor(points: number, max: number): string {
  const pct = max ? (points / max) * 100 : 0;
  if (pct >= 78) return "Excellent match";
  if (pct >= 67) return "Very good match";
  if (pct >= 50) return "Good match";
  return "Needs careful consideration";
}

function partnerInfo(info: MatchingData["data"]["girl_info"]) {
  const nk = info?.nakshatra ?? {};
  const rasi = info?.rasi ?? {};
  return {
    nakshatra: str(val(nk, "name")),
    pada: str(val(nk, "pada")),
    rasi: str(val(rasi, "name")),
    lord: str(val(val(rasi, "lord"), "name")),
  };
}

function bhakootNote(girlRasiId: number, boyRasiId: number): string {
  if (!girlRasiId || !boyRasiId) return "Bhakoot could not be computed.";
  const dist = ((boyRasiId - girlRasiId + 12) % 12) + 1;
  if (dist === 6 || dist === 8) return "6/8 Bhakoot — traditionally associated with friction; requires care.";
  if (dist === 2 || dist === 12) return "2/12 Bhakoot — traditionally associated with financial or health strain.";
  return "Bhakoot is favourable — no 6/8 or 2/12 dosha.";
}

function buildKoots(data: MatchingData): MatchKootRow[] {
  const g = data.data?.girl_info?.koot ?? ({} as MatchingData["data"]["girl_info"]["koot"]);
  const b = data.data?.boy_info?.koot ?? ({} as MatchingData["data"]["boy_info"]["koot"]);
  const girlRasiId = Number(val(data.data?.girl_info?.rasi, "id")) || 0;
  const boyRasiId = Number(val(data.data?.boy_info?.rasi, "id")) || 0;

  const gr = VARNA_RANK[g.varna] ?? 0;
  const br = VARNA_RANK[b.varna] ?? 0;
  const varnaNote =
    gr && br
      ? br >= gr
        ? "Compatible — the groom's varna is equal to or higher."
        : "Reversed varna — traditionally a minor concern."
      : "Varna compatibility could not be scored.";

  const badTara = [g.tara, b.tara].filter((t) => INAUSPICIOUS_TARA.has(t)).length;
  const taraNote =
    badTara === 0
      ? "Both Taras are auspicious."
      : badTara === 1
        ? "One Tara is inauspicious — minor caution."
        : "Both Taras are inauspicious — remedies advised.";

  const yoniNote =
    g.yoni && g.yoni === b.yoni
      ? `Same yoni (${g.yoni}) — strong physical compatibility.`
      : `Different yonis (${g.yoni} / ${b.yoni}) — moderate compatibility.`;

  const maitriNote =
    g.graha_maitri && g.graha_maitri === b.graha_maitri
      ? `Same sign lord (${g.graha_maitri}) — strong mental affinity.`
      : `Sign lords ${g.graha_maitri} and ${b.graha_maitri} — friendship is moderate.`;

  let ganaNote = "Same gana — mental compatibility is strong.";
  if (g.gana !== b.gana) {
    const pair = new Set([g.gana, b.gana]);
    if (pair.has("Rakshasa") && pair.has("Deva")) {
      ganaNote = "Deva–Rakshasa gana — temperaments differ; patience is advised.";
    } else if (pair.has("Rakshasa") && pair.has("Manushya")) {
      ganaNote = "Manushya–Rakshasa gana — a mismatch that needs conscious adjustment.";
    } else {
      ganaNote = "Deva–Manushya gana — a supportive combination.";
    }
  }

  const nadiNote =
    g.nadi && g.nadi === b.nadi
      ? "Same nadi (Nadi dosha) — traditionally given high priority; consult before proceeding."
      : "Different nadi — no Nadi dosha.";

  return [
    { koota: "Varna", max: 1, girl: g.varna, boy: b.varna, note: varnaNote },
    { koota: "Vashya", max: 2, girl: g.vasya, boy: b.vasya, note: "Vashya shows mutual influence and day-to-day compatibility." },
    { koota: "Tara", max: 3, girl: g.tara, boy: b.tara, note: taraNote },
    { koota: "Yoni", max: 4, girl: g.yoni, boy: b.yoni, note: yoniNote },
    { koota: "Graha Maitri", max: 5, girl: g.graha_maitri, boy: b.graha_maitri, note: maitriNote },
    { koota: "Gana", max: 6, girl: g.gana, boy: b.gana, note: ganaNote },
    { koota: "Bhakoot", max: 7, girl: g.bhakoot, boy: b.bhakoot, note: bhakootNote(girlRasiId, boyRasiId) },
    { koota: "Nadi", max: 8, girl: g.nadi, boy: b.nadi, note: nadiNote },
  ];
}

export function buildMatchSummary(data: MatchingData): MatchSummary {
  const total = Number(data.data?.guna_milan?.total_points) || 0;
  const max = Number(data.data?.guna_milan?.maximum_points) || 36;
  return {
    totalPoints: total,
    maximumPoints: max,
    percentage: max ? Math.round((total / max) * 100) : 0,
    band: bandFor(total, max),
    recommendation: str(val(data.data, "message.description"), ""),
    girl: partnerInfo(data.data?.girl_info),
    boy: partnerInfo(data.data?.boy_info),
    koots: buildKoots(data),
  };
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function buildMatchReportHTML(data: MatchingData, meta: MatchMeta = {}): string {
  const s = buildMatchSummary(data);
  const girl = meta.girlName || "Bride";
  const boy = meta.boyName || "Groom";
  const genDate = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });

  const rows = s.koots
    .map(
      (k) =>
        `<tr><td><b>${esc(k.koota)}</b><br><span class="muted">max ${k.max}</span></td>` +
        `<td>${esc(k.girl || "—")}</td><td>${esc(k.boy || "—")}</td><td>${esc(k.note)}</td></tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="${esc(meta.language || "en")}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Kundali Matching Report</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Noto Sans Devanagari', Georgia, "Times New Roman", serif; color: #1a1a1a; line-height: 1.7; margin: 0; padding: 0 22mm; font-size: 12pt; }
  h1 { font-size: 24pt; color: #8b4513; border-bottom: 3px solid #d4a373; padding-bottom: 8px; margin: 28px 0 16px; }
  h2 { font-size: 15pt; color: #6b3a0e; margin: 22px 0 8px; }
  p { margin: 8px 0; text-align: justify; }
  .muted { color: #777; font-size: 10.5pt; }
  .score { text-align: center; border: 2px solid #d4a373; border-radius: 10px; padding: 18px; margin: 18px 0; background: #fdf8f0; }
  .score .big { font-size: 40pt; color: #8b4513; font-weight: 700; line-height: 1; }
  .score .band { font-size: 13pt; color: #6b3a0e; margin-top: 6px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0 18px; font-size: 10.5pt; }
  th, td { border: 1px solid #d4a373; padding: 7px 9px; text-align: left; vertical-align: top; }
  th { background: #faf3e8; font-weight: 700; }
  tr:nth-child(even) td { background: #fdf8f0; }
  .pagebreak { page-break-after: always; }
  .foot { margin-top: 24px; border-top: 1px solid #d4a373; padding-top: 8px; color: #777; font-size: 9pt; display: flex; justify-content: space-between; }
</style>
</head>
<body>
  <h1>Kundali Matching Report</h1>
  <p class="muted">Prepared for <b>${esc(girl)}</b> &amp; <b>${esc(boy)}</b> · Generated ${esc(genDate)}${meta.reportNo ? ` · Report No. ${esc(meta.reportNo)}` : ""}</p>

  <div class="score">
    <div class="big">${s.totalPoints} / ${s.maximumPoints}</div>
    <div class="band">${esc(s.band)} · ${s.percentage}% compatibility</div>
  </div>

  <h2>Overall Recommendation</h2>
  <p>${esc(s.recommendation || "The charts were compared across the eight Ashtakoot factors. See the breakdown below.")}</p>

  <div class="pagebreak"></div>
  <h2>Ashtakoot (Guna Milan) Breakdown</h2>
  <p>Each of the eight kootas contributes a maximum number of points. The table below shows both partners' values and a short reading of each factor.</p>
  <table>
    <thead><tr><th>Koota</th><th>${esc(girl)}</th><th>${esc(boy)}</th><th>Reading</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="pagebreak"></div>
  <h2>Partner Details</h2>
  <table>
    <thead><tr><th>Attribute</th><th>${esc(girl)}</th><th>${esc(boy)}</th></tr></thead>
    <tbody>
      <tr><td>Nakshatra</td><td>${esc(s.girl.nakshatra)} (Pada ${esc(s.girl.pada)})</td><td>${esc(s.boy.nakshatra)} (Pada ${esc(s.boy.pada)})</td></tr>
      <tr><td>Rashi (Moon sign)</td><td>${esc(s.girl.rasi)}</td><td>${esc(s.boy.rasi)}</td></tr>
      <tr><td>Rashi lord</td><td>${esc(s.girl.lord)}</td><td>${esc(s.boy.lord)}</td></tr>
      <tr><td>Date / time of birth</td><td>${esc(formatBirthDateTime(meta.girlDatetime))}</td><td>${esc(formatBirthDateTime(meta.boyDatetime))}</td></tr>
      <tr><td>Place of birth</td><td>${esc(meta.girlPlace || "—")}</td><td>${esc(meta.boyPlace || "—")}</td></tr>
    </tbody>
  </table>

  <h2>How to read this</h2>
  <p>Guna Milan is a traditional 36-point compatibility framework. A higher score is encouraging, but no score is a verdict on a relationship: individual charts, timing and conscious effort matter far more. Nadi and Bhakoot carry the most weight; where they flag a concern, classical remedies and an in-person consultation are advisable.</p>
  <p class="muted">For guidance only. Not a substitute for professional, medical, legal or financial advice.</p>

  <div class="foot"><span>Generated ${esc(genDate)}</span><span>rashikundali.com</span></div>
</body>
</html>`;
}

export async function renderMatchReportPDF(data: MatchingData, meta: MatchMeta = {}): Promise<Buffer> {
  return htmlToPdf(buildMatchReportHTML(data, meta));
}
