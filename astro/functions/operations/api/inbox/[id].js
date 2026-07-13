import { hasOperationsDatabase, json, requireOperationsAccess } from "../_lib/auth.js";
import { inboxRouteId } from "./_drafts.js";

const MAX_MESSAGE_BODY_LENGTH = 50_000;

function safeText(value, maximum, fallback = "") {
  return typeof value === "string"
    ? value.replace(/\u0000/g, "").slice(0, maximum)
    : fallback;
}

function safeNumber(value) {
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric >= 0 ? numeric : 0;
}

function toMessage(row) {
  return {
    id: safeText(row?.id, 200),
    threadId: safeText(row?.thread_id, 200),
    leadId: safeText(row?.lead_id, 200),
    contactId: safeText(row?.contact_id, 200),
    direction: "inbound",
    from: safeText(row?.from_address, 320),
    to: safeText(row?.to_address, 320),
    subject: safeText(row?.subject, 180, "(No subject)"),
    plainText: safeText(row?.plain_text, MAX_MESSAGE_BODY_LENGTH),
    receivedAt: safeText(row?.received_at, 64),
    status: safeText(row?.status, 32, "stored"),
    attachmentCount: safeNumber(row?.attachment_count),
  };
}

/**
 * Reads an individual stored inbound message. Raw MIME and attachment object
 * keys remain private in R2. This route deliberately exposes only the count,
 * never metadata or a download URL, until a reviewed attachment policy exists.
 */
export async function onRequestGet({ request, env, params }) {
  const access = await requireOperationsAccess(request, env);
  if (access.response) return access.response;
  if (!hasOperationsDatabase(env)) {
    console.error(JSON.stringify({ event: "operations_inbox_database_not_configured" }));
    return json({ ok: false, error: "mailbox_unavailable" }, 503);
  }

  const id = inboxRouteId(params?.id);
  if (!id) return json({ ok: false, error: "message_not_found" }, 404);

  try {
    const message = await env.OPERATIONS_DB.prepare(
      "SELECT id, thread_id, lead_id, contact_id, direction, from_address, to_address, subject, plain_text, received_at, status, attachment_count FROM mail_messages WHERE id = ? AND direction = 'inbound' LIMIT 1",
    ).bind(id).first();

    if (!message) return json({ ok: false, error: "message_not_found" }, 404);
    return json({
      ok: true,
      message: toMessage(message),
      attachmentDownloadsEnabled: false,
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: "operations_inbox_message_query_failed",
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    }));
    return json({ ok: false, error: "mailbox_unavailable" }, 503);
  }
}
