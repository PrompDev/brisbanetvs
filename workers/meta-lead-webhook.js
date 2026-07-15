import {
  deliverWebsiteLeadToSheet,
  enqueueWebsiteSheetDelivery,
  persistCanonicalLead,
  processPendingWebsiteSheetDeliveries,
  sendRunLogToSheet,
} from "../functions/api/website-lead.js";

const META_SOURCE = "meta_lead_ads";
const META_GRAPH_DEFAULT_VERSION = "v25.0";
const META_WEBHOOK_MAX_BYTES = 512 * 1024;
const META_GRAPH_MAX_RESPONSE_BYTES = 256 * 1024;
const META_GRAPH_TIMEOUT_MS = 10_000;
const META_EVENT_BATCH_LIMIT = 10;
const META_EVENT_MAX_ATTEMPTS = 8;
const META_MONITOR_KEY = "meta_lead_webhook";
const BRISBANE_TIME_ZONE = "Australia/Brisbane";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}

function textResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function limitedText(value, maximum = 512) {
  if (value === undefined || value === null) return "";
  if (!["string", "number", "boolean"].includes(typeof value)) return "";
  return String(value).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, maximum);
}

function normaliseFieldName(value) {
  return limitedText(value, 160)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function validMetaId(value) {
  if (typeof value === "number" && !Number.isSafeInteger(value)) return "";
  const id = limitedText(value, 64);
  return /^\d{5,40}$/.test(id) ? id : "";
}

function bytesFromHex(value) {
  if (!/^[a-f0-9]{64}$/i.test(value)) return null;
  const bytes = new Uint8Array(32);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function constantTimeEqual(left, right) {
  if (!(left instanceof Uint8Array) || !(right instanceof Uint8Array) || left.length !== right.length) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

function constantTimeTextEqual(left, right) {
  const leftBytes = new TextEncoder().encode(String(left || ""));
  const rightBytes = new TextEncoder().encode(String(right || ""));
  return constantTimeEqual(leftBytes, rightBytes);
}

async function hmacSha256(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, value));
}

async function hmacSha256Hex(secret, value) {
  const bytes = await hmacSha256(secret, new TextEncoder().encode(value));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function readBodyBounded(request, maximum) {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maximum) throw new Error("body_too_large");
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > maximum) {
        await reader.cancel();
        throw new Error("body_too_large");
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }

  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

async function readJsonResponseBounded(response, maximum) {
  const bytes = await readBodyBounded(response, maximum);
  if (!bytes.byteLength) throw new Error("graph_invalid_response");
  try {
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    if (!isRecord(payload)) throw new Error("graph_invalid_response");
    return payload;
  } catch (error) {
    if (error instanceof Error && error.message === "body_too_large") throw error;
    throw new Error("graph_invalid_response");
  }
}

export async function verifyMetaWebhookSignature(rawBody, signatureHeader, appSecret) {
  const secret = limitedText(appSecret, 256);
  const signature = limitedText(signatureHeader, 96).toLowerCase();
  if (secret.length < 16 || !signature.startsWith("sha256=")) return false;
  const supplied = bytesFromHex(signature.slice(7));
  if (!supplied) return false;
  const expected = await hmacSha256(secret, rawBody);
  return constantTimeEqual(expected, supplied);
}

export function extractMetaLeadEvents(payload) {
  if (!isRecord(payload) || payload.object !== "page" || !Array.isArray(payload.entry)) return [];
  const events = [];
  const seen = new Set();

  for (const entry of payload.entry.slice(0, 100)) {
    if (!isRecord(entry) || !Array.isArray(entry.changes)) continue;
    const entryPageId = validMetaId(entry.id);
    for (const change of entry.changes.slice(0, 100)) {
      if (!isRecord(change) || change.field !== "leadgen" || !isRecord(change.value)) continue;
      const leadgenId = validMetaId(change.value.leadgen_id);
      if (!leadgenId || seen.has(leadgenId)) continue;
      seen.add(leadgenId);
      events.push({
        id: leadgenId,
        pageId: validMetaId(change.value.page_id) || entryPageId,
        formId: validMetaId(change.value.form_id),
        adId: validMetaId(change.value.ad_id),
        createdTime: Number.isSafeInteger(Number(change.value.created_time))
          ? Number(change.value.created_time)
          : 0,
      });
    }
  }
  return events.slice(0, 100);
}

function requireOperationsDb(env) {
  if (!env.OPERATIONS_DB) throw new Error("storage_not_configured");
  return env.OPERATIONS_DB;
}

function nowIso() {
  return new Date().toISOString();
}

function brisbaneDay(isoTimestamp) {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: BRISBANE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(isoTimestamp));
  const values = {};
  for (const part of parts) values[part.type] = part.value;
  return values.year + "-" + values.month + "-" + values.day;
}

