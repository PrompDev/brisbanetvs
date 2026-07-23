import { hasOperationsDatabase, json, requireOperationsAccess } from "../_lib/auth.js";
import { inboxRouteId } from "./_drafts.js";
import { DEFAULT_TEAM_MAILBOX, mailboxForAddress } from "./_mailboxes.js";

const MAX_MESSAGE_BODY_LENGTH = 50_000;
const MAX_THREAD_MESSAGES = 50;

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
    messageId: safeText(row?.message_id, 4_096),
    inReplyTo: safeText(row?.in_reply_to, 4_096),
    readAt: safeText(row?.read_at, 64) || null,
    mailbox: mailboxForAddress(row?.mailbox_address || row?.to_address),
  };
}

function replySubject(subject) {
  const safeSubject = safeText(subject, 180, "(No subject)");
  return /^re:/i.test(safeSubject) ? safeSubject : `Re: ${safeSubject}`.slice(0, 180);
}

function sameOriginMutation(request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return false;
  if (!origin) return true;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function readUpdate(request) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > 1_024) return null;

  try {
    const raw = await request.text();
    if (raw.length > 1_024) return null;
    const payload = JSON.parse(raw);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
    const read = typeof payload.read === "boolean" ? payload.read : null;
    const archived = typeof payload.archived === "boolean" ? payload.archived : null;
    return read === null && archived === null ? null : { read, archived };
  } catch {
    return null;
  }
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
      "SELECT id, thread_id, lead_id, contact_id, direction, from_address, reply_to_address, to_address, mailbox_address, subject, plain_text, received_at, status, attachment_count, message_id, in_reply_to, read_at FROM mail_messages WHERE id = ? AND direction = 'inbound' LIMIT 1",
    ).bind(id).first();

    if (!message) return json({ ok: false, error: "message_not_found" }, 404);
    const threadRows = message.thread_id
      ? await env.OPERATIONS_DB.prepare(
        `SELECT id, thread_id, lead_id, contact_id, direction, from_address, to_address, mailbox_address, subject, plain_text, received_at, status, attachment_count, message_id, in_reply_to, read_at
          FROM mail_messages
          WHERE direction = 'inbound' AND thread_id = ? AND mailbox_address = ?
          ORDER BY received_at ASC, id ASC
          LIMIT ?`,
      ).bind(message.thread_id, message.mailbox_address, MAX_THREAD_MESSAGES).all()
      : { results: [message] };
    const safeMessage = toMessage(message);
    const replyMailbox = mailboxForAddress(message.to_address);

    return json({
      ok: true,
      message: safeMessage,
      thread: (threadRows.results || [message]).map(toMessage),
      replyDraft: {
        from: replyMailbox?.address || DEFAULT_TEAM_MAILBOX,
        to: safeText(message.reply_to_address || message.from_address, 320),
        subject: replySubject(safeMessage.subject),
        threadId: safeMessage.threadId,
        inReplyTo: safeMessage.messageId,
      },
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

export async function onRequestPatch({ request, env, params }) {
  const access = await requireOperationsAccess(request, env);
  if (access.response) return access.response;
  if (!sameOriginMutation(request)) return json({ ok: false, error: "invalid_origin" }, 403);
  if (!hasOperationsDatabase(env)) {
    console.error(JSON.stringify({ event: "operations_inbox_database_not_configured" }));
    return json({ ok: false, error: "mailbox_unavailable" }, 503);
  }

  const id = inboxRouteId(params?.id);
  if (!id) return json({ ok: false, error: "message_not_found" }, 404);
  const update = await readUpdate(request);
  if (!update) return json({ ok: false, error: "invalid_update" }, 400);

  try {
    const existing = await env.OPERATIONS_DB.prepare(
      "SELECT id, thread_id, mailbox_address, status, read_at FROM mail_messages WHERE id = ? AND direction = 'inbound' LIMIT 1",
    ).bind(id).first();
    if (!existing) return json({ ok: false, error: "message_not_found" }, 404);

    const now = new Date().toISOString();
    const readAt = update.read === null ? existing.read_at : update.read ? now : null;
    const status = update.archived === null
      ? existing.status
      : update.archived ? "archived" : "stored";

    const updateStatement = existing.thread_id
      ? env.OPERATIONS_DB.prepare(
        `UPDATE mail_messages
          SET read_at = ?, status = ?, updated_at = ?
          WHERE direction = 'inbound' AND thread_id = ? AND mailbox_address = ?`,
      ).bind(readAt, status, now, existing.thread_id, existing.mailbox_address)
      : env.OPERATIONS_DB.prepare(
        `UPDATE mail_messages
          SET read_at = ?, status = ?, updated_at = ?
          WHERE direction = 'inbound' AND id = ?`,
      ).bind(readAt, status, now, existing.id);
    await updateStatement.run();

    return json({
      ok: true,
      threadId: safeText(existing.thread_id, 200),
      readAt,
      status,
      updatedBy: access.identity?.email || "staff",
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: "operations_inbox_message_update_failed",
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    }));
    return json({ ok: false, error: "mailbox_unavailable" }, 503);
  }
}
