import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { logger } from "hono/logger";
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

const app = new Hono();

app.use("*", logger());
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