function metaEventRetryAt(attempts) {
  if (attempts >= META_EVENT_MAX_ATTEMPTS) {
    return new Date(Date.now() + 6 * 60 * 60 * 1_000).toISOString();
  }
  const minutes = Math.min(60, 2 ** Math.max(0, attempts - 1));
  return new Date(Date.now() + minutes * 60 * 1_000).toISOString();
}

function safeMetaError(error) {
  const message = error instanceof Error ? error.message : "processing_failed";
  const allowed = new Set([
    "configuration_missing",
    "graph_authentication_failed",
    "graph_permission_denied",
    "graph_rate_limited",
    "graph_not_found",
    "graph_server_error",
    "graph_request_failed",
    "graph_invalid_response",
    "body_too_large",
    "storage_not_configured",
    "storage_failed",
  ]);
  return allowed.has(message) ? message : "processing_failed";
}

export async function storeMetaWebhookEvents(env, events) {
  if (!events.length) return 0;
  const db = requireOperationsDb(env);
  const timestamp = nowIso();
  const statements = events.map((event) => db.prepare(
    "INSERT INTO meta_webhook_events (" +
      "id, page_id, form_id, ad_id, created_time, status, attempts, next_attempt_at, " +
      "last_error, received_at, updated_at, completed_at" +
    ") VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, '', ?, ?, '') " +
    "ON CONFLICT(id) DO NOTHING",
  ).bind(
    event.id,
    event.pageId,
    event.formId,
    event.adId,
    event.createdTime,
    timestamp,
    timestamp,
    timestamp,
  ));
  const results = await db.batch(statements);
  if (results.length !== statements.length || results.some((result) => !result.success)) {
    throw new Error("storage_failed");
  }
  return results.reduce((total, result) => total + (Number(result.meta?.changes) || 0), 0);
}

function answerMap(fieldData) {
  const answers = new Map();
  if (!Array.isArray(fieldData)) return answers;
  for (const field of fieldData.slice(0, 100)) {
    if (!isRecord(field)) continue;
    const name = normaliseFieldName(field.name);
    if (!name || answers.has(name)) continue;
    const values = Array.isArray(field.values) ? field.values : [field.values];
    const answer = values.map((value) => limitedText(value, 2_000)).filter(Boolean).join(", ");
    if (answer) answers.set(name, answer);
  }
  return answers;
}

function firstAnswer(answers, names, maximum) {
  for (const name of names) {
    const value = answers.get(name);
    if (value) return limitedText(value, maximum);
  }
  return "";
}

function metaReceivedAt(payload, event) {
  const created = new Date(limitedText(payload.created_time, 64));
  if (!Number.isNaN(created.getTime())) return created.toISOString();
  if (event.created_time > 0) {
    const fromEvent = new Date(event.created_time * 1_000);
    if (!Number.isNaN(fromEvent.getTime())) return fromEvent.toISOString();
  }
  return nowIso();
}

function metaPlatform(value) {
  const platform = limitedText(value, 64).toLowerCase();
  if (platform === "ig" || platform.includes("instagram")) return "instagram";
  if (platform === "fb" || platform.includes("facebook")) return "facebook";
  return "facebook";
}

function booleanOrBlank(value) {
  if (value === true || value === 1 || String(value).toLowerCase() === "true") return true;
  if (value === false || value === 0 || String(value).toLowerCase() === "false") return false;
  return "";
}

