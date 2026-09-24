import { serve } from "@hono/node-server";
import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { setupDocs } from "./docs.js";
import { closeBrowser } from "./lib/render.js";
import { notifyAdminServiceStart } from "./lib/telegram.js";
import { checkoutApp } from "./routes/checkout.js";
import { configApp } from "./routes/config.js";
import { dbRoutes } from "./routes/db.js";
import { downloadApp } from "./routes/download.js";
import { healthRoutes } from "./routes/health.js";
import { pricingApp } from "./routes/pricing.js";
import { refundsApp } from "./routes/refunds.js";
import { regenerateApp } from "./routes/regenerate.js";
import { supportApp } from "./routes/support.js";
import { digestApp } from "./routes/digest.js";
import { startDailyDigestScheduler } from "./lib/digest.js";
import { startAutoResolveScheduler } from "./lib/auto-resolve.js";
import { teaserApp } from "./routes/teaser.js";
import { telegramBotApp } from "./routes/telegram-bot.js";
import { webhookApp } from "./routes/webhook.js";

const app = new Hono();

const allowedOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:3000,http://127.0.0.1:3000")
  .split(",")
  .map((o) => o.trim());

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: allowedOrigins,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "x-admin-token"],
  })
);
app.route("/health", healthRoutes);
app.route("/db", dbRoutes);
app.route("/teaser", teaserApp);
app.route("/payment", checkoutApp);
app.route("/payment", refundsApp);
app.route("/regenerate", regenerateApp);
app.route("/webhook", webhookApp);
app.route("/download", downloadApp);
app.route("/support", supportApp);
app.route("/digest", digestApp);
app.route("/api/config", configApp);
app.route("/api/pricing", pricingApp);
app.route("/telegram/bot", telegramBotApp);
setupDocs(app);

const port = Number(process.env.PORT ?? 3000);
console.log(`kundaliapi listening on :${port}  (docs: http://localhost:${port}/docs)`);

serve({ fetch: app.fetch, port });

// Daily founder digest at 07:30 IST (Telegram + email).
startDailyDigestScheduler();

// Auto-retry paid-but-ungenerated reports daily at 06:30 IST.
startAutoResolveScheduler();

// Ensure the Puppeteer browser process is always closed on restart/redeploy —
// left running, it leaks Chromium processes and grows container memory over time.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, async () => {
    console.log(`[Server] ${signal} received, closing browser and shutting down...`);
    await closeBrowser();
    process.exit(0);
  });
}

// Fire-and-forget admin alert so a (re)start is visible in Telegram.
notifyAdminServiceStart({
  service: process.env.SERVICE_NAME ?? "kundaliapi",
  port,
  env: process.env.NODE_ENV ?? "production",
}).catch(() => {});
