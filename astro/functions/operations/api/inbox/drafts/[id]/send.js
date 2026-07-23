import { hasOperationsDatabase, json, requireOperationsAccess } from "../../../_lib/auth.js";
import {
  inboxRouteId,
  normaliseDraft,
  sameOriginMutation,
} from "../../_drafts.js";
import {
  plainTextToHtml,
  safeProviderErrorCode,
  senderForIdentity,
  sendingReadiness,
  threadHeaders,
} from "../../_sending.js";

async function existingOutbox(env, draftId) {
  return env.OPERATIONS_DB.prepare(
    "SELECT id, status, provider_message_id, safe_error_code FROM mail_outbox WHERE draft_id = ? LIMIT 1",
  ).bind(draftId).first();
}

async function recordOutboxStatus(env, id, status, now, providerMessageId = "", safeErrorCode = "") {
  await env.OPERATIONS_DB.prepare(
    "UPDATE mail_outbox SET status = ?, updated_at = ?, provider_message_id = ?, safe_error_code = ? WHERE id = ?",
  ).bind(status, now, providerMessageId, safeErrorCode, id).run();
}

export async function onRequestPost({ request, env, params }) {
  const access = await requireOperationsAccess(request, env);
  if (access.response) return access.response;
  if (!sameOriginMutation(request)) return json({ ok: false, error: "invalid_origin" }, 403);
  if (!hasOperationsDatabase(env)) {
    console.error(JSON.stringify({ event: "operations_send_database_not_configured" }));
    return json({ ok: false, error: "mailbox_unavailable" }, 503);
  }

  const readiness = sendingReadiness(env);
  if (!readiness.enabled) {
    return json({
      ok: false,
      error: "email_sending_unavailable",
      sendStatus: readiness.status,
    }, 503);
  }

  const sender = senderForIdentity(access.identity?.email);
  if (!sender) return json({ ok: false, error: "sender_not_authorized" }, 403);

  const draftId = inboxRouteId(params?.id);
  if (!draftId) return json({ ok: false, error: "draft_not_found" }, 404);

  let draftRow;
  try {
    draftRow = await env.OPERATIONS_DB.prepare(
      `SELECT id, from_address, to_address, subject, plain_text, status, thread_id,
        reply_to_message_id, created_at, updated_at, created_by, updated_by
      FROM mail_drafts WHERE id = ? LIMIT 1`,
    ).bind(draftId).first();
  } catch (error) {
    console.error(JSON.stringify({
      event: "operations_send_draft_query_failed",
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    }));
    return json({ ok: false, error: "mailbox_unavailable" }, 503);
  }

  if (!draftRow) return json({ ok: false, error: "draft_not_found" }, 404);
  if (draftRow.status !== "draft") return json({ ok: false, error: "draft_not_sendable" }, 409);

  const draft = normaliseDraft({}, draftRow);
  if (!draft) return json({ ok: false, error: "invalid_draft" }, 400);
  if (draft.fromAddress !== sender.address) {
    return json({ ok: false, error: "sender_not_authorized" }, 403);
  }

  const outboxId = crypto.randomUUID();
  const now = new Date().toISOString();
  let claim;
  try {
    claim = await env.OPERATIONS_DB.prepare(
      `INSERT INTO mail_outbox (
        id, draft_id, from_address, to_address, subject, plain_text, thread_id,
        in_reply_to, references_header, status, requested_by, requested_at,
        updated_at, attempt_count, provider_message_id, safe_error_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'sending', ?, ?, ?, 1, '', '')
      ON CONFLICT(draft_id) DO NOTHING
      RETURNING id`,
    ).bind(
      outboxId,
      draftId,
      draft.fromAddress,
      draft.toAddress,
      draft.subject,
      draft.plainText,
      draft.threadId,
      draft.inReplyTo,
      draft.inReplyTo,
      access.identity?.email || "staff",
      now,
      now,
    ).first();
  } catch (error) {
    console.error(JSON.stringify({
      event: "operations_send_claim_failed",
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    }));
    return json({ ok: false, error: "mailbox_unavailable" }, 503);
  }

  if (!claim?.id) {
    let existing;
    try {
      existing = await existingOutbox(env, draftId);
    } catch (error) {
      console.error(JSON.stringify({
        event: "operations_send_existing_claim_query_failed",
        message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
      }));
      return json({ ok: false, error: "mailbox_unavailable" }, 503);
    }
    if (existing?.status === "sent") {
      return json({
        ok: true,
        sent: true,
        idempotent: true,
        providerMessageId: existing.provider_message_id || "",
      });
    }
    return json({
      ok: false,
      error: "send_already_attempted",
      sendStatus: existing?.status || "unknown",
      safeErrorCode: existing?.safe_error_code || "",
    }, 409);
  }

  let result;
  try {
    result = await env.OPERATIONS_EMAIL.send({
      to: draft.toAddress,
      from: {
        email: draft.fromAddress,
        name: `${sender.name} at Brisbane TVs`,
      },
      replyTo: draft.fromAddress,
      subject: draft.subject,
      text: draft.plainText,
      html: plainTextToHtml(draft.plainText),
      headers: threadHeaders(draft.inReplyTo),
    });
  } catch (error) {
    const safeErrorCode = safeProviderErrorCode(error);
    try {
      await recordOutboxStatus(
        env,
        outboxId,
        "failed",
        new Date().toISOString(),
        "",
        safeErrorCode,
      );
    } catch (auditError) {
      console.error(JSON.stringify({
        event: "operations_send_failure_audit_failed",
        message: auditError instanceof Error ? auditError.message.slice(0, 160) : "unknown",
      }));
    }
    console.error(JSON.stringify({
      event: "operations_email_send_failed",
      code: safeErrorCode,
      outboxId,
    }));
    return json({ ok: false, error: "email_delivery_failed", safeErrorCode }, 502);
  }

  const providerMessageId = typeof result?.messageId === "string"
    ? result.messageId.slice(0, 512)
    : "";
  try {
    await recordOutboxStatus(
      env,
      outboxId,
      "sent",
      new Date().toISOString(),
      providerMessageId,
    );
  } catch (error) {
    console.error(JSON.stringify({
      event: "operations_send_success_audit_failed",
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
      outboxId,
    }));
    return json({
      ok: true,
      sent: true,
      auditPending: true,
      providerMessageId,
    }, 202);
  }

  return json({
    ok: true,
    sent: true,
    auditPending: false,
    providerMessageId,
  });
}