export function canonicalMetaLead(payload, event) {
  if (!isRecord(payload) || !isRecord(event)) throw new Error("graph_invalid_response");
  const externalId = validMetaId(payload.id) || validMetaId(event.id);
  if (!externalId || (validMetaId(payload.id) && externalId !== validMetaId(event.id))) {
    throw new Error("graph_invalid_response");
  }

  const answers = answerMap(payload.field_data);
  const firstName = firstAnswer(answers, ["first_name", "firstname"], 80);
  const lastName = firstAnswer(answers, ["last_name", "lastname"], 80);
  const fullName = firstAnswer(answers, ["full_name", "fullname", "name", "your_name"], 160)
    || limitedText([firstName, lastName].filter(Boolean).join(" "), 160);
  const phone = firstAnswer(answers, [
    "phone_number",
    "phone",
    "mobile_number",
    "mobile",
    "contact_number",
    "your_phone_number",
    "best_phone_number",
    "telephone",
  ], 64);
  const email = firstAnswer(answers, ["email", "email_address", "your_email"], 254).toLowerCase();
  const postcode = firstAnswer(answers, ["postcode", "post_code", "postal_code", "zip_code", "zip"], 20);
  const suburb = firstAnswer(answers, ["suburb", "city", "town", "location"], 120);
  const tvSize = firstAnswer(answers, [
    "what_size_is_your_tv",
    "what_size_is_your_tv_",
    "tv_size",
    "television_size",
    "size_of_tv",
  ], 80);
  const mountingIntent = firstAnswer(answers, [
    "want_to_get_your_tv_mounted",
    "do_you_want_to_get_your_tv_mounted",
    "tv_mounting",
    "service_required",
    "service",
  ], 160);
  const receivedAt = metaReceivedAt(payload, event);
  const campaignName = limitedText(payload.campaign_name, 200);
  const formId = validMetaId(payload.form_id) || validMetaId(event.form_id);
  const details = {
    intake: "meta-lead-webhook",
    ad_id: validMetaId(payload.ad_id) || validMetaId(event.ad_id),
    ad_name: limitedText(payload.ad_name, 200),
    adset_id: validMetaId(payload.adset_id),
    adset_name: limitedText(payload.adset_name, 200),
    campaign_id: validMetaId(payload.campaign_id),
    campaign_name: campaignName,
    form_id: formId,
    form_name: limitedText(payload.form_name, 200),
    is_organic: booleanOrBlank(payload.is_organic),
    mounting_intent: mountingIntent,
    missing_phone: phone ? 0 : 1,
    field_names: Array.from(answers.keys()).slice(0, 100),
  };
  const tracking = {
    source_platform: metaPlatform(payload.platform),
    campaign_id: details.campaign_id,
    adset_id: details.adset_id,
    ad_id: details.ad_id,
    form_id: formId,
  };

  return {
    id: crypto.randomUUID(),
    source: META_SOURCE,
    externalId,
    receivedAt,
    receivedDay: brisbaneDay(receivedAt),
    fullName,
    email,
    phone,
    postcode,
    platform: tracking.source_platform,
    tvSize,
    suburb,
    service: mountingIntent || (tvSize ? "TV mounting" : ""),
    wallType: firstAnswer(answers, ["wall_type", "type_of_wall"], 120),
    preferredDate: firstAnswer(answers, ["preferred_date", "preferred_day", "when_would_you_like_the_work_done"], 100),
    message: firstAnswer(answers, ["message", "notes", "additional_details", "anything_else"], 4_000),
    pageUrl: "",
    campaign: campaignName,
    trackingJson: JSON.stringify(tracking),
    detailsJson: JSON.stringify(details),
    marketingConsent: 0,
  };
}

function metaGraphConfig(env) {
  const token = limitedText(env.META_PAGE_ACCESS_TOKEN, 4_096);
  const appSecret = limitedText(env.META_APP_SECRET, 256);
  const suppliedVersion = limitedText(env.META_GRAPH_API_VERSION, 16);
  const version = /^v\d{1,2}\.\d$/.test(suppliedVersion)
    ? suppliedVersion
    : META_GRAPH_DEFAULT_VERSION;
  if (token.length < 32 || appSecret.length < 16) throw new Error("configuration_missing");
  return { token, appSecret, version };
}

function graphErrorCode(response, payload) {
  const code = Number(payload?.error?.code);
  if (code === 190) return "graph_authentication_failed";
  if ([10, 100, 200].includes(code)) return "graph_permission_denied";
  if ([4, 17, 32, 613].includes(code) || response.status === 429) return "graph_rate_limited";
  if (response.status === 404) return "graph_not_found";
  if (response.status >= 500) return "graph_server_error";
  return "graph_request_failed";
}

