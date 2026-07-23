import { hasOperationsDatabase, json, requireOperationsAccess } from "../../_lib/auth.js";
import {
  inboxRouteId,
  normaliseDraft,
  readDraftJson,
  sameOriginMutation,
  toDraftDetail,
} from "../_drafts.js";
import { sendingCapability } from "../_sending.js";

async function requireMailbox(request, env, eventName) {
  const access = await requireOperationsAccess(request, env);
  if (access.response) return { response: access.response };
  if (!hasOperationsDatabase(env)) {
    console.error(JSON.stringify({ event: eventName }));
    return { response: json({ ok: false, error: "mailbox_unavailable" }, 503) };
  }
  return { access };
}

async function findDraft(env, id) {
  return env.OPERATIONS_DB.prepare(
    `SELECT d.id, d.from_address, d.to_address, d.subject, d.plain_text, d.status,
      d.thread_id, d.reply_to_message_id, d.created_at, d.updated_at,
      d.created_by, d.updated_by, o.status AS send_status,
      o.updated_at AS send_updated_at, o.safe_error_code
    FROM mail_drafts d
    LEFT JOIN mail_outbox o ON o.draft_id = d.id
    WHERE d.id = ? LIMIT 1`,
  ).bind(id).first();
}

export async function onRequestGet({ request, env, params }) {
  const mailbox = await requireMailbox(request, env, "operations_draft_database_not_configured");
  if (mailbox.response) return mailbox.response;

  const id = inboxRouteId(params?.id);
  if (!id) return json({ ok: false, error: "draft_not_found" }, 404);

  try {
    const draft = await findDraft(env, id);
    const capability = sendingCapability(env, mailbox.access.identity?.email);
    return draft
      ? json({
        ok: true,
        draft: toDraftDetail(draft),
        sendEnabled: capability.send,
        capabilities: capability,
      })
      : json({ ok: false, error: "draft_not_found" }, 404);
  } catch (error) {
    console.error(JSON.stringify({
      event: "operations_draft_query_failed",
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    }));
    return json({ ok: false, error: "mailbox_unavailable" }, 503);
  }
}

async function saveDraft({ request, env, params }) {
  const mailbox = await requireMailbox(request, env, "operations_draft_database_not_configured");
  if (mailbox.response) return mailbox.response;
  if (!sameOriginMutation(request)) return json({ ok: false, error: "invalid_origin" }, 403);

  const id = inboxRouteId(params?.id);
  if (!id) return json({ ok: false, error: "draft_not_found" }, 404);

  const parsed = await readDraftJson(request);
  if (parsed.error) return json({ ok: false, error: parsed.error }, parsed.status);

  try {
    const existing = await findDraft(env, id);
    if (!existing) return json({ ok: false, error: "draft_not_found" }, 404);
    if (existing.send_status) {
      return json({ ok: false, error: "draft_send_attempted" }, 409);
    }

    const draft = normaliseDraft(parsed.payload, existing);
    if (!draft) return json({ ok: false, error: "invalid_draft" }, 400);

    const now = new Date().toISOString();
    await env.OPERATIONS_DB.prepare(
      "UPDATE mail_drafts SET from_address = ?, to_address = ?, subject = ?, plain_text = ?, status = ?, thread_id = ?, reply_to_message_id = ?, updated_at = ?, updated_by = ? WHERE id = ?",
    ).bind(
      draft.fromAddress,
      draft.toAddress,
      draft.subject,
      draft.plainText,
      draft.status,
      draft.threadId,
      draft.inReplyTo,
      now,
      mailbox.access.identity?.email || "staff",
      id,
    ).run();

    const capability = sendingCapability(env, mailbox.access.identity?.email);
    return json({
      ok: true,
      draft: toDraftDetail({
        ...existing,
        from_address: draft.fromAddress,
        to_address: draft.toAddress,
        subject: draft.subject,
        plain_text: draft.plainText,
        status: draft.status,
        thread_id: draft.threadId,
        reply_to_message_id: draft.inReplyTo,
        updated_at: now,
      }),
      sendEnabled: capability.send,
      capabilities: capability,
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: "operations_draft_save_failed",
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    }));
    return json({ ok: false, error: "mailbox_unavailable" }, 503);
  }
}

// Both complete PUT saves and partial PATCH autosaves remain draft-only.
// Delivery is a separate, authenticated POST with its own confirmation,
// identity, binding, feature-flag and idempotency checks.
export const onRequestPut = saveDraft;
export const onRequestPatch = saveDraft;
