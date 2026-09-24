import { getStuckKundalis, updateKundali, updateKundaliByOrderId } from "./store.js";
import { regenerateReportById } from "./report.js";
import { notifyAdminAutoResolve } from "./telegram.js";
import { logInfo, logError } from "./logger.js";

/**
 * Auto-resolve paid-but-ungenerated reports once a day, early morning IST,
 * with no manual step needed. A stuck kundali (payment confirmed, no completed
 * report, untouched for 15+ minutes) already has everything needed to
 * regenerate — the birth details and, when cached, the ProKerala chart — so
 * this simply retries generatePaidReport for each one via the same path as the
 * Telegram `/retry` command. A successful retry already re-sends the sale
 * alert and emails the customer; either way, a summary of what this run
 * found/fixed is posted to Telegram so a resolve is visible without anyone
 * having to check the original failure alert or run `/failed`.
 *
 * Guardrails (added after a ProKerala credit-exhaustion incident where the
 * old 2-hourly cron kept re-billing the same permanently-broken orders):
 * only orders from the last 24h are considered, and each order gets exactly
 * ONE auto-resolve attempt ever — `autoResolveAttempted` is set on the doc
 * win or lose, so a repeat failure (e.g. ProKerala still out of credit)
 * never gets retried automatically again. Older/already-attempted orders
 * still show up in `/failed` and can be fixed by hand with `/retry <id>`.
 */

const STALE_MINUTES = 15;
const LOOKBACK_DAYS = 1;

const RESOLVE_HOUR = 6;
const RESOLVE_MINUTE = 30;
const WINDOW_MINUTES = 5;

/** IST calendar/time parts for a given instant (Asia/Kolkata). */
function istParts(d = new Date()): { ymd: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    ymd: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

export interface AutoResolveSummary {
  checked: number;
  resolved: number;
  stillFailing: number;
}

export async function autoResolveStuckReports(): Promise<AutoResolveSummary> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const allStuck = await getStuckKundalis(since, STALE_MINUTES);
  // Never auto-retry an order a second time — one shot only, win or lose.
  const stuck = allStuck.filter((doc) => !doc.autoResolveAttempted);

  let resolved = 0;
  let stillFailing = 0;

  for (const doc of stuck) {
    try {
      const result = await regenerateReportById(doc.orderId ?? doc.id);
      if (result.ok && result.downloadUrl) resolved++;
      else stillFailing++;
    } catch (e) {
      stillFailing++;
      logError("auto-resolve", e);
    } finally {
      // Mark attempted regardless of outcome so this order is never picked
      // up by the cron again — a repeat failure needs a manual `/retry`.
      if (doc.orderId) await updateKundaliByOrderId(doc.orderId, { autoResolveAttempted: true });
      else await updateKundali(doc.id, { autoResolveAttempted: true });
    }
  }

  if (stuck.length > 0) {
    logInfo(`auto-resolve: checked ${stuck.length}, resolved ${resolved}, still failing ${stillFailing}`);
    // Only ping when the run actually did something — a quiet run (nothing
    // stuck) stays silent so this doesn't become daily noise.
    await notifyAdminAutoResolve({ checked: stuck.length, resolved, stillFailing }).catch((e) =>
      logError("auto-resolve/telegram", e),
    );
  }

  return { checked: stuck.length, resolved, stillFailing };
}

/**
 * Fire once a day at 06:30 IST (an hour before the founder digest, so the
 * digest reflects post-resolution state). Runs inside the API process — no
 * external cron needed. Ticks every minute and only runs once per IST day
 * (within a 5-minute window so a restart in the window still fires).
 */
export function startAutoResolveScheduler(): void {
  if (process.env.AUTO_RESOLVE_ENABLED === "false") {
    logInfo("auto-resolve: scheduler disabled (AUTO_RESOLVE_ENABLED=false)");
    return;
  }

  let lastRunYmd = "";

  const tick = async () => {
    try {
      const { ymd, hour, minute } = istParts();
      const mins = hour * 60 + minute;
      const target = RESOLVE_HOUR * 60 + RESOLVE_MINUTE;
      if (mins < target || mins > target + WINDOW_MINUTES) return;
      if (lastRunYmd === ymd) return;
      lastRunYmd = ymd;
      await autoResolveStuckReports();
    } catch (e) {
      logError("auto-resolve/scheduler", e);
    }
  };

  const timer = setInterval(() => void tick(), 60_000);
  if (typeof timer.unref === "function") timer.unref();

  logInfo(
    `auto-resolve: stuck-report scheduler started (daily at ${RESOLVE_HOUR}:${String(RESOLVE_MINUTE).padStart(2, "0")} IST)`,
  );
}
