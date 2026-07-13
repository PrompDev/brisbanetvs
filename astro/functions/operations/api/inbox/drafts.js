import { hasOperationsDatabase, json, requireOperationsAccess } from "../_lib/auth.js";

const MAX_DRAFT_BYTES = 16_000;
const MAX_SUBJECT_LENGTH = 180;
const MAX_BODY_LENGTH = 10_000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanText(value, maximum) {
  return typeof value === "string"
    ? value.replace(/\r\n/g, "\n").trim().slice(0, maximum)
    : "";
}

export async function onRequestPost({ request, env }) {
  const access = await requireOperationsAccess(request, env);
  if (access.response) return access.response;
  if (!hasOperationsDatabase(env)) {
    console.error(JSON.stringify({ event: "operations_draft_database_not_configured" }));
    return json({ ok: false, error: "mailbox_unavailable" }, 503);
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_DRAFT_BYTES) {
    return json({ ok: false, error: "draft_too_large" }, 413);
  }

  let payload;
  try {
    const raw = await request.text();
    if (raw.length > MAX_DRAFT_BYTES) return json({ ok: false, error: "draft_too_large" }, 413);
    payload = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const toAddress = cleanText(payload?.to, 320).toLowerCase();
  const subject = cleanText(payload?.subject, MAX_SUBJECT_LENGTH);
  const plainText = cleanText(payload?.plainText, MAX_BODY_LENGTH);
  if (!EMAIL_PATTERN.test(toAddress) || !subject || !plainText) {
    return json({ ok: false, error: "invalid_draft" }, 400);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await env.OPERATIONS_DB.prepare(
      "INSERT INTO mail_drafts (id, to_address, subject, plain_text, status, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, 'draft', ?, ?, ?)",
    )
      .bind(id, toAddress, subject, plainText, now, now, access.identity?.email || "staff")
      .run();

    // No email is sent here. Drafts are retained only for a future approval
    // workflow and must never be treated as permission to deliver marketing.
    return json({ ok: true, draft: { id, status: "draft" } }, 201);
  } catch (error) {
    console.error(JSON.stringify({
      event: "operations_draft_write_failed",
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    }));
    return json({ ok: false, error: "mailbox_unavailable" }, 503);
  }
}
