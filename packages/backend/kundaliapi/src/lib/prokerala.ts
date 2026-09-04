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
}

export interface KundliResult {
  parsed: KundliData;
  raw: Record<string, unknown>;
}

export interface KundliData {
  status: string;
  data: Record<string, unknown>;
}

export async function getKundli(params: KundliParams): Promise<KundliResult> {
  const token = await getToken();
  const qs = new URLSearchParams({
    coordinates: params.coordinates,
    datetime: params.datetime,
    ayanamsa: String(params.ayanamsa ?? 1),
  });
  if (params.la) qs.set("la", params.la);

  const url = `${BASE}/v2/astrology/kundli?${qs}`;
  logInfo(`ProKerala GET ${url}`);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const raw = (await res.json()) as Record<string, unknown>;

  if (!res.ok) {
    logError("prokerala/kundli", raw);
    throw new Error(`ProKerala kundli error: ${res.status} ${JSON.stringify(raw)}`);
  }

  logResponse("prokerala/kundli", raw);

  return {
    parsed: raw as unknown as KundliData,
    raw,
  };
}

function logResponse(endpoint: string, response: unknown) {
  logInfo(`${endpoint} response keys: ${Object.keys(response as object).join(", ")}`);
}
