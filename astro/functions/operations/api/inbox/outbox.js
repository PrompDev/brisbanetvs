import { hasOperationsDatabase, json, requireOperationsAccess } from "../_lib/auth.js";
import { boundedInteger, requestedListStatus } from "./_drafts.js";
import { requestedMailbox } from "./_mailboxes.js";
import { toOutboxSummary } from "./_sending.js";

const MAX_LIMIT = 100;
const MAX_OFFSET = 1_000;
const OUTBOX_STATUSES = new Set(["all", "sending", "sent", "failed"]);

function safeCount(value) {
  const count = Number(value);
  return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}

export async function onRequestGet({ request, env }) {
  const access = await requireOperationsAccess(request, env);
  if (access.response) return access.response;
  if (!hasOperationsDatabase(env)) {
    console.error(JSON.stringify({ event: "operations_outbox_database_not_configured" }));
    return json({ ok: false, error: "mailbox_unavailable" }, 503);
  }

  const url = new URL(request.url);
  const status = requestedListStatus(url.searchParams.get("status"), OUTBOX_STATUSES);
  const limit = Math.max(1, boundedInteger(url.searchParams.get("limit"), 50, MAX_LIMIT));
  const offset = boundedInteger(url.searchParams.get("offset"), 0, MAX_OFFSET);
  const mailbox = requestedMailbox(url.searchParams.get("mailbox"));
  const conditions = [];
  const values = [];

  if (status !== "all") {
    conditions.push("status = ?");
    values.push(status);
  }
  if (mailbox) {
    conditions.push("lower(from_address) = ?");
    values.push(mailbox.address);
  }

  const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
  const listSql = `SELECT id, draft_id, from_address, to_address, subject, plain_text, status,
      requested_by, requested_at, updated_at, provider_message_id, safe_error_code
    FROM mail_outbox${where} ORDER BY updated_at DESC, id DESC LIMIT ? OFFSET ?`;
  const countSql = `SELECT COUNT(*) AS count FROM mail_outbox${where}`;

  try {
    const [listResult, countRow] = await Promise.all([
      env.OPERATIONS_DB.prepare(listSql).bind(...values, limit, offset).all(),
      env.OPERATIONS_DB.prepare(countSql).bind(...values).first(),
    ]);
    return json({
      ok: true,
      status,
      total: safeCount(countRow?.count),
      offset,
      limit,
      messages: (listResult.results || []).map(toOutboxSummary),
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: "operations_outbox_query_failed",
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    }));
    return json({ ok: false, error: "mailbox_unavailable" }, 503);
  }
}
