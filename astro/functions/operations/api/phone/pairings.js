import {
  hasOperationsDatabase,
  json,
  requireOperationsAccess,
} from "../_lib/auth.js";

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomCode() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function sameOriginRequest(request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  return origin === new URL(request.url).origin && fetchSite !== "cross-site";
}

export async function onRequestPost({ request, env, waitUntil }) {
  const access = await requireOperationsAccess(request, env);
  if (access.response) return access.response;
  if (!hasOperationsDatabase(env)) return json({ ok: false, error: "pairing_unavailable" }, 503);
  if (!sameOriginRequest(request)) return json({ ok: false, error: "request_denied" }, 403);

  const code = randomCode();
  const nowDate = new Date();
  const now = nowDate.toISOString();
  const expiresAt = new Date(nowDate.getTime() + (10 * 60 * 1000)).toISOString();
  const pairingId = `pairing_${crypto.randomUUID()}`;
  const codeHash = await sha256Hex(code);

  try {
    await env.OPERATIONS_DB.prepare(
      "INSERT INTO mobile_call_pairings "
        + "(id, code_hash, created_by, expires_at, used_at, created_at) VALUES (?, ?, ?, ?, '', ?)",
    ).bind(pairingId, codeHash, access.identity.email || access.identity.subject || "staff", expiresAt, now).run();
    waitUntil(
      env.OPERATIONS_DB.prepare(
        "DELETE FROM mobile_call_pairings WHERE expires_at < ? AND used_at <> ''",
      ).bind(new Date(nowDate.getTime() - (7 * 24 * 60 * 60 * 1000)).toISOString()).run().catch(() => undefined),
    );
    return json({ ok: true, code, expiresAt }, 201);
  } catch (error) {
    console.error(JSON.stringify({
      event: "mobile_pairing_create_failed",
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    }));
    return json({ ok: false, error: "pairing_unavailable" }, 503);
  }
}