async function fetchMetaLead(env, event) {
  const config = metaGraphConfig(env);
  const fields = [
    "id",
    "created_time",
    "ad_id",
    "ad_name",
    "adset_id",
    "adset_name",
    "campaign_id",
    "campaign_name",
    "form_id",
    "is_organic",
    "platform",
    "field_data",
  ].join(",");
  const proof = await hmacSha256Hex(config.appSecret, config.token);
  const url = new URL("https://graph.facebook.com/" + config.version + "/" + event.id);
  url.searchParams.set("fields", fields);
  url.searchParams.set("appsecret_proof", proof);

  let response;
  try {
    response = await fetch(url, {
      headers: { authorization: "Bearer " + config.token },
      signal: AbortSignal.timeout(META_GRAPH_TIMEOUT_MS),
    });
  } catch {
    throw new Error("graph_request_failed");
  }
  const payload = await readJsonResponseBounded(response, META_GRAPH_MAX_RESPONSE_BYTES);
  if (!response.ok || payload.error) throw new Error(graphErrorCode(response, payload));
  return payload;
}

async function processMetaLeadEvent(env, eventId) {
  const db = requireOperationsDb(env);
  const claimAt = nowIso();
  const claim = await db.prepare(
    "UPDATE meta_webhook_events SET status = 'processing', attempts = attempts + 1, updated_at = ? " +
    "WHERE id = ? AND status IN ('pending', 'failed') AND next_attempt_at <= ?",
  ).bind(claimAt, eventId, claimAt).run();
  if (Number(claim.meta?.changes) !== 1) return { processed: false, completed: false };

  const event = await db.prepare(
    "SELECT id, page_id, form_id, ad_id, created_time, attempts FROM meta_webhook_events WHERE id = ?",
  ).bind(eventId).first();
  if (!event) return { processed: false, completed: false };

  try {
    const payload = await fetchMetaLead(env, event);
    const lead = canonicalMetaLead(payload, event);
    const leadId = await persistCanonicalLead(env, lead, {
      type: "lead_received",
      channel: "meta-webhook",
      occurredAt: nowIso(),
      requestId: event.id,
      detailsJson: JSON.stringify({
        page_id: event.page_id,
        form_id: event.form_id,
        ad_id: event.ad_id,
      }),
    }, { insertOnly: true, queueWebsiteSheet: true });
    await enqueueWebsiteSheetDelivery(env, leadId);
    await deliverWebsiteLeadToSheet(env, leadId, true);
    const completedAt = nowIso();
    await db.prepare(
      "UPDATE meta_webhook_events SET status = 'completed', last_error = '', completed_at = ?, " +
      "next_attempt_at = ?, updated_at = ? WHERE id = ?",
    ).bind(completedAt, completedAt, completedAt, event.id).run();
    return { processed: true, completed: true };
  } catch (error) {
    const code = safeMetaError(error);
    const attempts = Math.max(1, Number(event.attempts) || 1);
    const status = attempts >= META_EVENT_MAX_ATTEMPTS ? "failed" : "pending";
    const retryAt = metaEventRetryAt(attempts);
    await db.prepare(
      "UPDATE meta_webhook_events SET status = ?, next_attempt_at = ?, last_error = ?, updated_at = ? " +
      "WHERE id = ?",
    ).bind(status, retryAt, code, nowIso(), event.id).run();
    console.error(JSON.stringify({
      event: "meta_lead_processing_failed",
      error: code,
      attempts,
      status,
    }));
    return { processed: true, completed: false };
  }
}

