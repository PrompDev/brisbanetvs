import { hasOperationsDatabase, json, requireOperationsAccess } from "../_lib/auth.js";
import { boundedInteger, requestedListStatus } from "./_drafts.js";

const MAX_LIMIT = 100;
const MAX_OFFSET = 1_000;
const MESSAGE_STATUSES = new Set(["all", "stored", "archived", "blocked"]);

function safeText(value, maximum, fallback = "") {
  return typeof value === "string"
    ? value.replace(/\u0000/g, "").slice(0, maximum)
    : fallback;
}

function safeCount(value) {
  const count = Number(value);
  return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}

function preview(value) {
  const compact = safeText(value, 280).replace(/\s+/g, " ").trim();
  return compact.length > 220 ? `${compact.slice(0, 219)}…` : compact;
}

function toMessage(row) {
  return {
    id: safeText(row?.id, 200),
    threadId: safeText(row?.thread_id, 200),
    from: safeText(row?.from_address, 320),
    subject: safeText(row?.subject, 180, "(No subject)"),
    preview: preview(row?.plain_text),
    receivedAt: safeText(row?.received_at, 64),
    status: safeText(row?.status, 32, "stored"),
    attachmentCount: safeCount(row?.attachment_count),
  };
}

/**
 * This is intentionally read-only. Incoming delivery is not enabled until the
 * existing domain mail service has a reviewed migration plan, and there is no
 * outbound binding or send endpoint in this application.
 */
export async function onRequestGet({ request, env }) {
  const access = await requireOperationsAccess(request, env);
  if (access.response) return access.response;
  if (!hasOperationsDatabase(env)) {
    console.error(JSON.stringify({ event: "operations_inbox_database_not_configured" }));
    return json({ ok: false, error: "mailbox_unavailable" }, 503);
  }

  const url = new URL(request.url);
  const status = requestedListStatus(url.searchParams.get("status"), MESSAGE_STATUSES);
  const limit = Math.max(1, boundedInteger(url.searchParams.get("limit"), 50, MAX_LIMIT));
  const offset = boundedInteger(url.searchParams.get("offset"), 0, MAX_OFFSET);
  const where = status === "all"
    ? "WHERE direction = 'inbound'"
    : "WHERE direction = 'inbound' AND status = ?";
  const values = status === "all" ? [] : [status];
  const listSql = `SELECT id, thread_id, from_address, subject, plain_text, received_at, status, attachment_count
    FROM mail_messages ${where} ORDER BY received_at DESC, id DESC LIMIT ? OFFSET ?`;
  const countSql = `SELECT COUNT(*) AS count FROM mail_messages ${where}`;

  try {
    const [listResult, countRow] = await Promise.all([
      env.OPERATIONS_DB.prepare(listSql).bind(...values, limit, offset).all(),
      env.OPERATIONS_DB.prepare(countSql).bind(...values).first(),
    ]);

    const inboundEnabled = env.TEAM_INBOX_ENABLED === "true";
    return json({
      ok: true,
      mailboxAddress: "team@brisbanetvs.com",
      inboundEnabled,
      delivery: inboundEnabled ? "active" : "staged",
      outboundEnabled: false,
      capabilities: {
        receive: inboundEnabled,
        createDrafts: true,
        send: false,
      },
      status,
      total: safeCount(countRow?.count),
      offset,
      limit,
      messages: (listResult.results || []).map(toMessage),
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: "operations_inbox_query_failed",
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    }));
    return json({ ok: false, error: "mailbox_unavailable" }, 503);
  }
}
