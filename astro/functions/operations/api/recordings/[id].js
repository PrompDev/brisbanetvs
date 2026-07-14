import {
  hasOperationsDatabase,
  json,
  requireOperationsAccess,
} from "../_lib/auth.js";

const RECORDING_ID_PATTERN = /^recording_[0-9a-f-]{36}$/i;

function safeFilename(value) {
  const cleaned = String(value || "call-recording.m4a")
    .replace(/[^A-Za-z0-9._ -]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return cleaned || "call-recording.m4a";
}

export async function onRequestGet({ request, env, params }) {
  const access = await requireOperationsAccess(request, env);
  if (access.response) return access.response;
  if (!hasOperationsDatabase(env) || !env?.CALL_RECORDINGS?.get) {
    return json({ ok: false, error: "recording_store_unavailable" }, 503);
  }

  const id = String(params.id || "");
  if (!RECORDING_ID_PATTERN.test(id)) return json({ ok: false, error: "recording_not_found" }, 404);

  const record = await env.OPERATIONS_DB.prepare(
    "SELECT object_key, original_filename, content_type FROM ops_call_recordings WHERE id = ?",
  ).bind(id).first();
  if (!record) return json({ ok: false, error: "recording_not_found" }, 404);

  try {
    const rangeRequested = Boolean(request.headers.get("range"));
    const object = await env.CALL_RECORDINGS.get(record.object_key, {
      range: request.headers,
      onlyIf: request.headers,
    });
    if (!object || !("body" in object)) {
      return json({ ok: false, error: "recording_not_found" }, object ? 412 : 404);
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("accept-ranges", "bytes");
    headers.set("cache-control", "private, no-store");
    headers.set("content-disposition", `inline; filename="${safeFilename(record.original_filename)}"`);
    headers.set("content-type", String(record.content_type || "audio/mp4"));
    headers.set("etag", object.httpEtag);
    headers.set("referrer-policy", "no-referrer");
    headers.set("x-content-type-options", "nosniff");
    if (rangeRequested && object.range) {
      const start = object.range.offset;
      const end = start + object.range.length - 1;
      headers.set("content-range", `bytes ${start}-${end}/${object.size}`);
      headers.set("content-length", String(object.range.length));
    } else {
      headers.set("content-length", String(object.size));
    }
    return new Response(object.body, { status: rangeRequested ? 206 : 200, headers });
  } catch (error) {
    console.error(JSON.stringify({
      event: "operations_recording_read_failed",
      recordingId: id,
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    }));
    return json({ ok: false, error: "recording_unavailable" }, 503);
  }
}