export async function processPendingMetaLeadEvents(env, preferredIds = []) {
  const db = requireOperationsDb(env);
  const timestamp = nowIso();
  const staleBefore = new Date(Date.now() - 10 * 60 * 1_000).toISOString();
  await db.prepare(
    "UPDATE meta_webhook_events SET status = 'pending', next_attempt_at = ?, updated_at = ? " +
    "WHERE status = 'processing' AND updated_at < ?",
  ).bind(timestamp, timestamp, staleBefore).run();

  let ids = [...new Set(preferredIds.map(validMetaId).filter(Boolean))].slice(0, META_EVENT_BATCH_LIMIT);
  if (!ids.length) {
    const pending = await db.prepare(
      "SELECT id FROM meta_webhook_events WHERE status IN ('pending', 'failed') AND next_attempt_at <= ? " +
      "ORDER BY next_attempt_at ASC, received_at ASC LIMIT ?",
    ).bind(timestamp, META_EVENT_BATCH_LIMIT).all();
    ids = (pending.results || []).map((row) => row.id);
  }

  const result = { processed: 0, completed: 0 };
  for (const id of ids) {
    const item = await processMetaLeadEvent(env, id);
    if (item.processed) result.processed += 1;
    if (item.completed) result.completed += 1;
  }
  return result;
}

function metaWebhookConfigured(env) {
  return limitedText(env.META_WEBHOOK_VERIFY_TOKEN, 256).length >= 32
    && limitedText(env.META_APP_SECRET, 256).length >= 16
    && limitedText(env.META_PAGE_ACCESS_TOKEN, 4_096).length >= 32;
}

async function publishMetaMonitorHeartbeat(env, startedAt) {
  if (String(env.META_MONITOR_ENABLED || "").toLowerCase() !== "true") return;
  const db = requireOperationsDb(env);
  const runAt = nowIso();
  const state = await db.prepare(
    "SELECT last_run_at FROM automation_monitor_state WHERE monitor_key = ?",
  ).bind(META_MONITOR_KEY).first();
  const fallbackStart = new Date(new Date(runAt).getTime() - 3 * 60 * 1_000).toISOString();
  const previousRunAt = limitedText(state?.last_run_at, 64) || fallbackStart;

  const delivered = await db.prepare(
    "SELECT COUNT(*) AS count, SUM(CASE WHEN leads.phone = '' THEN 1 ELSE 0 END) AS missing_phone " +
    "FROM intake_events JOIN leads ON leads.id = intake_events.lead_id " +
    "WHERE leads.source = ? AND intake_events.event_type = 'sheet_delivery_succeeded' " +
    "AND intake_events.occurred_at > ? AND intake_events.occurred_at <= ?",
  ).bind(META_SOURCE, previousRunAt, runAt).first();
  const total = await db.prepare("SELECT COUNT(*) AS count FROM leads WHERE source = ?")
    .bind(META_SOURCE).first();
  const pending = await db.prepare(
    "SELECT COUNT(*) AS count FROM meta_webhook_events WHERE status IN ('pending', 'processing')",
  ).first();
  const failed = await db.prepare(
    "SELECT COUNT(*) AS count FROM meta_webhook_events " +
    "WHERE status = 'failed' AND updated_at > ? AND updated_at <= ?",
  ).bind(previousRunAt, runAt).first();
  const sheetFailed = await db.prepare(
    "SELECT COUNT(*) AS count FROM lead_deliveries JOIN leads ON leads.id = lead_deliveries.lead_id " +
    "WHERE leads.source = ? AND lead_deliveries.status = 'failed' " +
    "AND lead_deliveries.updated_at > ? AND lead_deliveries.updated_at <= ?",
  ).bind(META_SOURCE, previousRunAt, runAt).first();
  const latestFailure = Number(failed?.count)
    ? await db.prepare(
      "SELECT last_error FROM meta_webhook_events WHERE status = 'failed' " +
      "AND updated_at > ? AND updated_at <= ? ORDER BY updated_at DESC LIMIT 1",
    ).bind(previousRunAt, runAt).first("last_error")
    : "";
  const latestSheetFailure = Number(sheetFailed?.count)
    ? await db.prepare(
      "SELECT lead_deliveries.last_error FROM lead_deliveries " +
      "JOIN leads ON leads.id = lead_deliveries.lead_id " +
      "WHERE leads.source = ? AND lead_deliveries.status = 'failed' " +
      "AND lead_deliveries.updated_at > ? AND lead_deliveries.updated_at <= ? " +
      "ORDER BY lead_deliveries.updated_at DESC LIMIT 1",
    ).bind(META_SOURCE, previousRunAt, runAt).first("last_error")
    : "";

  const newLeadCount = Number(delivered?.count) || 0;
  const missingPhoneCount = Number(delivered?.missing_phone) || 0;
  const failedCount = Number(failed?.count) || 0;
  const sheetFailedCount = Number(sheetFailed?.count) || 0;
  const pendingCount = Number(pending?.count) || 0;
  const configured = metaWebhookConfigured(env);
  const status = configured && failedCount === 0 && sheetFailedCount === 0 ? "OK" : "ERROR";
  let details;
  if (!configured) {
    details = "Meta webhook configuration missing";
  } else if (failedCount) {
    details = "Meta API failure: " + (limitedText(latestFailure, 80) || "processing_failed");
  } else if (sheetFailedCount) {
    details = "Meta Sheet delivery failure: " +
      (limitedText(latestSheetFailure, 80) || "request_failed");
  } else if (newLeadCount) {
    details = "Meta webhook delivered " + newLeadCount + (newLeadCount === 1 ? " lead" : " leads");
    if (missingPhoneCount) details += "; " + missingPhoneCount + " missing phone from form";
  } else {
    details = "Meta webhook healthy; 0 new leads";
    if (pendingCount) details += "; " + pendingCount + " awaiting retry";
  }

  await sendRunLogToSheet(env, {
    runAt,
    status,
    leadCount: Number(total?.count) || 0,
    newLeadCount,
    durationMs: Math.max(0, Date.now() - startedAt),
    details,
    source: "Meta Lead API",
    schedule: "Event-driven + 2-minute health",
  });
  await db.prepare(
    "INSERT INTO automation_monitor_state (monitor_key, last_run_at, updated_at) VALUES (?, ?, ?) " +
    "ON CONFLICT(monitor_key) DO UPDATE SET last_run_at = excluded.last_run_at, updated_at = excluded.updated_at",
  ).bind(META_MONITOR_KEY, runAt, runAt).run();
}

