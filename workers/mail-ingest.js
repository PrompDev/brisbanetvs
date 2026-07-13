import PostalMime from "postal-mime";

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
  return cleanText(value, MAX_ADDRESS_LENGTH).toLowerCase();
}

function messageHeader(message, name) {
  try {
    return cleanHeader(message.headers?.get(name) || "");
  } catch {
    return "";
  }
}

function inboundThreadId(messageId, inReplyTo) {
  return inReplyTo || messageId || crypto.randomUUID();
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

  const id = crypto.randomUUID();
  const now = new Date();
  const receivedAt = now.toISOString();
  const objectKey = inboundObjectKey(id, now);
  let raw;

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
    const fromAddress = cleanAddress(message.from);
    const toAddress = cleanAddress(message.to);

    await env.INBOX_MAIL_RAW.put(objectKey, raw, {
      httpMetadata: { contentType: "message/rfc822" },
    });

    const existingContact = fromAddress
      ? await env.OPERATIONS_DB.prepare(
        "SELECT id FROM contacts WHERE lower(email) = ? LIMIT 1",
      ).bind(fromAddress).first()
      : null;

    await env.OPERATIONS_DB.prepare(
      "INSERT INTO mail_messages (id, thread_id, contact_id, direction, from_address, to_address, subject, plain_text, received_at, status, created_at, updated_at, raw_object_key, message_id, in_reply_to, references_header, attachment_count, size_bytes) VALUES (?, ?, ?, 'inbound', ?, ?, ?, ?, ?, 'stored', ?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        id,
        inboundThreadId(details.messageId, details.inReplyTo),
        existingContact?.id || null,
        fromAddress,
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
    message.setReject("The team inbox could not safely store this message");
    // Parser and storage errors can contain attacker-controlled MIME header
    // material. Keep production logs useful without emitting mail contents.
    console.error(JSON.stringify({ event: "mail_inbox_store_failed" }));
  }
}
