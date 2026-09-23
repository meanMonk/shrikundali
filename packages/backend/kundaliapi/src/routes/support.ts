import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { getKundali, getKundaliByOrderId } from "../lib/store.js";
import { createSupportTicket, SUPPORT_REASONS } from "../lib/support.js";
import { sendSupportTicketEmail, sendSupportAckEmail } from "../lib/email.js";
import { notifyAdminSupportTicket } from "../lib/telegram.js";
import { logInfo, logError } from "../lib/logger.js";

const supportApp = new OpenAPIHono();

const SupportInput = z.object({
  reason: z.enum(SUPPORT_REASONS).default("download_failed"),
  orderId: z.string().optional().describe("Razorpay/Cashfree order id from the success modal"),
  cacheId: z.string().optional().describe("Kundali id (cacheId) from the teaser"),
  email: z.string().email().optional().describe("Customer email (fallback if no order found)"),
  message: z.string().max(2000).optional(),
});

const createTicketRoute = createRoute({
  method: "post",
  path: "/ticket",
  tags: ["Support"],
  summary: "Raise a post-payment support ticket (report failed / download broken / double payment)",
  request: { body: { content: { "application/json": { schema: SupportInput } } } },
  responses: {
    200: { description: "Ticket created", content: { "application/json": { schema: z.object({ ok: z.boolean(), id: z.string() }) } } },
    400: { description: "Bad request" },
  },
});

supportApp.openapi(createTicketRoute, async (c) => {
  const endpoint = "/support/ticket";
  try {
    const body = c.req.valid("json");

    // Enrich from the original kundali so ops has full context even if the
    // customer just tapped a button without typing anything.
    let doc = body.orderId ? await getKundaliByOrderId(body.orderId) : null;
    if (!doc && body.cacheId) doc = await getKundali(body.cacheId);

    const email = body.email ?? doc?.email;
    if (!doc && !email && !body.orderId) {
      return c.json({ error: "Missing orderId/cacheId/email — nothing to reference." }, 400);
    }

    const clientIp =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
      c.req.header("x-real-ip") ||
      "";
    const userAgent = c.req.header("user-agent") || "";

    const ticket = await createSupportTicket({
      reason: body.reason,
      orderId: body.orderId ?? doc?.orderId,
      cacheId: body.cacheId ?? doc?.id,
      email,
      name: doc?.name,
      reportType: doc?.reportLabel ?? doc?.reportType,
      amount: doc?.amount,
      paymentId: doc?.paymentId,
      orderStatus: doc?.status,
      archiveId: doc?.archiveId,
      message: body.message,
      clientIp,
      userAgent,
    });

    // Notifications are best-effort — never fail the request on email/Telegram.
    await Promise.allSettled([
      sendSupportTicketEmail(ticket),
      sendSupportAckEmail(ticket),
      notifyAdminSupportTicket({
        id: ticket.id,
        reason: ticket.reason,
        orderId: ticket.orderId,
        cacheId: ticket.cacheId,
        email: ticket.email,
        name: ticket.name,
        reportType: ticket.reportType,
        amount: ticket.amount,
        orderStatus: ticket.orderStatus,
        message: ticket.message,
      }),
    ]);

    logInfo(`${endpoint} ${ticket.id} (${ticket.reason}) order=${ticket.orderId ?? "-"}`);
    return c.json({ ok: true, id: ticket.id }, 200);
  } catch (e) {
    logError(endpoint, e);
    return c.json({ error: String(e) }, 400);
  }
});

export { supportApp };
