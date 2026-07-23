import {
  DEFAULT_TEAM_MAILBOX,
  isTeamMailboxAddress,
} from "./_mailboxes.js";

const MAX_DRAFT_BYTES = 16_000;
const MAX_EMAIL_LENGTH = 320;
const MAX_SUBJECT_LENGTH = 180;
const MAX_BODY_LENGTH = 10_000;
const MAX_THREAD_ID_LENGTH = 200;
const MAX_MESSAGE_ID_LENGTH = 4_096;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DRAFT_STATUSES = new Set(["draft", "archived"]);

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

export function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function sameOriginMutation(request) {
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

function cleanSingleLine(value, maximum) {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function cleanBody(value) {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, MAX_BODY_LENGTH);
}

function existingText(row, field) {
  return typeof row?.[field] === "string" ? row[field] : "";
}

function requestedDraftStatus(value) {
  return typeof value === "string" && DRAFT_STATUSES.has(value) ? value : null;
}

/**
 * Parse a complete draft on create or a partial draft on save. The returned
 * object is always a complete, send-safe record. This project has no send
 * endpoint; validation still removes header-control characters so a future
 * approved delivery workflow cannot inherit an unsafe draft.
 */
export function normaliseDraft(payload, existing = null) {
  if (!isRecord(payload)) return null;

  const hasTo = hasOwn(payload, "to");
  const hasFrom = hasOwn(payload, "from");
  const hasSubject = hasOwn(payload, "subject");
  const hasPlainText = hasOwn(payload, "plainText");
  const hasStatus = hasOwn(payload, "status");
  const hasThreadId = hasOwn(payload, "threadId");
  const hasInReplyTo = hasOwn(payload, "inReplyTo");

  if (
    (hasTo && typeof payload.to !== "string")
    || (hasFrom && typeof payload.from !== "string")
    || (hasSubject && typeof payload.subject !== "string")
    || (hasPlainText && typeof payload.plainText !== "string")
    || (hasStatus && typeof payload.status !== "string")
    || (hasThreadId && typeof payload.threadId !== "string")
    || (hasInReplyTo && typeof payload.inReplyTo !== "string")
  ) {
    return null;
  }

  const toAddress = (hasTo
    ? cleanSingleLine(payload.to, MAX_EMAIL_LENGTH)
    : existingText(existing, "to_address")
  ).toLowerCase();
  const fromAddress = (hasFrom
    ? cleanSingleLine(payload.from, MAX_EMAIL_LENGTH)
    : cleanSingleLine(existingText(existing, "from_address"), MAX_EMAIL_LENGTH) || DEFAULT_TEAM_MAILBOX
  ).toLowerCase();
  const subject = hasSubject
    ? cleanSingleLine(payload.subject, MAX_SUBJECT_LENGTH)
    : cleanSingleLine(existingText(existing, "subject"), MAX_SUBJECT_LENGTH);
  const plainText = hasPlainText
    ? cleanBody(payload.plainText)
    : cleanBody(existingText(existing, "plain_text"));
  const status = hasStatus
    ? requestedDraftStatus(payload.status)
    : requestedDraftStatus(existingText(existing, "status")) || "draft";
  const threadId = hasThreadId
    ? cleanSingleLine(payload.threadId, MAX_THREAD_ID_LENGTH)
    : cleanSingleLine(existingText(existing, "thread_id"), MAX_THREAD_ID_LENGTH);
  const inReplyTo = hasInReplyTo
    ? cleanSingleLine(payload.inReplyTo, MAX_MESSAGE_ID_LENGTH)
    : cleanSingleLine(existingText(existing, "reply_to_message_id"), MAX_MESSAGE_ID_LENGTH);

  if (
    !EMAIL_PATTERN.test(toAddress)
    || !isTeamMailboxAddress(fromAddress)
    || !subject
    || !plainText
    || !status
  ) {
    return null;
  }

  return {
    toAddress,
    fromAddress,
    subject,
    plainText,
    status,
    threadId,
    inReplyTo,
  };
}

export async function readDraftJson(request) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_DRAFT_BYTES) {
    return { error: "draft_too_large", status: 413 };
  }

  let raw;
  try {
    raw = await request.text();
  } catch {
    return { error: "invalid_json", status: 400 };
  }

  if (raw.length > MAX_DRAFT_BYTES || new TextEncoder().encode(raw).byteLength > MAX_DRAFT_BYTES) {
    return { error: "draft_too_large", status: 413 };
  }

  try {
    const payload = JSON.parse(raw);
    return isRecord(payload)
      ? { payload }
      : { error: "invalid_json", status: 400 };
  } catch {
    return { error: "invalid_json", status: 400 };
  }
}

function cleanDatabaseText(value, maximum, fallback = "") {
  return typeof value === "string"
    ? value.replace(/\u0000/g, "").slice(0, maximum)
    : fallback;
}

function preview(value) {
  const compact = cleanDatabaseText(value, 280).replace(/\s+/g, " ").trim();
  return compact.length > 220 ? `${compact.slice(0, 219)}…` : compact;
}

export function toDraftSummary(row) {
  return {
    id: cleanDatabaseText(row?.id, 200),
    to: cleanDatabaseText(row?.to_address, MAX_EMAIL_LENGTH),
    from: cleanDatabaseText(row?.from_address, MAX_EMAIL_LENGTH, DEFAULT_TEAM_MAILBOX),
    subject: cleanDatabaseText(row?.subject, MAX_SUBJECT_LENGTH, "(No subject)"),
    preview: preview(row?.plain_text),
    status: requestedDraftStatus(row?.status) || "draft",
    threadId: cleanDatabaseText(row?.thread_id, MAX_THREAD_ID_LENGTH),
    inReplyTo: cleanDatabaseText(row?.reply_to_message_id, MAX_MESSAGE_ID_LENGTH),
    createdAt: cleanDatabaseText(row?.created_at, 64),
    updatedAt: cleanDatabaseText(row?.updated_at, 64),
  };
}

export function toDraftDetail(row) {
  return {
    ...toDraftSummary(row),
    plainText: cleanDatabaseText(row?.plain_text, MAX_BODY_LENGTH),
  };
}

export function inboxRouteId(value) {
  if (typeof value !== "string") return null;
  const id = value.trim();
  return id && id.length <= 200 ? id : null;
}

export function boundedInteger(value, fallback, maximum) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? Math.min(parsed, maximum) : fallback;
}

export function requestedListStatus(value, allowed, fallback = "all") {
  return typeof value === "string" && allowed.has(value) ? value : fallback;
}
