import { getStuckKundalis } from "./store.js";
import { regenerateReportById } from "./report.js";
import { logInfo, logError } from "./logger.js";

/**
 * Auto-resolve paid-but-ungenerated reports, every 2 hours, with no manual
 * step needed. A stuck kundali (payment confirmed, no completed report,
 * untouched for 15+ minutes) already has everything needed to regenerate —
 * the birth details and, when cached, the ProKerala chart — so this simply
 * retries generatePaidReport for each one via the same path as the
 * Telegram `/retry` command. A successful retry already re-sends the sale
 * alert and emails the customer; a repeat failure stays silent here since
 * the original failure alert (lib/report.ts) already fired once and won't
 * fire again until the doc is fixed.
 */

const STALE_MINUTES = 15;
const LOOKBACK_DAYS = 14;
const INTERVAL_MS = 2 * 60 * 60 * 1000;
const STARTUP_DELAY_MS = 3 * 60 * 1000;

export interface AutoResolveSummary {
  checked: number;
  resolved: number;
  stillFailing: number;
}

export async function autoResolveStuckReports(): Promise<AutoResolveSummary> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const stuck = await getStuckKundalis(since, STALE_MINUTES);

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
    }
  }

  if (stuck.length > 0) {
    logInfo(`auto-resolve: checked ${stuck.length}, resolved ${resolved}, still failing ${stillFailing}`);
  }

  return { checked: stuck.length, resolved, stillFailing };
}

/** Runs inside the API process — no external cron needed. */
export function startAutoResolveScheduler(): void {
  if (process.env.AUTO_RESOLVE_ENABLED === "false") {
    logInfo("auto-resolve: scheduler disabled (AUTO_RESOLVE_ENABLED=false)");
    return;
  }

  const run = () => void autoResolveStuckReports().catch((e) => logError("auto-resolve/scheduler", e));

  const startupTimer = setTimeout(run, STARTUP_DELAY_MS);
  if (typeof startupTimer.unref === "function") startupTimer.unref();

  const timer = setInterval(run, INTERVAL_MS);
  if (typeof timer.unref === "function") timer.unref();

  logInfo("auto-resolve: stuck-report scheduler started (every 2h, first run in 3min)");
}
