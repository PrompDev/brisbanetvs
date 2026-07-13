const MAX_DRAFT_BYTES = 16_000;
const MAX_EMAIL_LENGTH = 320;
const MAX_SUBJECT_LENGTH = 180;
const MAX_BODY_LENGTH = 10_000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DRAFT_STATUSES = new Set(["draft", "archived"]);

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

export function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
  const hasSubject = hasOwn(payload, "subject");
  const hasPlainText = hasOwn(payload, "plainText");
  const hasStatus = hasOwn(payload, "status");

  if (
    (hasTo && typeof payload.to !== "string")
    || (hasSubject && typeof payload.subject !== "string")
    || (hasPlainText && typeof payload.plainText !== "string")
    || (hasStatus && typeof payload.status !== "string")
  ) {
    return null;
  }

  const toAddress = (hasTo
    ? cleanSingleLine(payload.to, MAX_EMAIL_LENGTH)
    : existingText(existing, "to_address")
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

  if (!EMAIL_PATTERN.test(toAddress) || !subject || !plainText || !status) return null;
  return { toAddress, subject, plainText, status };
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
    subject: cleanDatabaseText(row?.subject, MAX_SUBJECT_LENGTH, "(No subject)"),
    preview: preview(row?.plain_text),
    status: requestedDraftStatus(row?.status) || "draft",
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
