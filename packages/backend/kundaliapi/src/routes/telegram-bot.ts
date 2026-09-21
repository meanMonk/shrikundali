import { Hono } from "hono";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { getOrderStats } from "../lib/orders.js";
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
    } else if (text === "/start" || text === "/help") {
      reply = "📊 *Kundali Stats Bot*\n\nCommands:\n/today — Today's sales\n/week — Last 7 days\n/month — Last 30 days\n/lastmonth — Previous calendar month";
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
