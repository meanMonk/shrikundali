import { Hono } from "hono";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { getOrderStats, getAllTimeOrderStats, getOrderStatusBreakdown } from "../lib/orders.js";
import {
  getStuckKundalis,
  getKundaliStats,
  listKundaliLeads,
  type LeadRow,
  type LeadStats,
} from "../lib/store.js";
import { getAllPricingDocs } from "../lib/pricing-store.js";
import { applyPricingPreset, formatPricing, TEST_PRICE } from "../lib/pricing-presets.js";
import { getAttributionBreakdown, type AttributionRow } from "../lib/attribution-stats.js";
import { logInfo, logError } from "../lib/logger.js";

const telegramBotApp = new OpenAPIHono();

const TelegramUpdate = z.object({
  update_id: z.number(),
  message: z.object({
    chat: z.object({ id: z.number() }),
    text: z.string().optional(),
    from: z.object({
      id: z.number(),
      username: z.string().optional(),
      first_name: z.string().optional(),
    }).optional(),
  }).optional(),
});

function getISTDate(d: Date): Date {
  return new Date(d.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
}

function startOfDay(d: Date): Date {
  const ist = getISTDate(d);
  ist.setHours(0, 0, 0, 0);
  return ist;
}

function formatStats(
  period: string,
  stats: { totalSales: number; totalRevenue: number; byReport: Record<string, { count: number; revenue: number }> },
  leads?: LeadStats,
): string {
  const lines: string[] = [];

  lines.push(`📊 *${period} Stats*`);
  lines.push(`Sales: ${stats.totalSales}`);
  lines.push(`Revenue: ₹${stats.totalRevenue}`);

  if (leads) {
    lines.push(`Users (details submitted): ${leads.total}`);
    lines.push(`Emails captured: ${leads.uniqueEmails} unique`);
  }

  const reportTypes = Object.entries(stats.byReport);
  if (reportTypes.length > 1) {
    lines.push("");
    lines.push("*By Report Type:*");
    for (const [type, data] of reportTypes) {
      lines.push(`• ${type}: ${data.count} sales, ₹${data.revenue}`);
    }
  }

  return lines.join("\n");
}

function formatIST(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatLeadSummary(leads: LeadStats): string {
  const lines: string[] = [];
  lines.push(`Total users: ${leads.total}`);
  lines.push(`Emails: ${leads.uniqueEmails} unique • ${leads.withEmail} with email`);
  const stages = Object.entries(leads.byStatus).sort((a, b) => b[1] - a[1]);
  if (stages.length) lines.push(`Stages: ${stages.map(([s, n]) => `${s} ${n}`).join(" • ")}`);
  return lines.join("\n");
}

function formatUsers(leads: LeadStats, rows: LeadRow[]): string {
  const lines: string[] = ["👥 *Users — Submitted Details*", "", formatLeadSummary(leads)];

  const byType = Object.entries(leads.byReportType).sort((a, b) => b[1] - a[1]);
  if (byType.length) {
    lines.push("", "*By report:*");
    for (const [type, count] of byType) lines.push(`• ${type}: ${count}`);
  }

  if (rows.length) {
    lines.push("", `*Recent ${rows.length}:*`);
    for (const r of rows) {
      lines.push(
        `• ${r.name || "—"} — ${r.email || "no email"} — ${r.reportType} — ${r.status} — ${formatIST(r.createdAt)}`,
      );
    }
  }
  return lines.join("\n");
}

function formatEmails(leads: LeadStats, rows: LeadRow[]): string {
  const lines: string[] = [
    "📧 *Captured Emails*",
    `Unique: ${leads.uniqueEmails} • With email: ${leads.withEmail} • Total users: ${leads.total}`,
    "",
  ];
  if (!rows.length) {
    lines.push("No emails captured yet.");
  } else {
    for (const r of rows) {
      lines.push(`• ${r.email}${r.name ? ` (${r.name})` : ""} — ${r.reportType} — ${formatIST(r.createdAt)}`);
    }
    if (leads.uniqueEmails > rows.length) {
      lines.push("", `… ${leads.uniqueEmails - rows.length} more not shown`);
    }
  }
  return lines.join("\n");
}

const STATUS_EMOJI: Record<string, string> = {
  pending: "⏳",
  paid: "💳",
  completed: "✅",
  failed: "❌",
  refunded: "↩️",
};

function formatTransactions(
  period: string,
  breakdown: Awaited<ReturnType<typeof getOrderStatusBreakdown>>,
): string {
  const lines: string[] = [`🧾 *Transactions — ${period}*`, `Total orders: ${breakdown.total}`, ""];

  for (const status of ["completed", "paid", "pending", "failed", "refunded"]) {
    const entry = breakdown.byStatus[status];
    if (!entry) continue;
    const emoji = STATUS_EMOJI[status] ?? "•";
    const revenue = status === "completed" ? ` (₹${entry.revenue})` : "";
    lines.push(`${emoji} ${status}: ${entry.count}${revenue}`);
  }

  const failedOrders = breakdown.orders.filter((o) => o.status === "failed");
  if (failedOrders.length) {
    lines.push("", "*Recent failed:*");
    for (const o of failedOrders.slice(0, 10)) {
      lines.push(`• ${o.email || "no email"} — ${o.reportType} — ₹${o.amount} — ${formatIST(o.createdAt)}`);
    }
    if (failedOrders.length > 10) lines.push(`… and ${failedOrders.length - 10} more`);
  }

  return lines.join("\n");
}

function formatFailed(hours: number, stuck: Awaited<ReturnType<typeof getStuckKundalis>>): string {
  const lines: string[] = [];
  lines.push(`⚠️ *Failed / Stuck (last ${hours}h)*`);
  lines.push(`Count: ${stuck.length}`);

  if (stuck.length) {
    lines.push("");
    for (const d of stuck.slice(0, 15)) {
      const ageMin = Math.round((Date.now() - new Date(d.generatingAt ?? d.createdAt).getTime()) / 60000);
      lines.push(`• ${d.reportLabel || d.reportType} — ${d.email || "no email"} — status: ${d.status}, stuck ${ageMin}m`);
    }
    if (stuck.length > 15) lines.push(`… and ${stuck.length - 15} more`);
  }

  return lines.join("\n");
}

function formatAttribution(title: string, rows: AttributionRow[]): string {
  const lines: string[] = [`📈 *${title}*`, ""];
  if (!rows.length) {
    lines.push("No leads or orders in this window yet.");
    return lines.join("\n");
  }

  const totalLeads = rows.reduce((s, r) => s + r.leads, 0);
  const totalPaid = rows.reduce((s, r) => s + r.completed, 0);
  for (const r of rows.slice(0, 20)) {
    const cvr = r.leads ? Math.round((r.completed / r.leads) * 100) : 0;
    lines.push(
      `• *${r.key}* — leads ${r.leads} · orders ${r.orders} · paid ${r.completed} (${cvr}%) · ₹${r.revenue}`,
    );
  }
  if (rows.length > 20) lines.push(`… and ${rows.length - 20} more`);
  lines.push("", `Totals: ${totalLeads} leads · ${totalPaid} paid`);
  return lines.join("\n");
}

function lastNDays(days: number): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return { start, end };
}

/**
 * Bot command reference. Telegram command names allow only a-z, 0-9 and "_",
 * so multi-word commands use underscores and short joined aliases (e.g.
 * `/test_price` or `/testprice`) — never hyphens.
 */
const HELP_TEXT = [
  "📊 *Kundali Stats Bot*",
  "",
  "*Sales*",
  "/today — Today's sales + users",
  "/yesterday — Yesterday's sales + users",
  "/week — Last 7 days",
  "/month — Last 30 days",
  "/lastmonth — Previous calendar month",
  "/overall — All-time totals",
  "",
  "*Attribution*",
  "/sources — traffic + conversions by utm_source (30d)",
  "/campaigns — traffic + conversions by utm_campaign (30d)",
  "/sources_all · /campaigns_all — same, all-time",
  "",
  "*Transactions*",
  "/txns — pending/paid/completed/failed (last 7 days)",
  "/txns_today — same, for today only",
  "",
  "*Users*",
  "/users — users who submitted details (count + recent)",
  "/emails — captured emails (unique count + list)",
  "",
  "*Pricing*",
  "/current_pricing — show current prices",
  "/test_price — set all reports to ₹9 (testing)",
  "/actual_price — restore launch prices",
  "",
  "*Ops*",
  "/failed — paid orders stuck without a completed report (last 7 days)",
  "",
  "/feedback — feedback stats (not tracked yet)",
].join("\n");

const webhookRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Telegram Bot"],
  summary: "Telegram bot webhook (handles /commands)",
  responses: {
    200: { description: "Webhook processed" },
  },
});

