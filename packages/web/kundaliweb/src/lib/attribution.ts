const STORAGE_KEY = "sk_attribution";

const TRACKED_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
  "gbraid",
  "wbraid",
  "fbclid",
] as const;

type Attribution = Record<string, string>;

function read(): Attribution {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Attribution) : {};
  } catch {
    return {};
  }
}

function write(value: Attribution) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {}
}

export function getAttribution(): Attribution {
  return read();
}

export function captureAttribution(): Attribution {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const found: Attribution = {};
  for (const key of TRACKED_PARAMS) {
    const value = params.get(key);
    if (value) found[key] = value;
  }

  const existing = read();
  if (Object.keys(found).length === 0) return existing;

  const merged: Attribution = {
    ...existing,
    ...found,
    landing_page: existing.landing_page || window.location.pathname + window.location.search,
    first_seen: existing.first_seen || new Date().toISOString(),
  };
  write(merged);
  return merged;
}

export function attributionParams(): Attribution {
  const data = read();
  const out: Attribution = {};
  for (const key of TRACKED_PARAMS) {
    if (data[key]) out[key] = data[key];
  }
  if (data.landing_page) out.landing_page = data.landing_page;
  return out;
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const escaped = name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

export function getMetaCookies(): { fbp?: string; fbc?: string } {
  return { fbp: readCookie("_fbp"), fbc: readCookie("_fbc") };
}

export function getGaClientId(): string | undefined {
  const ga = readCookie("_ga");
  if (!ga) return undefined;
  const parts = ga.split(".");
  return parts.length >= 4 ? `${parts[2]}.${parts[3]}` : undefined;
}

/** Attribution payload sent to the backend on teaser + checkout. */
export function checkoutAttribution(): Attribution {
  const out = attributionParams();
  const { fbp, fbc } = getMetaCookies();
  if (fbp) out.fbp = fbp;
  if (fbc) out.fbc = fbc;
  const clientId = getGaClientId();
  if (clientId) out.ga_client_id = clientId;
  if (typeof window !== "undefined") {
    out.landing_page = out.landing_page || window.location.pathname + window.location.search;
    out.referrer = out.referrer || document.referrer || "";
  }
  return out;
}
