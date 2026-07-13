import { hasOperationsDatabase, json, requireOperationsAccess } from "../_lib/auth.js";

function toMessage(row) {
  return {
    id: String(row.id || ""),
    from: String(row.from_address || ""),
    subject: String(row.subject || "(No subject)"),
    receivedAt: String(row.received_at || ""),
    status: String(row.status || "received"),
  };
}

/**
 * This is intentionally read-only. Incoming delivery is not enabled until the
 * existing domain mail service has a reviewed migration plan, and there is no
 * outbound binding or send endpoint in this application.
 */
export async function onRequestGet({ request, env }) {
  const access = await requireOperationsAccess(request, env);
  if (access.response) return access.response;
  if (!hasOperationsDatabase(env)) {
    console.error(JSON.stringify({ event: "operations_inbox_database_not_configured" }));
    return json({ ok: false, error: "mailbox_unavailable" }, 503);
  }

  try {
    const result = await env.OPERATIONS_DB.prepare(
      "SELECT id, from_address, subject, received_at, status FROM mail_messages WHERE direction = 'inbound' ORDER BY received_at DESC, id DESC LIMIT 30",
    ).all();

    const inboundEnabled = env.TEAM_INBOX_ENABLED === "true";
    return json({
      ok: true,
      mailboxAddress: "team@brisbanetvs.com",
      inboundEnabled,
      delivery: inboundEnabled ? "active" : "staged",
      outboundEnabled: false,
      messages: (result.results || []).map(toMessage),
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: "operations_inbox_query_failed",
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    }));
    return json({ ok: false, error: "mailbox_unavailable" }, 503);
  }
}
