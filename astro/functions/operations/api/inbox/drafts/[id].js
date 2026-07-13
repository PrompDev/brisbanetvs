import { hasOperationsDatabase, json, requireOperationsAccess } from "../../_lib/auth.js";
import { inboxRouteId, normaliseDraft, readDraftJson, toDraftDetail } from "../_drafts.js";

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
    "SELECT id, to_address, subject, plain_text, status, created_at, updated_at, created_by FROM mail_drafts WHERE id = ? LIMIT 1",
  ).bind(id).first();
}

export async function onRequestGet({ request, env, params }) {
  const mailbox = await requireMailbox(request, env, "operations_draft_database_not_configured");
  if (mailbox.response) return mailbox.response;

  const id = inboxRouteId(params?.id);
  if (!id) return json({ ok: false, error: "draft_not_found" }, 404);

  try {
    const draft = await findDraft(env, id);
    return draft
      ? json({ ok: true, draft: toDraftDetail(draft), sendEnabled: false })
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

  const id = inboxRouteId(params?.id);
  if (!id) return json({ ok: false, error: "draft_not_found" }, 404);

  const parsed = await readDraftJson(request);
  if (parsed.error) return json({ ok: false, error: parsed.error }, parsed.status);

  try {
    const existing = await findDraft(env, id);
    if (!existing) return json({ ok: false, error: "draft_not_found" }, 404);

    const draft = normaliseDraft(parsed.payload, existing);
    if (!draft) return json({ ok: false, error: "invalid_draft" }, 400);

    const now = new Date().toISOString();
    await env.OPERATIONS_DB.prepare(
      "UPDATE mail_drafts SET to_address = ?, subject = ?, plain_text = ?, status = ?, updated_at = ? WHERE id = ?",
    ).bind(draft.toAddress, draft.subject, draft.plainText, draft.status, now, id).run();

    return json({
      ok: true,
      draft: toDraftDetail({
        ...existing,
        to_address: draft.toAddress,
        subject: draft.subject,
        plain_text: draft.plainText,
        status: draft.status,
        updated_at: now,
      }),
      sendEnabled: false,
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: "operations_draft_save_failed",
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    }));
    return json({ ok: false, error: "mailbox_unavailable" }, 503);
  }
}

// Both complete PUT saves and partial PATCH autosaves remain draft-only. No
// route in this application can turn a saved draft into outbound email.
export const onRequestPut = saveDraft;
export const onRequestPatch = saveDraft;
