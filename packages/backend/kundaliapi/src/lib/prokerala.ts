import { logInfo, logError } from "./logger.js";

const BASE = "https://api.prokerala.com";

type TokenState = { token: string; expiresAt: number };

let cached: TokenState | null = null;

function creds() {
  const id = process.env.PROKERALA_CLIENT_ID ?? "";
  const secret = process.env.PROKERALA_CLIENT_SECRET ?? "";
  if (!id || !secret) throw new Error("PROKERALA_CLIENT_ID and PROKERALA_CLIENT_SECRET must be set");
  return { id, secret };
}

async function getToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt - 60_000) return cached.token;

  const { id, secret } = creds();
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: id,
    client_secret: secret,
  });

  const res = await fetch(`${BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) throw new Error(`ProKerala token error: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  logInfo(`Token refreshed, expires in ${data.expires_in}s`);
  return cached.token;
}

export interface KundliParams {
  coordinates: string;
  datetime: string;
  ayanamsa?: number;
  la?: string;
  detailed?: boolean;
}

export interface KundliResult {
  parsed: KundliData;
  raw: Record<string, unknown>;
}

export interface KundliData {
  status: string;
  data: Record<string, unknown>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface PkResult {
  ok: boolean;
  status: number;
  json: any;
}

async function pkGet(
  path: string,
  qs: URLSearchParams,
  token: string,
  tries = 4,
): Promise<PkResult> {
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const res = await fetch(`${BASE}${path}?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 429) {
        await sleep(1500 * (attempt + 1));
        continue;
      }
      let json: any = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }
      return { ok: res.ok, status: res.status, json };
    } catch (e) {
      logError(`prokerala${path}`, e);
      await sleep(1000 * (attempt + 1));
    }
  }
  return { ok: false, status: 429, json: null };
}

export async function getKundli(params: KundliParams): Promise<KundliResult> {
  const token = await getToken();
  const qs = new URLSearchParams({
    coordinates: params.coordinates,
    datetime: params.datetime,
    ayanamsa: String(params.ayanamsa ?? 1),
  });
  if (params.la) qs.set("la", params.la);

  // Always fetch the chart, planet positions (needed for scores) and panchang.
  // The expensive extras (advanced chart with dasha, doshas) only when detailed.
  const [basic, planets, panchang, advanced, kaalSarp, sadeSati] = await Promise.all([
    pkGet("/v2/astrology/kundli", qs, token),
    pkGet("/v2/astrology/planet-position", qs, token),
    pkGet("/v2/astrology/panchang", qs, token),
    params.detailed ? pkGet("/v2/astrology/kundli/advanced", qs, token) : Promise.resolve(null),
    params.detailed ? pkGet("/v2/astrology/kaal-sarp-dosha", qs, token) : Promise.resolve(null),
    params.detailed ? pkGet("/v2/astrology/sade-sati", qs, token) : Promise.resolve(null),
  ]);

  const chartRes = advanced && advanced.ok ? advanced : basic;
  if (!chartRes || !chartRes.ok || !chartRes.json) {
    logError("prokerala/kundli", chartRes?.json ?? chartRes?.status);
    throw new Error(`ProKerala kundli error: ${chartRes?.status} ${JSON.stringify(chartRes?.json)}`);
  }

  const raw = chartRes.json as Record<string, unknown>;
  logResponse("prokerala/kundli", raw);

  const parsed = raw as unknown as KundliData;
  const baseData = (parsed.data ?? {}) as Record<string, unknown>;

  const planetPositions: unknown[] = planets.json?.data?.planet_position ?? [];
  const basicPositions: unknown[] = ((basic.json?.data as Record<string, unknown> | undefined)?.planet_positions ?? []) as unknown[];
  const advancedPositions: unknown[] = ((advanced?.json?.data as Record<string, unknown> | undefined)?.planet_positions ?? []) as unknown[];
  const kundliPositions: unknown[] = ((baseData as Record<string, unknown>).planet_positions ?? []) as unknown[];
  const hasAscendant = (list: unknown[]) =>
    list.some((p) => String((p as Record<string, unknown>)?.name ?? "").toLowerCase() === "ascendant");
  // Prefer whichever planet list carries the Ascendant row (the advanced chart
  // can omit it; the basic chart and kundli payload include it). Fall back to
  // the first non-empty list so we never blank the lagna/chart.
  const candidates = [kundliPositions, basicPositions, advancedPositions, planetPositions];
  const mergedPositions = candidates.find(hasAscendant) ?? candidates.find((l) => l.length) ?? [];

  // Never return a chart without planetary positions — a partial upstream
  // response (e.g. one endpoint rate-limited) must fail loudly instead of
  // producing or caching an empty chart.
  if (mergedPositions.length === 0) {
    logError("prokerala/kundli", "no planet positions in any response");
    throw new Error("ProKerala returned no planet positions");
  }

  const panchangData = panchang.json?.data ?? null;
  const kaalSarpData = kaalSarp?.json?.data ?? null;
  const sadeSatiData = sadeSati?.json?.data ?? null;

  parsed.data = {
    ...baseData,
    ...(mergedPositions.length ? { planet_positions: mergedPositions } : {}),
    ...(panchangData ? { panchang: panchangData } : {}),
    ...(kaalSarpData ? { kaal_sarp_dosha: kaalSarpData } : {}),
    ...(sadeSatiData ? { sade_sati: sadeSatiData } : {}),
  };

  return {
    parsed,
    raw: {
      ...raw,
      planet_position: mergedPositions,
      panchang: panchangData,
      kaal_sarp_dosha: kaalSarpData,
      sade_sati: sadeSatiData,
    },
  };
}

/* ────────────────────────────────────────────────────────────
   Kundli Matching (Ashtakoot / Guna Milan)
   ──────────────────────────────────────────────────────────── */

export interface KootInfo {
  varna: string;
  vasya: string;
  tara: string;
  yoni: string;
  graha_maitri: string;
  gana: string;
  bhakoot: string;
  nadi: string;
}

export interface MatchPartnerInfo {
  koot: KootInfo;
  nakshatra: Record<string, unknown>;
  rasi: Record<string, unknown>;
}

export interface MatchingData {
  status: string;
  data: {
    girl_info: MatchPartnerInfo;
    boy_info: MatchPartnerInfo;
    message: { type: string; description: string };
    guna_milan: { total_points: number; maximum_points: number };
  };
}

export interface MatchingParams {
  girlCoordinates: string;
  girlDob: string;
  boyCoordinates: string;
  boyDob: string;
  ayanamsa?: number;
  la?: string;
}

export async function getKundliMatching(params: MatchingParams): Promise<MatchingData> {
  const token = await getToken();
  const qs = new URLSearchParams({
    ayanamsa: String(params.ayanamsa ?? 1),
    girl_coordinates: params.girlCoordinates,
    girl_dob: params.girlDob,
    boy_coordinates: params.boyCoordinates,
    boy_dob: params.boyDob,
  });
  if (params.la) qs.set("la", params.la);

  const res = await pkGet("/v2/astrology/kundli-matching", qs, token);
  if (!res.ok || !res.json) {
    logError("prokerala/kundli-matching", res.json ?? res.status);
    throw new Error(`ProKerala matching error: ${res.status} ${JSON.stringify(res.json)}`);
  }
  logResponse("prokerala/kundli-matching", res.json);
  return res.json as MatchingData;
}

/* ────────────────────────────────────────────────────────────
   PDF Report API (full paragraph report generated by ProKerala)
   ──────────────────────────────────────────────────────────── */

export interface PersonalReportInput {
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  datetime: string;
  coordinates: string;
  place?: string;
  gender?: string;
}

export interface PersonalReportModule {
  name: string;
  options?: Record<string, unknown>;
}

export interface PersonalReportOptions {
  language?: string;
  brandName?: string;
  reportName?: string;
  caption?: string;
  templateStyle?: string;
  footer?: string;
  modules?: PersonalReportModule[];
}

/** Default module set for a comprehensive 40+ page personal report. */
export const DEFAULT_PERSONAL_REPORT_MODULES: PersonalReportModule[] = [
  { name: "birth-details" },
  { name: "chart", options: { chart_style: "north-indian" } },
  { name: "planet-position" },
  { name: "sudharshanachakra-chart" },
  { name: "mangal-dosha", options: { chart_style: "north-indian" } },
  { name: "yoga-details" },
  { name: "kaal-sarp-dosha", options: { chart_style: "north-indian" } },
  { name: "planet-relationship" },
  { name: "sarvashtakavarga-chart", options: { chart_style: "north-indian", planet_ashtakavarga: "all" } },
  { name: "sade-sati", options: { chart_style: "north-indian" } },
  { name: "shodashvarga-chart", options: { chart_style: "south-indian" } },
  { name: "dasa-periods" },
  { name: "papa-dosha", options: { chart_style: "north-indian" } },
];

export class ProkeralaQuotaError extends Error {}

export async function getPersonalReportPdf(
  input: PersonalReportInput,
  options: PersonalReportOptions = {},
): Promise<Buffer> {
  const token = await getToken();
  const payload = {
    input: {
      first_name: input.first_name ?? "",
      middle_name: input.middle_name ?? "",
      last_name: input.last_name ?? "",
      datetime: input.datetime,
      coordinates: input.coordinates,
      place: input.place ?? input.coordinates,
      gender: input.gender ?? "",
    },
    options: {
      la: options.language ?? "en",
      modules: options.modules ?? DEFAULT_PERSONAL_REPORT_MODULES,
      template: {
        style: options.templateStyle ?? "vedic-astro-green",
        footer: options.footer ?? "rashikundali.com",
      },
      report: {
        name: options.reportName ?? "Kundali Report",
        caption: options.caption ?? "Generated by Rashi Kundali",
        brand_name: options.brandName ?? "Rashi Kundali",
      },
    },
  };

  logInfo("ProKerala POST /v2/report/personal-reading/instant");
  const res = await fetch(`${BASE}/v2/report/personal-reading/instant`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    logError("prokerala/personal-report", `${res.status} ${text}`);
    if (res.status === 403 || /credit/i.test(text)) {
      throw new ProkeralaQuotaError(`ProKerala report unavailable: ${res.status} ${text}`);
    }
    throw new Error(`ProKerala report failed: ${res.status} ${text}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

function logResponse(endpoint: string, response: unknown) {
  logInfo(`${endpoint} response keys: ${Object.keys(response as object).join(", ")}`);
}