export async function runMetaAutomationCycle(env) {
  const startedAt = Date.now();
  await processPendingMetaLeadEvents(env);
  await processPendingWebsiteSheetDeliveries(env);
  await publishMetaMonitorHeartbeat(env, startedAt);
}

export async function onMetaWebhookGet({ request, env }) {
  const configuredToken = limitedText(env.META_WEBHOOK_VERIFY_TOKEN, 256);
  if (configuredToken.length < 32) return textResponse("Webhook is not configured", 503);
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode") || "";
  const suppliedToken = url.searchParams.get("hub.verify_token") || "";
  const challenge = url.searchParams.get("hub.challenge") || "";
  if (mode !== "subscribe" || !constantTimeTextEqual(configuredToken, suppliedToken)
      || !challenge || challenge.length > 512) {
    return textResponse("Verification failed", 403);
  }
  return textResponse(challenge, 200);
}

export async function onMetaWebhookPost({ request, env, ctx }) {
  const appSecret = limitedText(env.META_APP_SECRET, 256);
  if (appSecret.length < 16) return jsonResponse({ ok: false, error: "not_configured" }, 503);
  if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) {
    return jsonResponse({ ok: false, error: "invalid_content_type" }, 415);
  }

  try {
    const rawBody = await readBodyBounded(request, META_WEBHOOK_MAX_BYTES);
    const signatureValid = await verifyMetaWebhookSignature(
      rawBody,
      request.headers.get("x-hub-signature-256") || "",
      appSecret,
    );
    if (!signatureValid) return jsonResponse({ ok: false, error: "invalid_signature" }, 401);

    let payload;
    try {
      payload = JSON.parse(new TextDecoder().decode(rawBody));
    } catch {
      return jsonResponse({ ok: false, error: "invalid_payload" }, 400);
    }
    const events = extractMetaLeadEvents(payload);
    if (!events.length) return jsonResponse({ ok: true, accepted: 0 });
    const inserted = await storeMetaWebhookEvents(env, events);
    if (ctx && typeof ctx.waitUntil === "function") {
      ctx.waitUntil(processPendingMetaLeadEvents(env, events.map((event) => event.id)));
    }
    return jsonResponse({ ok: true, accepted: events.length, inserted });
  } catch (error) {
    const code = safeMetaError(error);
    console.error(JSON.stringify({ event: "meta_webhook_intake_failed", error: code }));
    return jsonResponse({ ok: false, error: code }, code === "body_too_large" ? 413 : 503);
  }
}
