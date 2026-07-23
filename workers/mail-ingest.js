import PostalMime from "postal-mime";
import { canonicalOperationsMailbox } from "./mailboxes.js";

const MAX_INBOUND_BYTES = 8 * 1024 * 1024;
const MAX_SUBJECT_LENGTH = 512;
const MAX_ADDRESS_LENGTH = 320;
const MAX_HEADER_LENGTH = 4_096;
const MAX_BODY_LENGTH = 48_000;

function cleanText(value, maximum) {
  if (typeof value !== "string") return "";
  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, maximum);
}

function cleanHeader(value, maximum = MAX_HEADER_LENGTH) {
  return cleanText(value, maximum).replace(/[\r\n]+/g, " ");
}

function cleanAddress(value) {
  const address = cleanHeader(value, MAX_ADDRESS_LENGTH).toLowerCase();
  return /^[^\s@<>]+@[^\s@<>]+$/.test(address) ? address : "";
}

function firstParsedAddress(value) {
  const candidates = Array.isArray(value) ? value : [value];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const address = cleanAddress(candidate.address);
    if (address) return address;
    if (Array.isArray(candidate.group)) {
      const groupAddress = firstParsedAddress(candidate.group);
      if (groupAddress) return groupAddress;
    }
  }
  return "";
}

function messageHeader(message, name) {
  try {
    return cleanHeader(message.headers?.get(name) || "");
  } catch {
    return "";
  }
}

function inboundObjectKey(id, now) {
  const day = now.toISOString().slice(0, 10).replace(/-/g, "");
  return `mail/inbound/${day}/${id}.eml`;
}

function inboxAvailable(env) {
  return Boolean(
    env
      && env.OPERATIONS_DB
      && typeof env.OPERATIONS_DB.prepare === "function"
      && env.INBOX_MAIL_RAW
      && typeof env.INBOX_MAIL_RAW.put === "function",
  );
}

function parsedMailDetails(message, parsed) {
  const messageId = cleanHeader(parsed?.messageId || messageHeader(message, "message-id"));
  const inReplyTo = cleanHeader(parsed?.inReplyTo || messageHeader(message, "in-reply-to"));
  const references = cleanHeader(parsed?.references || messageHeader(message, "references"));
  const subject = cleanHeader(parsed?.subject || messageHeader(message, "subject"), MAX_SUBJECT_LENGTH) || "(No subject)";
  const plainText = cleanText(parsed?.text || "", MAX_BODY_LENGTH);
  const attachments = Array.isArray(parsed?.attachments) ? parsed.attachments.length : 0;

  return {
    messageId,
    inReplyTo,
    references,
    subject,
    plainText,
    attachmentCount: Number.isSafeInteger(attachments) ? attachments : 0,
  };
}

function referencedMessageIds(details) {
  const ids = [];
  const add = (value) => {
    const cleaned = cleanHeader(value);
    if (cleaned && !ids.includes(cleaned)) ids.push(cleaned);
  };

  add(details.inReplyTo);
  const referenced = details.references.match(/<[^<>]{1,998}>/g) || [];
  referenced.slice(-20).reverse().forEach(add);
  return ids.slice(0, 20);
}

async function resolveThreadId(env, details, mailboxAddress) {
  const references = referencedMessageIds(details);
  if (!references.length) return crypto.randomUUID();

  const placeholders = references.map(() => "?").join(", ");
  const row = await env.OPERATIONS_DB.prepare(
    `SELECT thread_id FROM mail_messages
      WHERE mailbox_address = ? AND message_id IN (${placeholders}) AND thread_id <> ''
      ORDER BY received_at DESC
      LIMIT 1`,
  ).bind(mailboxAddress, ...references).first();

  return cleanHeader(row?.thread_id, 200) || crypto.randomUUID();
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", value);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function duplicateExists(env, ingestKey) {
  if (!ingestKey) return false;
  const row = await env.OPERATIONS_DB.prepare(
    "SELECT id FROM mail_messages WHERE ingest_key = ? LIMIT 1",
  ).bind(ingestKey).first();
  return Boolean(row?.id);
}

/**
 * Stores routed incoming email for staff review. It never forwards, replies,
 * or sends mail. Cloudflare Email Routing must be explicitly configured with
 * a rule before this handler can receive anything.
 */
