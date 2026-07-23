import { mailboxForAddress } from "./_mailboxes.js";

const IDENTITY_SENDERS = Object.freeze({
  "drdeandrehyde@gmail.com": "deandre@brisbanetvs.com",
  "kodycameron2000@gmail.com": "kody@brisbanetvs.com",
  "tomdavie016@gmail.com": "tom@brisbanetvs.com",
});

const OUTBOX_STATUSES = new Set(["queued", "sending", "sent", "failed", "cancelled"]);
const SAFE_PROVIDER_CODE = /^E_[A-Z0-9_]{1,80}$/;
const SAFE_MESSAGE_ID = /^<[^<>\s]{1,990}>$/;

function cleanText(value, maximum, fallback = "") {
  return typeof value === "string"
    ? value.replace(/\u0000/g, "").slice(0, maximum)
    : fallback;
}

export function senderForIdentity(value) {
  const identity = typeof value === "string" ? value.trim().toLowerCase() : "";
  const address = IDENTITY_SENDERS[identity];
  return address ? mailboxForAddress(address) : null;
}

export function sendingReadiness(env = {}) {
  const approved = env.MAIL_SEND_ENABLED === "true";
  const bindingConfigured = Boolean(
    env.OPERATIONS_EMAIL
    && typeof env.OPERATIONS_EMAIL.send === "function",
  );

  if (!approved) {
    return {
      enabled: false,
      status: "onboarding_pending",
      detail: "Cloudflare Email Sending onboarding and a controlled live test are still required.",
    };
  }

  if (!bindingConfigured) {
    return {
      enabled: false,
      status: "binding_missing",
      detail: "The restricted Cloudflare Email Sending binding is not configured.",
    };
  }

  return {
    enabled: true,
    status: "ready",
    detail: "Human-confirmed transactional sending is available.",
  };
}

export function sendingCapability(env, identityEmail) {
  const readiness = sendingReadiness(env);
  const sender = senderForIdentity(identityEmail);
  return {
    send: readiness.enabled && Boolean(sender),
    sendStatus: sender ? readiness.status : "identity_not_authorized",
    sendDetail: sender
      ? readiness.detail
      : "This staff identity does not have an approved Brisbane TVs sender address.",
    senderAddress: sender?.address || null,
  };
}

export function plainTextToHtml(value) {
  const escaped = cleanText(value, 10_000)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
  return `<div style="font-family:Arial,sans-serif;line-height:1.55;white-space:pre-wrap">${escaped}</div>`;
}

export function threadHeaders(inReplyTo) {
  const messageId = cleanText(inReplyTo, 1_000).trim();
  return SAFE_MESSAGE_ID.test(messageId)
    ? { "In-Reply-To": messageId, References: messageId }
    : undefined;
}

export function safeProviderErrorCode(error) {
  const code = typeof error?.code === "string" ? error.code.trim() : "";
  return SAFE_PROVIDER_CODE.test(code) ? code : "E_DELIVERY_FAILED";
}

export function toOutboxSummary(row) {
  const status = cleanText(row?.status, 32);
  const plainText = cleanText(row?.plain_text, 280).replace(/\s+/g, " ").trim();
  return {
    id: cleanText(row?.id, 200),
    draftId: cleanText(row?.draft_id, 200),
    from: cleanText(row?.from_address, 320),
    to: cleanText(row?.to_address, 320),
    subject: cleanText(row?.subject, 180, "(No subject)"),
    preview: plainText.length > 220 ? `${plainText.slice(0, 219)}\u2026` : plainText,
    status: OUTBOX_STATUSES.has(status) ? status : "failed",
    requestedBy: cleanText(row?.requested_by, 320),
    requestedAt: cleanText(row?.requested_at, 64),
    updatedAt: cleanText(row?.updated_at, 64),
    providerMessageId: cleanText(row?.provider_message_id, 512),
    safeErrorCode: cleanText(row?.safe_error_code, 100),
  };
}
