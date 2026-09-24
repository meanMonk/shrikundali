/**
 * Tiny in-memory IP rate limiter.
 *
 * Purpose: guard the public, unauthenticated `/teaser` route — the only
 * public route that spends ProKerala credits per request — against
 * scripted bursts. No external dependency; per-process memory is enough
 * because a burst from one IP hits one process, and the limit is a
 * backstop, not precise accounting (a reverse proxy / multi-instance
 * deploy enforces per-instance).
 */

const hits = new Map<string, number[]>();

export interface RateLimitConfig {
  /** Max counted requests per window per IP. */
  max: number;
  /** Window length in ms. */
  windowMs: number;
}

export function teaserRateLimitConfig(): RateLimitConfig {
  const max = Number(process.env.TEASER_RATE_LIMIT_MAX ?? 20);
  const windowMs = Number(process.env.TEASER_RATE_LIMIT_WINDOW_MS ?? 60_000);
  return {
    max: Number.isFinite(max) && max > 0 ? Math.floor(max) : 20,
    windowMs: Number.isFinite(windowMs) && windowMs > 0 ? Math.floor(windowMs) : 60_000,
  };
}

export function rateLimitEnabled(): boolean {
  return (process.env.TEASER_RATE_LIMIT_ENABLED ?? "true").toLowerCase() !== "false";
}

/** Best-effort client IP, honouring proxies (same approach as checkout.ts). */
export function clientIpFromHeaders(
  forwardedFor: string | undefined,
  realIp: string | undefined,
): string {
  const forwarded = forwardedFor?.split(",")[0]?.trim();
  return forwarded || realIp || "unknown";
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds the client should wait before retrying (0 when allowed). */
  retryAfterSec: number;
}

/**
 * Record a hit for `key` and report whether it's within the limit.
 * Only counted hits (fresh ProKerala-backed teasers) should call this —
 * cacheId lookups serve stored data for free and must not consume budget.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
  now = Date.now(),
): RateLimitResult {
  const cutoff = now - config.windowMs;
  const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);

  if (recent.length >= config.max) {
    const oldest = recent[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + config.windowMs - now) / 1000));
    hits.set(key, recent);
    return { allowed: false, retryAfterSec };
  }

  recent.push(now);
  // Bound memory: drop keys that somehow accumulate without expiry sweeps.
  if (hits.size > 10_000 && !hits.has(key)) {
    const first = hits.keys().next();
    if (!first.done) hits.delete(first.value);
  }
  hits.set(key, recent);
  return { allowed: true, retryAfterSec: 0 };
}

/** Test helper — clears all recorded hits. */
export function resetRateLimits(): void {
  hits.clear();
}