export async function receiveInboundMail(message, env) {
  if (!inboxAvailable(env)) {
    message.setReject("The team inbox is temporarily unavailable");
    console.error(JSON.stringify({ event: "mail_inbox_binding_unavailable" }));
    return;
  }

  const rawSize = Number(message.rawSize);
  if (!Number.isFinite(rawSize) || rawSize < 0 || rawSize > MAX_INBOUND_BYTES) {
    message.setReject("This message exceeds the team inbox size limit");
    console.warn(JSON.stringify({ event: "mail_inbox_message_rejected_for_size" }));
    return;
  }

  const mailboxAddress = canonicalOperationsMailbox(message.to);
  if (!mailboxAddress) {
    message.setReject("This mailbox does not exist");
    console.warn(JSON.stringify({ event: "mail_inbox_unknown_recipient_rejected" }));
    return;
  }

  const id = crypto.randomUUID();
  const now = new Date();
  const receivedAt = now.toISOString();
  const objectKey = inboundObjectKey(id, now);
  let raw;
  let ingestKey = "";

  try {
    // The raw MIME stream is single-use. Buffer it once, then use that one
    // bounded copy for private R2 retention and text-only parsing.
    raw = await new Response(message.raw).arrayBuffer();
    if (raw.byteLength > MAX_INBOUND_BYTES) {
      message.setReject("This message exceeds the team inbox size limit");
      console.warn(JSON.stringify({ event: "mail_inbox_message_rejected_for_size" }));
      return;
    }

    const parsed = await PostalMime.parse(raw, {
      attachmentEncoding: "arraybuffer",
      maxHeadersSize: 64 * 1024,
      maxNestingDepth: 16,
    });
    const details = parsedMailDetails(message, parsed);
    const envelopeFromAddress = cleanAddress(message.from);
    const headerFromAddress = firstParsedAddress(parsed?.from);
    const replyToAddress = firstParsedAddress(parsed?.replyTo)
      || headerFromAddress
      || envelopeFromAddress;
    const fromAddress = headerFromAddress || replyToAddress || envelopeFromAddress;
    const toAddress = mailboxAddress;
    ingestKey = `${mailboxAddress}:${await sha256Hex(raw)}`;

    if (await duplicateExists(env, ingestKey)) {
      console.log(JSON.stringify({ event: "mail_inbox_duplicate_ignored" }));
      return;
    }

    const threadId = await resolveThreadId(env, details, mailboxAddress);

    await env.INBOX_MAIL_RAW.put(objectKey, raw, {
      httpMetadata: { contentType: "message/rfc822" },
    });

    const existingContact = replyToAddress
      ? await env.OPERATIONS_DB.prepare(
        "SELECT id FROM contacts WHERE lower(email) = ? LIMIT 1",
      ).bind(replyToAddress).first()
      : null;

    await env.OPERATIONS_DB.prepare(
      "INSERT INTO mail_messages (id, thread_id, contact_id, direction, from_address, reply_to_address, envelope_from_address, to_address, subject, plain_text, received_at, status, created_at, updated_at, raw_object_key, message_id, in_reply_to, references_header, attachment_count, size_bytes, mailbox_address, ingest_key) VALUES (?, ?, ?, 'inbound', ?, ?, ?, ?, ?, ?, ?, 'stored', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        id,
        threadId,
        existingContact?.id || null,
        fromAddress,
        replyToAddress,
        envelopeFromAddress,
        toAddress,
        details.subject,
        details.plainText,
        receivedAt,
        receivedAt,
        receivedAt,
        objectKey,
        details.messageId,
        details.inReplyTo,
        details.references,
        details.attachmentCount,
        raw.byteLength,
        mailboxAddress,
        ingestKey,
      )
      .run();

    console.log(JSON.stringify({
      event: "mail_inbox_message_stored",
      attachmentCount: details.attachmentCount,
      sizeBytes: raw.byteLength,
    }));
  } catch (error) {
    if (raw) {
      try {
        await env.INBOX_MAIL_RAW.delete(objectKey);
      } catch {
        // Do not log identifiers or message data. The failed storage event is
        // enough for an operator to investigate from Workers logs.
      }
    }
    try {
      if (await duplicateExists(env, ingestKey)) {
        console.log(JSON.stringify({ event: "mail_inbox_duplicate_ignored" }));
        return;
      }
    } catch {
      // Continue to the safe rejection below when duplicate verification fails.
    }
    message.setReject("The team inbox could not safely store this message");
    // Parser and storage errors can contain attacker-controlled MIME header
    // material. Keep production logs useful without emitting mail contents.
    console.error(JSON.stringify({ event: "mail_inbox_store_failed" }));
  }
}