telegramBotApp.openapi(webhookRoute, async (c) => {
  const endpoint = "/telegram/bot";
  try {
    const body = await c.req.json();
    const parsed = TelegramUpdate.safeParse(body);

    if (!parsed.success || !parsed.data.message) {
      return c.json({ status: "ok" });
    }

    const msg = parsed.data.message;
    const chatId = msg.chat.id;
    const text = msg.text?.trim() ?? "";

    const botToken = process.env.TELEGRAM_BOT_TOKEN ?? "";
    if (!botToken) {
      logError(endpoint, "TELEGRAM_BOT_TOKEN not set");
      return c.json({ status: "error" });
    }

    const allowedChats = (process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_CHAT_ID || "").split(",").map(s => s.trim());
    if (!allowedChats.includes(String(chatId))) {
      logInfo(`${endpoint} unauthorized chat: ${chatId}`);
      return c.json({ status: "ok" });
    }

    let reply: string | null = null;
    const now = new Date();

    if (text === "/today") {
      const start = startOfDay(now);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const [stats, leads] = await Promise.all([
        getOrderStats(start, end),
        getKundaliStats(start, end),
      ]);
      reply = formatStats("Today", stats, leads);
    } else if (text === "/yesterday") {
      const end = startOfDay(now);
      const start = new Date(end);
      start.setDate(start.getDate() - 1);
      const [stats, leads] = await Promise.all([
        getOrderStats(start, end),
        getKundaliStats(start, end),
      ]);
      reply = formatStats("Yesterday", stats, leads);
    } else if (text === "/week") {
      const start = startOfDay(now);
      start.setDate(start.getDate() - 7);
      const [stats, leads] = await Promise.all([
        getOrderStats(start, now),
        getKundaliStats(start, now),
      ]);
      reply = formatStats("This Week", stats, leads);
    } else if (text === "/month") {
      const start = startOfDay(now);
      start.setMonth(start.getMonth() - 1);
      const [stats, leads] = await Promise.all([
        getOrderStats(start, now),
        getKundaliStats(start, now),
      ]);
      reply = formatStats("This Month", stats, leads);
    } else if (text === "/lastmonth") {
      const now2 = startOfDay(now);
      const end = new Date(now2);
      end.setDate(0);
      const start = new Date(end);
      start.setMonth(start.getMonth() - 1);
      const [stats, leads] = await Promise.all([
        getOrderStats(start, end),
        getKundaliStats(start, end),
      ]);
      reply = formatStats("Last Month", stats, leads);
    } else if (text === "/overall") {
      const [stats, leads] = await Promise.all([getAllTimeOrderStats(), getKundaliStats()]);
      reply = formatStats("Overall (All-Time)", stats, leads);
    } else if (text === "/users" || text === "/leads") {
      const [leads, rows] = await Promise.all([getKundaliStats(), listKundaliLeads(15)]);
      reply = formatUsers(leads, rows);
    } else if (text === "/emails") {
      const [leads, rows] = await Promise.all([
        getKundaliStats(),
        listKundaliLeads(30, { onlyWithEmail: true }),
      ]);
      reply = formatEmails(leads, rows);
    } else if (text === "/failed") {
      const since = new Date(now);
      since.setDate(since.getDate() - 7);
      const stuck = await getStuckKundalis(since, 10);
      reply = formatFailed(24 * 7, stuck);
    } else if (text === "/txns" || text === "/transactions" || text === "/payments") {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      reply = formatTransactions("Last 7 Days", await getOrderStatusBreakdown(start, now));
    } else if (text === "/txns_today" || text === "/transactions_today" || text === "/txnstoday") {
      const start = startOfDay(now);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      reply = formatTransactions("Today", await getOrderStatusBreakdown(start, end));
    } else if (text === "/sources" || text === "/source" || text === "/utm_sources") {
      const { start, end } = lastNDays(30);
      reply = formatAttribution("Traffic by Source — last 30 days", await getAttributionBreakdown("utm_source", start, end));
    } else if (text === "/campaigns" || text === "/campaign" || text === "/utm_campaigns") {
      const { start, end } = lastNDays(30);
      reply = formatAttribution("Traffic by Campaign — last 30 days", await getAttributionBreakdown("utm_campaign", start, end));
    } else if (text === "/sources_all" || text === "/sourcesall" || text === "/utm_sources_all") {
      reply = formatAttribution("Traffic by Source — all-time", await getAttributionBreakdown("utm_source"));
    } else if (text === "/campaigns_all" || text === "/campaignsall" || text === "/utm_campaigns_all") {
      reply = formatAttribution("Traffic by Campaign — all-time", await getAttributionBreakdown("utm_campaign"));
    } else if (text === "/current_pricing" || text === "/pricing" || text === "/currentpricing") {
      reply = formatPricing(await getAllPricingDocs());
    } else if (text === "/test_price" || text === "/testprice") {
      const who = msg.from?.username ?? String(chatId);
      await applyPricingPreset("test", `telegram:${who}`);
      logInfo(`${endpoint} TEST pricing applied by ${who}`);
      reply = `🧪 *Test pricing applied* — every report now charges ₹${TEST_PRICE}.\n\n${formatPricing(await getAllPricingDocs())}`;
    } else if (text === "/actual_price" || text === "/actualprice") {
      const who = msg.from?.username ?? String(chatId);
      await applyPricingPreset("actual", `telegram:${who}`);
      logInfo(`${endpoint} launch pricing restored by ${who}`);
      reply = `✅ *Launch pricing restored.*\n\n${formatPricing(await getAllPricingDocs())}`;
    } else if (text === "/feedback") {
      reply = "💬 *Feedback*\n\nNo feedback collection is wired up yet — there's no ratings/feedback schema in the DB. Ask if you'd like one added (e.g. a post-download rating prompt).";
    } else if (text === "/start" || text === "/help") {
      reply = HELP_TEXT;
    }

    if (reply) {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: reply,
          parse_mode: "Markdown",
        }),
      });
      logInfo(`${endpoint} replied to /${text} for chat ${chatId}`);
    }

    return c.json({ status: "ok" });
  } catch (e) {
    logError(endpoint, e);
    return c.json({ status: "error" });
  }
});

export { telegramBotApp };
