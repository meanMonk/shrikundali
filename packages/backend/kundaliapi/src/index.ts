import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { healthRoutes } from "./routes/health.js";
import { setupDocs } from "./docs.js";
import { dbRoutes } from "./routes/db.js";
import { kundaliApp } from "./routes/kundali.js";
import { teaserApp } from "./routes/teaser.js";
import { checkoutApp } from "./routes/checkout.js";
import { webhookApp } from "./routes/webhook.js";
import { downloadApp } from "./routes/download.js";
import { configApp } from "./routes/config.js";
import { telegramBotApp } from "./routes/telegram-bot.js";
import { notifyAdminServiceStart } from "./lib/telegram.js";

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
    allowHeaders: ["Content-Type", "Authorization"],
  })
);
app.route("/health", healthRoutes);
app.route("/db", dbRoutes);
app.route("/kundali", kundaliApp);
app.route("/teaser", teaserApp);
app.route("/payment", checkoutApp);
app.route("/webhook", webhookApp);
app.route("/download", downloadApp);
app.route("/api/config", configApp);
app.route("/telegram/bot", telegramBotApp);
setupDocs(app);

const port = Number(process.env.PORT ?? 3000);
console.log(`kundaliapi listening on :${port}  (docs: http://localhost:${port}/docs)`);

serve({ fetch: app.fetch, port });

// Fire-and-forget admin alert so a (re)start is visible in Telegram.
notifyAdminServiceStart({
  service: process.env.SERVICE_NAME ?? "kundaliapi",
  port,
  env: process.env.NODE_ENV ?? "production",
}).catch(() => {});
