import { getAllTimeOrderStats, getOrderStats, getOrderStatusBreakdown } from "./orders.js";
import { getKundaliStats, getStuckKundalis } from "./store.js";
import { getAttributionBreakdown } from "./attribution-stats.js";
import { getSupportTicketStats } from "./support.js";
import { notifyFounderDigest } from "./telegram.js";
import { sendFounderDigestEmail, founderInbox } from "./email.js";
import { logInfo, logError } from "./logger.js";

/**
 * Daily business-overview digest for the founder (Telegram + email),
 * scheduled for 07:30 IST by `startDailyDigestScheduler()`.
 */

function istParts(d = new Date()): {
  ymd: string;
  hour: number;
  minute: number;
} {
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

function istLabel(d = new Date()): string {
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** IST-anchored start of day. */
function startOfTodayIST(): Date {
  const { ymd } = istParts();
  // 00:00 IST == 18:30 UTC the previous day.
  return new Date(`${ymd}T00:00:00+05:30`);
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function inr(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

export interface FounderDigest {
  telegram: string;
  subject: string;
  emailHtml: string;
}

export async function buildFounderDigest(): Promise<FounderDigest> {
  const now = new Date();
  const dayStart = startOfTodayIST();

  const [
    todayOrders,
    weekOrders,
    monthOrders,
    allTime,
    todayBreakdown,
    todayLeads,
    sources,
    tickets,
  ] = await Promise.all([
    getOrderStats(dayStart, now),
    getOrderStats(daysAgo(7), now),
    getOrderStats(daysAgo(30), now),
    getAllTimeOrderStats(),
    getOrderStatusBreakdown(dayStart, now),
    getKundaliStats(dayStart, now),
    getAttributionBreakdown("utm_source", daysAgo(30), now),
    getSupportTicketStats(),
  ]);

  const stuck = await getStuckKundalis(daysAgo(1), 30).catch(() => []);
  const paidToday = todayBreakdown.byStatus["completed"]?.count ?? 0;
  const createdToday = todayBreakdown.total;
  const cvr = todayLeads.total ? Math.round((paidToday / todayLeads.total) * 100) : 0;

  const topSources = sources.slice(0, 5);
  const sourceLines = topSources.length
    ? topSources.map(
        (s) => `• ${s.key} — leads ${s.leads} · paid ${s.completed} · ${inr(s.revenue)}`,
      )
    : ["• No campaign data yet (traffic so far is direct)."];

  const telegram = [
    "📊 *Rashi Kundali — Morning Digest*",
    `🗓 ${istLabel(now)}`,
    "",
    "*Earnings & Orders*",
    `• Today — ${todayOrders.totalSales} orders · ${inr(todayOrders.totalRevenue)}`,
    `• Last 7 days — ${weekOrders.totalSales} orders · ${inr(weekOrders.totalRevenue)}`,
    `• Last 30 days — ${monthOrders.totalSales} orders · ${inr(monthOrders.totalRevenue)}`,
    `• All-time — ${allTime.totalSales} orders · ${inr(allTime.totalRevenue)}`,
    "",
    "*Today's funnel*",
    `• Form leads: ${todayLeads.total}`,
    `• Orders created: ${createdToday} (paid: ${paidToday})`,
    `• Lead → paid: ${cvr}%`,
    "",
    "*Top sources (30d)*",
    ...sourceLines,
    "",
    "*Ops*",
    `• Open support tickets: ${tickets.open} (total ${tickets.total})`,
    `• Stuck report generations (24h): ${stuck.length}`,
  ].join("\n");

  const row = (label: string, r: { totalSales: number; totalRevenue: number }) =>
    `<tr><td style="padding:0.3rem 0.75rem 0.3rem 0;color:#777;">${label}</td><td style="padding:0.3rem 0;color:#111;font-weight:600;">${r.totalSales} orders · ${inr(r.totalRevenue)}</td></tr>`;

  const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Georgia, serif; color: #1a1a1a; max-width: 640px; margin: 0 auto; padding: 2rem;">
  <h1 style="color: #8b4513; border-bottom: 2px solid #d4a373; padding-bottom: 0.5rem;">Morning Digest</h1>
  <p style="color:#666;font-size:0.9rem;">${istLabel(now)} · Rashi Kundali</p>

  <h2 style="font-size:1rem;color:#6b3a0e;">Earnings &amp; Orders</h2>
  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:#faf3e8;border:1px solid #e8dfd1;border-radius:8px;padding:0.5rem;">
    ${row("Today", todayOrders)}
    ${row("Last 7 days", weekOrders)}
    ${row("Last 30 days", monthOrders)}
    ${row("All-time", allTime)}
  </table>

  <h2 style="font-size:1rem;color:#6b3a0e;">Today's funnel</h2>
  <p style="margin:0.2rem 0;">Form leads: <strong>${todayLeads.total}</strong> · Orders created: <strong>${createdToday}</strong> · Paid: <strong>${paidToday}</strong> · Lead→paid: <strong>${cvr}%</strong></p>

  <h2 style="font-size:1rem;color:#6b3a0e;">Top sources (30d)</h2>
  <p style="margin:0.2rem 0;font-size:0.9rem;color:#333;">${topSources.length ? topSources.map((s) => `${s.key} — leads ${s.leads} · paid ${s.completed} · ${inr(s.revenue)}`).join("<br>") : "No campaign data yet (traffic so far is direct)."}</p>

  <h2 style="font-size:1rem;color:#6b3a0e;">Ops</h2>
  <p style="margin:0.2rem 0;">Open support tickets: <strong>${tickets.open}</strong> (total ${tickets.total})<br>Stuck report generations (24h): <strong>${stuck.length}</strong></p>

  <hr style="border: none; border-top: 1px solid #d4a373; margin: 2rem 0;">
  <p style="font-size: 0.8rem; color: #888; text-align: center;"><a href="https://rashikundali.com" style="color:#888;">rashikundali.com</a></p>
</body>
</html>`;

  return {
    telegram,
    subject: `Rashi Kundali — Morning Digest (${todayOrders.totalSales} orders today, ${inr(todayOrders.totalRevenue)})`,
    emailHtml,
  };
}

/** Build and send the digest to Telegram + founder email. Returns what succeeded. */
export async function sendFounderDigest(): Promise<{ telegram: boolean; email: boolean }> {
  const digest = await buildFounderDigest();
  const [telegram, email] = await Promise.all([
    notifyFounderDigest(digest.telegram).catch(() => false),
    sendFounderDigestEmail(digest.subject, digest.emailHtml).catch(() => false),
  ]);
  logInfo(`digest: sent (telegram=${telegram}, email=${email} → ${founderInbox()})`);
  return { telegram, email };
}

const DIGEST_HOUR = 7;
const DIGEST_MINUTE = 30;
const WINDOW_MINUTES = 5;

/**
 * Fire the digest every day at 07:30 IST. Runs inside the API process — no
 * external cron needed. Ticks every minute and only sends once per IST day
 * (within a 5-minute window so a restart in the window still fires).
 */
export function startDailyDigestScheduler(): void {
  if (process.env.DIGEST_ENABLED === "false") {
    logInfo("digest: scheduler disabled (DIGEST_ENABLED=false)");
    return;
  }
  let lastSentYmd = "";

  const tick = async () => {
    try {
      const { ymd, hour, minute } = istParts();
      const mins = hour * 60 + minute;
      const target = DIGEST_HOUR * 60 + DIGEST_MINUTE;
      if (mins < target || mins > target + WINDOW_MINUTES) return;
      if (lastSentYmd === ymd) return;
      lastSentYmd = ymd;
      await sendFounderDigest();
    } catch (e) {
      logError("digest/scheduler", e);
    }
  };

  const timer = setInterval(() => void tick(), 60_000);
  if (typeof timer.unref === "function") timer.unref();
  logInfo(`digest: daily founder digest scheduled for ${DIGEST_HOUR}:${String(DIGEST_MINUTE).padStart(2, "0")} IST`);
}
