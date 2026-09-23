import { Hono } from "hono";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { getOrderStats, getAllTimeOrderStats } from "../lib/orders.js";
import { getStuckKundalis } from "../lib/store.js";
import { getAllPricingDocs } from "../lib/pricing-store.js";
import { applyPricingPreset, formatPricing, TEST_PRICE } from "../lib/pricing-presets.js";
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

function formatStats(period: string, stats: { totalSales: number; totalRevenue: number; byReport: Record<string, { count: number; revenue: number }> }): string {
  const lines: string[] = [];

  lines.push(`📊 *${period} Stats*`);
  lines.push(`Sales: ${stats.totalSales}`);
  lines.push(`Revenue: ₹${stats.totalRevenue}`);

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
      const stats = await getOrderStats(start, end);
      reply = formatStats("Today", stats);
    } else if (text === "/yesterday") {
      const end = startOfDay(now);
      const start = new Date(end);
      start.setDate(start.getDate() - 1);
      const stats = await getOrderStats(start, end);
      reply = formatStats("Yesterday", stats);
    } else if (text === "/week") {
      const start = startOfDay(now);
      start.setDate(start.getDate() - 7);
      const stats = await getOrderStats(start, now);
      reply = formatStats("This Week", stats);
    } else if (text === "/month") {
      const start = startOfDay(now);
      start.setMonth(start.getMonth() - 1);
      const stats = await getOrderStats(start, now);
      reply = formatStats("This Month", stats);
    } else if (text === "/lastmonth") {
      const now2 = startOfDay(now);
      const end = new Date(now2);
      end.setDate(0);
      const start = new Date(end);
      start.setMonth(start.getMonth() - 1);
      const stats = await getOrderStats(start, end);
      reply = formatStats("Last Month", stats);
    } else if (text === "/overall") {
      const stats = await getAllTimeOrderStats();
      reply = formatStats("Overall (All-Time)", stats);
    } else if (text === "/failed") {
      const since = new Date(now);
      since.setDate(since.getDate() - 7);
      const stuck = await getStuckKundalis(since, 10);
      reply = formatFailed(24 * 7, stuck);
    } else if (text === "/current-pricing" || text === "/current_pricing" || text === "/pricing") {
      reply = formatPricing(await getAllPricingDocs());
    } else if (text === "/test-price" || text === "/test_price" || text === "/testprice") {
      const who = msg.from?.username ?? String(chatId);
      await applyPricingPreset("test", `telegram:${who}`);
      logInfo(`${endpoint} TEST pricing applied by ${who}`);
      reply = `🧪 *Test pricing applied* — every report now charges ₹${TEST_PRICE}.\n\n${formatPricing(await getAllPricingDocs())}`;
    } else if (text === "/actual-price" || text === "/actual_price" || text === "/actualprice") {
      const who = msg.from?.username ?? String(chatId);
      await applyPricingPreset("actual", `telegram:${who}`);
      logInfo(`${endpoint} launch pricing restored by ${who}`);
      reply = `✅ *Launch pricing restored.*\n\n${formatPricing(await getAllPricingDocs())}`;
    } else if (text === "/feedback") {
      reply = "💬 *Feedback*\n\nNo feedback collection is wired up yet — there's no ratings/feedback schema in the DB. Ask if you'd like one added (e.g. a post-download rating prompt).";
    } else if (text === "/start" || text === "/help") {
      reply = "📊 *Kundali Stats Bot*\n\nCommands:\n/today — Today's sales\n/yesterday — Yesterday's sales\n/week — Last 7 days\n/month — Last 30 days\n/lastmonth — Previous calendar month\n/overall — All-time totals\n/failed — Paid orders stuck without a completed report (last 7 days)\n\n*Pricing*\n/current-pricing — Show current prices\n/test-price — Set all reports to ₹9 (testing)\n/actual-price — Restore launch prices\n\n/feedback — Feedback stats (not tracked yet)";
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
