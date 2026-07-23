import { hasOperationsDatabase, json, requireOperationsAccess } from "../_lib/auth.js";
import {
  boundedInteger,
  normaliseDraft,
  readDraftJson,
  requestedListStatus,
  sameOriginMutation,
  toDraftSummary,
} from "./_drafts.js";

const MAX_LIMIT = 100;
const MAX_OFFSET = 1_000;
const DRAFT_STATUSES = new Set(["all", "draft", "archived"]);

function safeCount(value) {
  const count = Number(value);
  return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}

async function requireMailbox(request, env, eventName) {
  const access = await requireOperationsAccess(request, env);
  if (access.response) return { response: access.response };
  if (!hasOperationsDatabase(env)) {
    console.error(JSON.stringify({ event: eventName }));
    return { response: json({ ok: false, error: "mailbox_unavailable" }, 503) };
  }
  return { access };
}

export async function onRequestGet({ request, env }) {
  const mailbox = await requireMailbox(request, env, "operations_draft_database_not_configured");
  if (mailbox.response) return mailbox.response;

  const url = new URL(request.url);
  const status = requestedListStatus(url.searchParams.get("status"), DRAFT_STATUSES, "draft");
  const limit = Math.max(1, boundedInteger(url.searchParams.get("limit"), 50, MAX_LIMIT));
  const offset = boundedInteger(url.searchParams.get("offset"), 0, MAX_OFFSET);
  const where = status === "all" ? "" : " WHERE status = ?";
  const values = status === "all" ? [] : [status];
  const listSql = `SELECT id, from_address, to_address, subject, plain_text, status, thread_id, reply_to_message_id, created_at, updated_at
    FROM mail_drafts${where} ORDER BY updated_at DESC, id DESC LIMIT ? OFFSET ?`;
  const countSql = `SELECT COUNT(*) AS count FROM mail_drafts${where}`;

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
      drafts: (listResult.results || []).map(toDraftSummary),
      sendEnabled: false,
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: "operations_drafts_query_failed",
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    }));
    return json({ ok: false, error: "mailbox_unavailable" }, 503);
  }
}

export async function onRequestPost({ request, env }) {
  const mailbox = await requireMailbox(request, env, "operations_draft_database_not_configured");
  if (mailbox.response) return mailbox.response;
  if (!sameOriginMutation(request)) return json({ ok: false, error: "invalid_origin" }, 403);

  const parsed = await readDraftJson(request);
  if (parsed.error) return json({ ok: false, error: parsed.error }, parsed.status);
  const draft = normaliseDraft(parsed.payload);
  if (!draft) {
    return json({ ok: false, error: "invalid_draft" }, 400);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await env.OPERATIONS_DB.prepare(
      "INSERT INTO mail_drafts (id, from_address, to_address, subject, plain_text, status, thread_id, reply_to_message_id, created_at, updated_at, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        id,
        draft.fromAddress,
        draft.toAddress,
        draft.subject,
        draft.plainText,
        draft.status,
        draft.threadId,
        draft.inReplyTo,
        now,
        now,
        mailbox.access.identity?.email || "staff",
        mailbox.access.identity?.email || "staff",
      )
      .run();

    // No email is sent here. Drafts are retained only for a future approval
    // workflow and must never be treated as permission to deliver marketing.
    return json({
      ok: true,
      draft: {
        id,
        to: draft.toAddress,
        from: draft.fromAddress,
        subject: draft.subject,
        status: draft.status,
        threadId: draft.threadId,
        inReplyTo: draft.inReplyTo,
        createdAt: now,
        updatedAt: now,
      },
      sendEnabled: false,
    }, 201);
  } catch (error) {
    console.error(JSON.stringify({
      event: "operations_draft_write_failed",
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    }));
    return json({ ok: false, error: "mailbox_unavailable" }, 503);
  }
}
