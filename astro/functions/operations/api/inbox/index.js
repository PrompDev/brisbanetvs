import { hasOperationsDatabase, json, requireOperationsAccess } from "../_lib/auth.js";
import { boundedInteger, requestedListStatus } from "./_drafts.js";
import {
  mailboxForAddress,
  mailboxSummaries,
  requestedMailbox,
  TEAM_MAILBOXES,
} from "./_mailboxes.js";
import { mailboxRoutingReadiness } from "./_readiness.js";
import { sendingCapability } from "./_sending.js";

const MAX_LIMIT = 100;
const MAX_OFFSET = 1_000;
const MAX_SEARCH_LENGTH = 120;
const MESSAGE_STATUSES = new Set(["all", "stored", "archived", "blocked"]);

function safeText(value, maximum, fallback = "") {
  return typeof value === "string"
    ? value.replace(/\u0000/g, "").slice(0, maximum)
    : fallback;
}

function safeCount(value) {
  const count = Number(value);
  return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}

function preview(value) {
  const compact = safeText(value, 280).replace(/\s+/g, " ").trim();
  return compact.length > 220 ? `${compact.slice(0, 219)}…` : compact;
}

function toMessage(row) {
  return {
    id: safeText(row?.id, 200),
    threadId: safeText(row?.thread_id, 200),
    from: safeText(row?.from_address, 320),
    to: safeText(row?.to_address, 320),
    subject: safeText(row?.subject, 180, "(No subject)"),
    preview: preview(row?.plain_text),
    receivedAt: safeText(row?.received_at, 64),
    status: safeText(row?.status, 32, "stored"),
    attachmentCount: safeCount(row?.attachment_count),
    readAt: safeText(row?.read_at, 64) || null,
    mailbox: mailboxForAddress(row?.mailbox_address || row?.to_address),
  };
}

/**
 * Lists safe inbound message summaries. Raw MIME and attachment objects remain
 * private in R2, and outbound delivery stays disabled until Email Sending is
 * explicitly onboarded and reviewed.
 */
export async function onRequestGet({ request, env }) {
  const access = await requireOperationsAccess(request, env);
  if (access.response) return access.response;
  if (!hasOperationsDatabase(env)) {
    console.error(JSON.stringify({ event: "operations_inbox_database_not_configured" }));
    return json({ ok: false, error: "mailbox_unavailable" }, 503);
  }

  const url = new URL(request.url);
  const status = requestedListStatus(url.searchParams.get("status"), MESSAGE_STATUSES);
  const limit = Math.max(1, boundedInteger(url.searchParams.get("limit"), 50, MAX_LIMIT));
  const offset = boundedInteger(url.searchParams.get("offset"), 0, MAX_OFFSET);
  const mailbox = requestedMailbox(url.searchParams.get("mailbox"));
  const search = safeText(url.searchParams.get("query"), MAX_SEARCH_LENGTH).trim().toLowerCase();
  const conditions = ["direction = 'inbound'"];
  const values = [];

  if (status !== "all") {
    conditions.push("status = ?");
    values.push(status);
  }
  if (mailbox) {
    conditions.push("lower(mailbox_address) = ?");
    values.push(mailbox.address);
  }
  if (search) {
    const searchValue = `%${search}%`;
    conditions.push("(lower(from_address) LIKE ? OR lower(to_address) LIKE ? OR lower(subject) LIKE ? OR lower(plain_text) LIKE ?)");
    values.push(searchValue, searchValue, searchValue, searchValue);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const listSql = `SELECT id, thread_id, from_address, to_address, mailbox_address, subject, plain_text, received_at, status, attachment_count, read_at
    FROM mail_messages ${where} ORDER BY received_at DESC, id DESC LIMIT ? OFFSET ?`;
  const countSql = `SELECT COUNT(*) AS count FROM mail_messages ${where}`;
  const mailboxCountsSql = `SELECT lower(mailbox_address) AS address, COUNT(*) AS count
    FROM mail_messages
    WHERE direction = 'inbound' AND status = 'stored'
    GROUP BY lower(mailbox_address)`;

  try {
    const [listResult, countRow, mailboxCountResult] = await Promise.all([
      env.OPERATIONS_DB.prepare(listSql).bind(...values, limit, offset).all(),
      env.OPERATIONS_DB.prepare(countSql).bind(...values).first(),
      env.OPERATIONS_DB.prepare(mailboxCountsSql).all(),
    ]);

    const routing = mailboxRoutingReadiness(env);
    const sendCapability = sendingCapability(env, access.identity?.email);
    const inboundEnabled = routing.rootDeliveryActive;
    return json({
      ok: true,
      mailboxAddress: mailbox?.address || null,
      mailbox: mailbox || { id: "all", name: "All mailboxes", address: null },
      mailboxes: mailboxSummaries(mailboxCountResult.results),
      acceptedAddresses: TEAM_MAILBOXES.map(({ id, name, address }) => ({ id, name, address })),
      inboundEnabled,
      delivery: routing.status,
      routing,
      outboundEnabled: sendCapability.send,
      capabilities: {
        receive: inboundEnabled || routing.testReceiverActive,
        receiveRoot: inboundEnabled,
        receiveTest: routing.testReceiverActive,
        createDrafts: true,
        ...sendCapability,
      },
      status,
      query: search,
      total: safeCount(countRow?.count),
      offset,
      limit,
      messages: (listResult.results || []).map(toMessage),
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: "operations_inbox_query_failed",
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    }));
    return json({ ok: false, error: "mailbox_unavailable" }, 503);
  }
}
