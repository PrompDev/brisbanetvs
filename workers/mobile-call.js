const JSON_HEADERS = {
  "cache-control": "private, no-store",
  "content-type": "application/json; charset=utf-8",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
};

const MAX_JSON_BYTES = 4_096;
const MAX_RECORDING_BYTES = 100 * 1024 * 1024;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:_-]{7,159}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const UPLOAD_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{15,127}$/;
const AUDIO_TYPE_PATTERN = /^audio\/[a-z0-9.+-]{1,40}$/;

const EXTENSION_TYPES = new Map([
  ["aac", "audio/aac"],
  ["m4a", "audio/mp4"],
  ["mp3", "audio/mpeg"],
  ["mp4", "audio/mp4"],
  ["oga", "audio/ogg"],
  ["ogg", "audio/ogg"],
  ["wav", "audio/wav"],
  ["3gp", "audio/3gpp"],
]);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function safeText(value, maximum = 160) {
  return String(value == null ? "" : value).trim().replace(/\u0000/g, "").slice(0, maximum);
}

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomSecret() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

export async function sha256Hex(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function readSmallJson(request) {
  const declared = Number.parseInt(request.headers.get("content-length") || "", 10);
  if (Number.isFinite(declared) && declared > MAX_JSON_BYTES) return null;
  const text = await request.text();
  if (!text || new TextEncoder().encode(text).byteLength > MAX_JSON_BYTES) return null;
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function hasBindings(env) {
  return Boolean(
    env?.OPERATIONS_DB?.prepare
    && env?.CALL_RECORDINGS?.put
    && env?.CALL_RECORDINGS?.delete,
  );
}

async function deviceForRequest(request, env, ctx) {
  const header = request.headers.get("authorization") || "";
  const match = /^Bearer ([A-Za-z0-9_-]{32,128})$/.exec(header);
  if (!match) return null;
  const tokenHash = await sha256Hex(match[1]);
  const device = await env.OPERATIONS_DB.prepare(
    "SELECT id, label, owner_email FROM mobile_call_devices "
      + "WHERE token_hash = ? AND active = 1 AND revoked_at = ''",
  ).bind(tokenHash).first();
  if (!device) return null;

  const now = new Date().toISOString();
  ctx.waitUntil(
    env.OPERATIONS_DB.prepare(
      "UPDATE mobile_call_devices SET last_used_at = ?, updated_at = ? WHERE id = ?",
    ).bind(now, now, device.id).run().catch(() => undefined),
  );
  return device;
}

function leadReference(url) {
  const leadId = safeText(url.searchParams.get("lead_id"), 160);
  const reference = safeText(url.searchParams.get("ref"), 160);
  const source = safeText(url.searchParams.get("source"), 64);
  return { leadId, reference, source };
}

export function normalisedExternalReference(reference, source) {
  return source.toLowerCase() === "website" && reference.toLowerCase().startsWith("website:")
    ? reference.slice("website:".length)
    : reference;
}

async function findLead(db, { leadId, reference, source }) {
  if (leadId && ID_PATTERN.test(leadId)) {
    return db.prepare(
      "SELECT id, external_id, source, full_name, phone, service, suburb FROM leads WHERE id = ?",
    ).bind(leadId).first();
  }
  if (!reference || !ID_PATTERN.test(reference)) return null;
  const externalReference = normalisedExternalReference(reference, source);

  const query = source
    ? db.prepare(
      "SELECT id, external_id, source, full_name, phone, service, suburb FROM leads "
        + "WHERE external_id = ? AND source = ? ORDER BY received_at DESC LIMIT 2",
    ).bind(externalReference, source)
    : db.prepare(
      "SELECT id, external_id, source, full_name, phone, service, suburb FROM leads "
        + "WHERE external_id = ? ORDER BY received_at DESC LIMIT 2",
    ).bind(externalReference);
  const result = await query.all();
  return result.results?.length === 1 ? result.results[0] : null;
}

function contentTypeForUpload(request, filename) {
  const declared = safeText((request.headers.get("content-type") || "").split(";", 1)[0], 64).toLowerCase();
  if (AUDIO_TYPE_PATTERN.test(declared)) return declared;
  if (declared && declared !== "application/octet-stream") return "";
  const extension = filename.toLowerCase().match(/\.([a-z0-9]{2,5})$/)?.[1] || "";
  return EXTENSION_TYPES.get(extension) || "";
}

function extensionFor(contentType, filename) {
  const supplied = filename.toLowerCase().match(/\.([a-z0-9]{2,5})$/)?.[1];
  if (supplied && EXTENSION_TYPES.has(supplied)) return supplied;
  for (const [extension, type] of EXTENSION_TYPES) {
    if (type === contentType) return extension;
  }
  return "audio";
}

function boundedDuration(value) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isInteger(parsed) && parsed >= 0 ? Math.min(parsed, 86_400) : 0;
}

function safeStartedAt(value, now) {
  const parsed = new Date(value || "");
  if (Number.isNaN(parsed.getTime())) return now.toISOString();
  const earliest = now.getTime() - (31 * 24 * 60 * 60 * 1000);
  const latest = now.getTime() + (5 * 60 * 1000);
  return parsed.getTime() >= earliest && parsed.getTime() <= latest
    ? parsed.toISOString()
    : now.toISOString();
}

function retentionDays(env) {
  const value = Number.parseInt(env.CALL_RECORDING_RETENTION_DAYS || "90", 10);
  return Number.isInteger(value) ? Math.max(1, Math.min(value, 365)) : 90;
}

export async function exchangeMobilePairing(request, env) {
  if (!hasBindings(env)) return json({ ok: false, error: "service_unavailable" }, 503);
  const body = await readSmallJson(request);
  const code = safeText(body?.code, 128);
  const label = safeText(body?.deviceLabel, 80) || "Tom's Pixel";
  if (!TOKEN_PATTERN.test(code)) return json({ ok: false, error: "invalid_pairing" }, 400);

  const now = new Date().toISOString();
  const codeHash = await sha256Hex(code);
  const pairing = await env.OPERATIONS_DB.prepare(
    "UPDATE mobile_call_pairings SET used_at = ? "
      + "WHERE code_hash = ? AND used_at = '' AND expires_at > ? "
      + "RETURNING id, created_by",
  ).bind(now, codeHash, now).first();
  if (!pairing) return json({ ok: false, error: "pairing_expired" }, 401);

  const token = randomSecret();
  const tokenHash = await sha256Hex(token);
  const deviceId = `device_${crypto.randomUUID()}`;
  try {
    await env.OPERATIONS_DB.prepare(
      "INSERT INTO mobile_call_devices "
        + "(id, token_hash, label, owner_email, active, last_used_at, revoked_at, created_at, updated_at) "
        + "VALUES (?, ?, ?, ?, 1, '', '', ?, ?)",
    ).bind(deviceId, tokenHash, label, safeText(pairing.created_by, 254), now, now).run();
  } catch (error) {
    console.error(JSON.stringify({
      event: "mobile_pairing_device_create_failed",
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    }));
    return json({ ok: false, error: "pairing_failed" }, 503);
  }

  return json({ ok: true, token, deviceId });
}

export async function getMobileLead(request, env, ctx) {
  if (!hasBindings(env)) return json({ ok: false, error: "service_unavailable" }, 503);
  const device = await deviceForRequest(request, env, ctx);
  if (!device) return json({ ok: false, error: "device_not_authorised" }, 401);

  const url = new URL(request.url);
  const reference = leadReference(url);
  const lead = await findLead(env.OPERATIONS_DB, reference);
  if (!lead) return json({ ok: false, error: "lead_not_found" }, 404);

  return json({
    ok: true,
    lead: {
      id: safeText(lead.id, 160),
      reference: safeText(lead.external_id, 160),
      source: safeText(lead.source, 64),
      name: safeText(lead.full_name, 160),
      phone: safeText(lead.phone, 64),
      service: safeText(lead.service, 160),
      suburb: safeText(lead.suburb, 120),
    },
  });
}

export async function uploadMobileRecording(request, env, ctx) {
  if (!hasBindings(env)) return json({ ok: false, error: "service_unavailable" }, 503);
  const device = await deviceForRequest(request, env, ctx);
  if (!device) return json({ ok: false, error: "device_not_authorised" }, 401);
  if (request.headers.get("x-consent-confirmed") !== "recording-announcement") {
    return json({ ok: false, error: "recording_disclosure_required" }, 400);
  }

  const leadId = safeText(request.headers.get("x-lead-id"), 160);
  const uploadId = safeText(request.headers.get("x-upload-id"), 128);
  const filename = safeText(request.headers.get("x-file-name"), 180) || "call-recording.m4a";
  const checksum = safeText(request.headers.get("x-content-sha256"), 64).toLowerCase();
  const direction = request.headers.get("x-call-direction") === "inbound" ? "inbound" : "outbound";
  const size = Number.parseInt(request.headers.get("content-length") || "", 10);
  const contentType = contentTypeForUpload(request, filename);
  if (!ID_PATTERN.test(leadId)) return json({ ok: false, error: "invalid_lead" }, 400);
  if (!UPLOAD_ID_PATTERN.test(uploadId)) return json({ ok: false, error: "invalid_upload_id" }, 400);
  if (!SHA256_PATTERN.test(checksum)) return json({ ok: false, error: "invalid_checksum" }, 400);
  if (!Number.isInteger(size) || size <= 0) return json({ ok: false, error: "content_length_required" }, 411);
  if (size > MAX_RECORDING_BYTES) return json({ ok: false, error: "recording_too_large" }, 413);
  if (!contentType) return json({ ok: false, error: "unsupported_audio_type" }, 415);
  if (!request.body) return json({ ok: false, error: "recording_required" }, 400);

  const existing = await env.OPERATIONS_DB.prepare(
    "SELECT id, call_id FROM ops_call_recordings WHERE uploaded_by_device_id = ? AND client_upload_id = ?",
  ).bind(device.id, uploadId).first();
  if (existing) return json({ ok: true, recordingId: existing.id, callId: existing.call_id, replayed: true });

  const lead = await env.OPERATIONS_DB.prepare("SELECT id FROM leads WHERE id = ?").bind(leadId).first();
  if (!lead) return json({ ok: false, error: "lead_not_found" }, 404);

  const nowDate = new Date();
  const now = nowDate.toISOString();
  const recordingId = `recording_${crypto.randomUUID()}`;
  const callId = `call_${crypto.randomUUID()}`;
  const activityId = `activity_${crypto.randomUUID()}`;
  const extension = extensionFor(contentType, filename);
  const year = String(nowDate.getUTCFullYear());
  const month = String(nowDate.getUTCMonth() + 1).padStart(2, "0");
  const objectKey = `call-recordings/${year}/${month}/${recordingId}.${extension}`;
  const retentionUntil = new Date(
    nowDate.getTime() + (retentionDays(env) * 24 * 60 * 60 * 1000),
  ).toISOString();
  const startedAt = safeStartedAt(request.headers.get("x-call-started-at"), nowDate);
  const durationSeconds = boundedDuration(request.headers.get("x-call-duration-seconds"));

  try {
    const stored = await env.CALL_RECORDINGS.put(objectKey, request.body, {
      sha256: checksum,
      httpMetadata: {
        contentType,
        cacheControl: "private, no-store",
      },
      customMetadata: { recordingId },
    });
    if (!stored || stored.size !== size) {
      await env.CALL_RECORDINGS.delete(objectKey);
      return json({ ok: false, error: "recording_upload_failed" }, 502);
    }

    await env.OPERATIONS_DB.batch([
      env.OPERATIONS_DB.prepare(
        "INSERT INTO ops_calls "
          + "(id, lead_id, provider, provider_call_id, direction, status, duration_seconds, "
          + "recording_object_key, transcript, summary, sentiment, outcome, follow_up, "
          + "started_at, completed_at, created_at, updated_at) "
          + "VALUES (?, ?, 'pixel_phone', '', ?, 'completed', ?, ?, '', '', 'unknown', '', '', ?, ?, ?, ?)",
      ).bind(callId, leadId, direction, durationSeconds, objectKey, startedAt, now, now, now),
      env.OPERATIONS_DB.prepare(
        "INSERT INTO ops_call_recordings "
          + "(id, call_id, lead_id, object_key, original_filename, content_type, size_bytes, sha256, "
          + "source, consent_confirmed_at, uploaded_by_device_id, client_upload_id, retention_until, created_at) "
          + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pixel_phone_share', ?, ?, ?, ?, ?)",
      ).bind(
        recordingId,
        callId,
        leadId,
        objectKey,
        filename,
        contentType,
        size,
        checksum,
        now,
        device.id,
        uploadId,
        retentionUntil,
        now,
      ),
      env.OPERATIONS_DB.prepare(
        "INSERT INTO ops_activities "
          + "(id, lead_id, activity_type, title, detail, actor, subject_type, subject_id, due_at, "
          + "completed_at, metadata_json, occurred_at, created_at) "
          + "VALUES (?, ?, 'call_recording', 'Call recording uploaded', '', ?, 'ops_call', ?, '', ?, '{}', ?, ?)",
      ).bind(activityId, leadId, safeText(device.owner_email, 254), callId, now, now, now),
    ]);
  } catch (error) {
    await env.CALL_RECORDINGS.delete(objectKey).catch(() => undefined);
    console.error(JSON.stringify({
      event: "mobile_recording_upload_failed",
      recordingId,
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    }));
    return json({ ok: false, error: "recording_upload_failed" }, 503);
  }

  return json({ ok: true, recordingId, callId, replayed: false }, 201);
}
