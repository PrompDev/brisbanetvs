const MAX_FILES = 6;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_PUBLIC_REQUEST_BYTES = MAX_FILES * MAX_FILE_BYTES + 1024 * 1024;
const MAX_SYNC_REQUEST_BYTES = 512 * 1024;
const MAX_SYNC_BATCH = 100;
const SYNC_TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;
const SYNC_REPLAY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const BRISBANE_TIME_ZONE = "Australia/Brisbane";

const FIELD_LIMITS = Object.freeze({
  name: 160,
  email: 254,
  phone: 64,
  suburb: 120,
  postcode: 20,
  source: 64,
  platform: 96,
  externalId: 160,
  service: 160,
  tvSize: 80,
  wallType: 120,
  preferredDate: 100,
  message: 4000,
  pageUrl: 2048,
  campaign: 200,
  fileName: 255,
  contentType: 128,
  trackingValue: 512,
});

class InputError extends Error {
  constructor(message) {
    super(message);
    this.name = "InputError";
  }
}

class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthError";
  }
}

class ConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConflictError";
  }
}

class ServiceError extends Error {
  constructor(message) {
    super(message);
    this.name = "ServiceError";
  }
}

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
      ...extraHeaders,
    },
  });
}

function corsHeaders(request) {
  const origin = request.headers.get("Origin");
  const allowed = new Set([
    "https://brisbanetvs.com",
    "https://www.brisbanetvs.com",
    "https://brisbanetvs.pages.dev",
  ]);

  if (!origin || !allowed.has(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    vary: "Origin",
  };
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isUploadedFile(value) {
  return Boolean(value)
    && typeof value === "object"
    && typeof value.name === "string"
    && typeof value.size === "number"
    && typeof value.type === "string"
    && typeof value.stream === "function";
}

function boundedText(value, limit, label) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string" && typeof value !== "number") {
    throw new InputError("Invalid field: " + label);
  }

  const text = String(value).trim();
  if (text.length > limit) {
    throw new InputError(label + " is too long");
  }
  return text;
}

function pickText(record, names, limit, label) {
  for (const name of names) {
    if (!Object.prototype.hasOwnProperty.call(record, name)) continue;
    const value = boundedText(record[name], limit, label);
    if (value) return value;
  }
  return "";
}

function requireText(value, label) {
  if (!value) throw new InputError("Missing field: " + label);
  return value;
}

function normalizeEmail(value) {
  const email = boundedText(value, FIELD_LIMITS.email, "email").toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new InputError("Invalid email address");
  }
  return email;
}

function normalizePhoneForIdentity(phone) {
  let digits = phone.replace(/[^\d]/g, "");
  if (digits.startsWith("61") && digits.length >= 10) {
    digits = "0" + digits.slice(2);
  }
  return digits;
}

function normalizeSource(value, fallback) {
  const source = boundedText(value || fallback, FIELD_LIMITS.source, "source");
  if (!source) throw new InputError("Missing field: source");
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(source)) {
    throw new InputError("Invalid field: source");
  }
  return source;
}

function normalizeExternalId(value) {
  const externalId = boundedText(value, FIELD_LIMITS.externalId, "external_id");
  if (!externalId) throw new InputError("Missing field: external_id");
  return externalId;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeReceivedAt(value, fallbackToNow = false) {
  const text = boundedText(value, 64, "received_at");
  if (!text && fallbackToNow) return nowIso();
  if (!text) throw new InputError("Missing field: received_at");

  const receivedAt = new Date(text);
  if (Number.isNaN(receivedAt.getTime())) {
    throw new InputError("Invalid field: received_at");
  }
  return receivedAt.toISOString();
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

function serialiseTracking(raw, pageUrl) {
  const source = isRecord(raw.tracking) ? raw.tracking : {};
  const tracking = {};
  const keys = ["referrer", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];

  for (const key of keys) {
    const value = pickText(source, [key], FIELD_LIMITS.trackingValue, "tracking." + key);
    if (value) tracking[key] = value;
  }
  if (pageUrl) tracking.page_url = pageUrl;
  return JSON.stringify(tracking);
}

function serialiseDetails(values) {
  const details = {};
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) {
      if (value.length) details[key] = value;
      continue;
    }
    if (value) details[key] = value;
  }
  return JSON.stringify(details);
}

function boundedStringArray(value, maxItems, maxItemLength, label) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new InputError("Invalid field: " + label);
  if (value.length > maxItems) throw new InputError(label + " has too many values");

  return value
    .map((item) => boundedText(item, maxItemLength, label))
    .filter(Boolean);
}

function assertContentLength(request, maxBytes) {
  const header = request.headers.get("content-length");
  if (!header) return;

  const length = Number(header);
  if (!Number.isSafeInteger(length) || length < 0 || length > maxBytes) {
    throw new InputError("Submission is too large");
  }
}

async function readTextBounded(request, maxBytes) {
  assertContentLength(request, maxBytes);
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;

  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new InputError("Submission is too large");
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
  return new TextDecoder().decode(result);
}

async function parseJsonObject(request, maxBytes) {
  const raw = await readTextBounded(request, maxBytes);
  if (!raw) throw new InputError("Invalid submission body");

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new InputError("Invalid submission body");
  }

  if (!isRecord(parsed)) throw new InputError("Invalid submission body");
  return { raw, value: parsed };
}

async function parseWebsiteSubmission(request) {
  const contentType = request.headers.get("content-type") || "";
  const fields = {};
  const files = [];

  if (contentType.includes("multipart/form-data")) {
    assertContentLength(request, MAX_PUBLIC_REQUEST_BYTES);
    const form = await request.formData();
    for (const [key, value] of form.entries()) {
      if (isUploadedFile(value)) {
        if (!value.name || value.size === 0) continue;
        files.push(value);
      } else {
        fields[key] = value;
      }
    }
  } else if (contentType.includes("application/x-www-form-urlencoded")) {
    assertContentLength(request, MAX_PUBLIC_REQUEST_BYTES);
    const form = await request.formData();
    for (const [key, value] of form.entries()) fields[key] = value;
  } else if (contentType.includes("application/json")) {
    const body = await parseJsonObject(request, MAX_SYNC_REQUEST_BYTES);
    Object.assign(fields, body.value);
  } else {
    throw new InputError("Unsupported submission type");
  }

  return { fields, files };
}

function validateWebsiteSubmission(fields, files) {
  const name = pickText(fields, ["name", "fullname", "full_name"], FIELD_LIMITS.name, "name");
  const phone = pickText(fields, ["phone", "mobile"], FIELD_LIMITS.phone, "phone");
  const suburb = pickText(fields, ["suburb"], FIELD_LIMITS.suburb, "suburb");
  const service = pickText(fields, ["service"], FIELD_LIMITS.service, "service");
  const tvSize = pickText(fields, ["tv_size", "tvsize"], FIELD_LIMITS.tvSize, "tv_size");

  requireText(name, "name");
  requireText(phone, "phone");
  requireText(suburb, "suburb");
  requireText(service, "service");
  requireText(tvSize, "tv_size");
  normalizeEmail(pickText(fields, ["email"], FIELD_LIMITS.email, "email"));

  if (files.length > MAX_FILES) {
    throw new InputError("Too many images. Maximum is " + MAX_FILES + ".");
  }
  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      throw new InputError("Only image files can be uploaded.");
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new InputError("An uploaded image is too large. Maximum is 10 MB.");
    }
  }
}

function canonicalFromWebsite(fields) {
  const receivedAt = nowIso();
  const fullName = pickText(fields, ["name", "fullname", "full_name"], FIELD_LIMITS.name, "name");
  const email = normalizeEmail(pickText(fields, ["email"], FIELD_LIMITS.email, "email"));
  const phone = pickText(fields, ["phone", "mobile"], FIELD_LIMITS.phone, "phone");
  const suburb = pickText(fields, ["suburb"], FIELD_LIMITS.suburb, "suburb");
  const service = pickText(fields, ["service"], FIELD_LIMITS.service, "service");
  const tvSize = pickText(fields, ["tv_size", "tvsize"], FIELD_LIMITS.tvSize, "tv_size");
  const pageUrl = pickText(fields, ["page_url", "booking_link", "referrer"], FIELD_LIMITS.pageUrl, "page_url");
  const campaign = pickText(fields, ["campaign"], FIELD_LIMITS.campaign, "campaign");

  return {
    id: crypto.randomUUID(),
    source: "website",
    externalId: crypto.randomUUID(),
    receivedAt,
    receivedDay: brisbaneDay(receivedAt),
    fullName,
    email,
    phone,
    postcode: pickText(fields, ["postcode"], FIELD_LIMITS.postcode, "postcode"),
    platform: pickText(fields, ["platform"], FIELD_LIMITS.platform, "platform") || "website-form",
    tvSize,
    suburb,
    service,
    wallType: pickText(fields, ["wall", "wall_type"], FIELD_LIMITS.wallType, "wall"),
    preferredDate: pickText(fields, ["preferred_date", "date"], FIELD_LIMITS.preferredDate, "preferred_date"),
    message: pickText(fields, ["message", "details"], FIELD_LIMITS.message, "message"),
    pageUrl,
    campaign,
    trackingJson: JSON.stringify({
      ...(pageUrl ? { page_url: pageUrl } : {}),
      ...(campaign ? { campaign } : {}),
    }),
    detailsJson: serialiseDetails({ intake: "website-form" }),
    marketingConsent: 0,
  };
}

function canonicalFromN8n(body) {
  const lead = isRecord(body.lead) ? body.lead : {};
  const job = isRecord(body.job) ? body.job : {};
  const tracking = isRecord(body.tracking) ? body.tracking : {};
  const receivedAt = nowIso();
  const fullName = pickText(lead, ["name", "full_name", "fullname"], FIELD_LIMITS.name, "name")
    || pickText(body, ["name", "full_name", "fullname"], FIELD_LIMITS.name, "name");
  const email = normalizeEmail(
    pickText(lead, ["email"], FIELD_LIMITS.email, "email")
      || pickText(body, ["email"], FIELD_LIMITS.email, "email"),
  );
  const phone = pickText(lead, ["phone", "mobile"], FIELD_LIMITS.phone, "phone")
    || pickText(body, ["phone", "mobile"], FIELD_LIMITS.phone, "phone");
  const pageUrl = pickText(body, ["page_url"], FIELD_LIMITS.pageUrl, "page_url");
  const campaign = pickText(tracking, ["utm_campaign"], FIELD_LIMITS.campaign, "tracking.utm_campaign");
  const packageName = pickText(job, ["package_label", "package"], FIELD_LIMITS.service, "job.package");
  const addons = boundedStringArray(job.addons, 20, 80, "job.addons");

  if (!email && !phone) {
    throw new InputError("Please provide an email address or phone number.");
  }

  return {
    id: crypto.randomUUID(),
    source: "website",
    externalId: crypto.randomUUID(),
    receivedAt,
    receivedDay: brisbaneDay(receivedAt),
    fullName,
    email,
    phone,
    postcode: pickText(lead, ["postcode"], FIELD_LIMITS.postcode, "postcode"),
    platform: pickText(body, ["source"], FIELD_LIMITS.platform, "source") || "website",
    tvSize: pickText(job, ["tv_size", "tvSize"], FIELD_LIMITS.tvSize, "job.tv_size"),
    suburb: pickText(lead, ["suburb"], FIELD_LIMITS.suburb, "suburb"),
    service: packageName,
    wallType: pickText(job, ["wall_type", "wallType"], FIELD_LIMITS.wallType, "job.wall_type"),
    preferredDate: pickText(job, ["preferred_date", "preferredDay"], FIELD_LIMITS.preferredDate, "job.preferred_date"),
    message: pickText(job, ["notes", "message"], FIELD_LIMITS.message, "job.notes"),
    pageUrl,
    campaign,
    trackingJson: serialiseTracking(body, pageUrl),
    detailsJson: serialiseDetails({
      package: pickText(job, ["package"], FIELD_LIMITS.service, "job.package"),
      tv_brand: pickText(job, ["tv_brand", "tvBrand"], FIELD_LIMITS.name, "job.tv_brand"),
      addons,
      photos_attached_count: Array.isArray(job.photos_attached)
        ? Math.min(job.photos_attached.length, MAX_FILES)
        : 0,
      quote_contact_consent: body.consent === "yes" || body.consent === true ? 1 : 0,
    }),
    marketingConsent: 0,
  };
}

function canonicalFromSync(record) {
  if (!isRecord(record)) throw new InputError("Each lead must be an object");

  const receivedAt = normalizeReceivedAt(record.received_at, false);
  const source = normalizeSource(
    pickText(record, ["source"], FIELD_LIMITS.source, "source") || "google_apps_script",
    "google_apps_script",
  );
  const pageUrl = pickText(record, ["page_url"], FIELD_LIMITS.pageUrl, "page_url");
  const campaign = pickText(record, ["campaign"], FIELD_LIMITS.campaign, "campaign");

  return {
    id: crypto.randomUUID(),
    source,
    externalId: normalizeExternalId(pickText(record, ["external_id"], FIELD_LIMITS.externalId, "external_id")),
    receivedAt,
    receivedDay: brisbaneDay(receivedAt),
    fullName: pickText(record, ["full_name", "name", "fullname"], FIELD_LIMITS.name, "full_name"),
    email: normalizeEmail(pickText(record, ["email"], FIELD_LIMITS.email, "email")),
    phone: pickText(record, ["phone", "mobile"], FIELD_LIMITS.phone, "phone"),
    postcode: pickText(record, ["postcode"], FIELD_LIMITS.postcode, "postcode"),
    platform: pickText(record, ["platform"], FIELD_LIMITS.platform, "platform") || "google-apps-script",
    tvSize: pickText(record, ["tv_size", "tvsize"], FIELD_LIMITS.tvSize, "tv_size"),
    suburb: pickText(record, ["suburb"], FIELD_LIMITS.suburb, "suburb"),
    service: pickText(record, ["service"], FIELD_LIMITS.service, "service"),
    wallType: pickText(record, ["wall_type", "wall"], FIELD_LIMITS.wallType, "wall_type"),
    preferredDate: pickText(record, ["preferred_date"], FIELD_LIMITS.preferredDate, "preferred_date"),
    message: pickText(record, ["message", "notes"], FIELD_LIMITS.message, "message"),
    pageUrl,
    campaign,
    trackingJson: serialiseTracking(record, pageUrl),
    detailsJson: serialiseDetails({ intake: "apps-script-sync" }),
    marketingConsent: 0,
  };
}

function requireOperationsDb(env) {
  if (!env.OPERATIONS_DB) {
    throw new ServiceError("Lead storage is not configured");
  }
  return env.OPERATIONS_DB;
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const bytes = new Uint8Array(digest);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function contactIdentityKey(lead) {
  if (lead.email) {
    return "sha256:" + await sha256Hex("email\u0000" + lead.email.toLowerCase());
  }

  const normalizedPhone = normalizePhoneForIdentity(lead.phone);
  if (normalizedPhone) {
    return "sha256:" + await sha256Hex("phone\u0000" + normalizedPhone);
  }

  return "sha256:" + await sha256Hex("lead\u0000" + lead.source + "\u0000" + lead.externalId);
}

async function buildLeadWriteStatements(db, lead, event) {
  const identityKey = await contactIdentityKey(lead);
  const contactId = crypto.randomUUID();
  const eventId = crypto.randomUUID();
  const updatedAt = event.occurredAt;

  const contactStatement = db.prepare(
    "INSERT INTO contacts (" +
      "id, identity_key, full_name, email, phone, postcode, suburb, created_at, updated_at" +
    ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) " +
    "ON CONFLICT(identity_key) DO UPDATE SET " +
      "full_name = CASE WHEN excluded.full_name <> '' THEN excluded.full_name ELSE contacts.full_name END, " +
      "email = CASE WHEN excluded.email <> '' THEN excluded.email ELSE contacts.email END, " +
      "phone = CASE WHEN excluded.phone <> '' THEN excluded.phone ELSE contacts.phone END, " +
      "postcode = CASE WHEN excluded.postcode <> '' THEN excluded.postcode ELSE contacts.postcode END, " +
      "suburb = CASE WHEN excluded.suburb <> '' THEN excluded.suburb ELSE contacts.suburb END, " +
      "updated_at = excluded.updated_at",
  ).bind(
    contactId,
    identityKey,
    lead.fullName,
    lead.email,
    lead.phone,
    lead.postcode,
    lead.suburb,
    updatedAt,
    updatedAt,
  );

  const leadStatement = db.prepare(
    "INSERT INTO leads (" +
      "id, contact_id, source, external_id, received_at, received_day, " +
      "full_name, email, phone, postcode, platform, tv_size, suburb, service, wall_type, " +
      "preferred_date, message, page_url, campaign, tracking_json, details_json, marketing_consent, " +
      "created_at, updated_at" +
    ") VALUES (?, (SELECT id FROM contacts WHERE identity_key = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
    "ON CONFLICT(source, external_id) DO UPDATE SET " +
      "contact_id = excluded.contact_id, " +
      "received_at = excluded.received_at, " +
      "received_day = excluded.received_day, " +
      "full_name = CASE WHEN excluded.full_name <> '' THEN excluded.full_name ELSE leads.full_name END, " +
      "email = CASE WHEN excluded.email <> '' THEN excluded.email ELSE leads.email END, " +
      "phone = CASE WHEN excluded.phone <> '' THEN excluded.phone ELSE leads.phone END, " +
      "postcode = CASE WHEN excluded.postcode <> '' THEN excluded.postcode ELSE leads.postcode END, " +
      "platform = CASE WHEN excluded.platform <> '' THEN excluded.platform ELSE leads.platform END, " +
      "tv_size = CASE WHEN excluded.tv_size <> '' THEN excluded.tv_size ELSE leads.tv_size END, " +
      "suburb = CASE WHEN excluded.suburb <> '' THEN excluded.suburb ELSE leads.suburb END, " +
      "service = CASE WHEN excluded.service <> '' THEN excluded.service ELSE leads.service END, " +
      "wall_type = CASE WHEN excluded.wall_type <> '' THEN excluded.wall_type ELSE leads.wall_type END, " +
      "preferred_date = CASE WHEN excluded.preferred_date <> '' THEN excluded.preferred_date ELSE leads.preferred_date END, " +
      "message = CASE WHEN excluded.message <> '' THEN excluded.message ELSE leads.message END, " +
      "page_url = CASE WHEN excluded.page_url <> '' THEN excluded.page_url ELSE leads.page_url END, " +
      "campaign = CASE WHEN excluded.campaign <> '' THEN excluded.campaign ELSE leads.campaign END, " +
      "tracking_json = excluded.tracking_json, " +
      "details_json = excluded.details_json, " +
      "marketing_consent = CASE WHEN excluded.marketing_consent = 1 THEN 1 ELSE leads.marketing_consent END, " +
      "updated_at = excluded.updated_at",
  ).bind(
    lead.id,
    identityKey,
    lead.source,
    lead.externalId,
    lead.receivedAt,
    lead.receivedDay,
    lead.fullName,
    lead.email,
    lead.phone,
    lead.postcode,
    lead.platform,
    lead.tvSize,
    lead.suburb,
    lead.service,
    lead.wallType,
    lead.preferredDate,
    lead.message,
    lead.pageUrl,
    lead.campaign,
    lead.trackingJson,
    lead.detailsJson,
    lead.marketingConsent,
    updatedAt,
    updatedAt,
  );

  const eventStatement = db.prepare(
    "INSERT INTO intake_events (" +
      "id, lead_id, event_type, channel, request_id, occurred_at, details_json" +
    ") VALUES (?, (SELECT id FROM leads WHERE source = ? AND external_id = ?), ?, ?, ?, ?, ?)",
  ).bind(
    eventId,
    lead.source,
    lead.externalId,
    event.type,
    event.channel,
    event.requestId || "",
    event.occurredAt,
    event.detailsJson,
  );

  return [contactStatement, leadStatement, eventStatement];
}

async function persistCanonicalLeads(env, leads, event) {
  const db = requireOperationsDb(env);
  const statements = (
    await Promise.all(leads.map((lead) => buildLeadWriteStatements(db, lead, event)))
  ).flat();

  const results = await db.batch(statements);
  if (results.length !== statements.length || results.some((result) => !result.success)) {
    throw new ServiceError("Lead storage failed");
  }
}

async function persistCanonicalLead(env, lead, event) {
  await persistCanonicalLeads(env, [lead], event);
  const db = requireOperationsDb(env);
  const storedId = await db
    .prepare("SELECT id FROM leads WHERE source = ? AND external_id = ?")
    .bind(lead.source, lead.externalId)
    .first("id");
  return storedId || lead.id;
}

function fileExt(file) {
  const byType = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
  };
  if (byType[file.type]) return byType[file.type];

  const name = typeof file.name === "string" ? file.name : "";
  const extension = name.split(".").pop();
  if (extension && extension !== name) {
    const safe = extension.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (safe) return safe.slice(0, 12);
  }
  return "bin";
}

async function persistUploads(env, leadId, files) {
  if (!files.length) return 0;
  if (!env.LEAD_UPLOADS) throw new ServiceError("Lead uploads are not configured");

  const db = requireOperationsDb(env);
  const records = [];

  try {
    for (const file of files) {
      const uploadId = crypto.randomUUID();
      const objectKey = "website-leads/" + leadId + "/" + uploadId + "." + fileExt(file);
      const contentType = boundedText(file.type || "application/octet-stream", FIELD_LIMITS.contentType, "file content type")
        || "application/octet-stream";

      await env.LEAD_UPLOADS.put(objectKey, file.stream(), {
        httpMetadata: { contentType },
      });

      records.push({
        id: uploadId,
        objectKey,
        originalName: boundedText(file.name, FIELD_LIMITS.fileName, "file name") || "upload",
        contentType,
        sizeBytes: file.size,
      });
    }

    const storedAt = nowIso();
    const statements = records.map((record) =>
      db.prepare(
        "INSERT INTO lead_uploads (id, lead_id, object_key, original_name, content_type, size_bytes, created_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
      ).bind(
        record.id,
        leadId,
        record.objectKey,
        record.originalName,
        record.contentType,
        record.sizeBytes,
        storedAt,
      ),
    );

    statements.push(
      db.prepare(
        "INSERT INTO intake_events (id, lead_id, event_type, channel, request_id, occurred_at, details_json) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
      ).bind(
        crypto.randomUUID(),
        leadId,
        "uploads_stored",
        "website",
        "",
        storedAt,
        JSON.stringify({ count: records.length }),
      ),
    );

    const results = await db.batch(statements);
    if (results.length !== statements.length || results.some((result) => !result.success)) {
      throw new ServiceError("Lead upload storage failed");
    }

    return records.length;
  } catch (error) {
    if (records.length) {
      try {
        await env.LEAD_UPLOADS.delete(records.map((record) => record.objectKey));
      } catch {
        console.error(JSON.stringify({
          event: "lead_upload_cleanup_failed",
          lead_id: leadId,
          upload_count: records.length,
        }));
      }
    }
    throw error;
  }
}

function honeypotField(body) {
  for (const field of ["_bts_check", "company_website", "honeypot", "hp"]) {
    const value = body[field];
    if ((typeof value === "string" || typeof value === "number") && String(value).trim()) {
      return field;
    }
  }
  return null;
}

function bytesFromHex(hex) {
  if (!/^[a-f0-9]{64}$/i.test(hex)) return null;
  const bytes = new Uint8Array(32);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

async function hmacSha256(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
}

async function authenticateSyncRequest(request, env) {
  const secret = env.LEAD_SYNC_SECRET;
  if (!secret) throw new ServiceError("Lead sync is not configured");
  if (!(request.headers.get("content-type") || "").includes("application/json")) {
    throw new InputError("Lead sync requires JSON");
  }

  const timestamp = boundedText(
    request.headers.get("x-lead-sync-timestamp"),
    16,
    "x-lead-sync-timestamp",
  );
  const idempotencyKey = boundedText(
    request.headers.get("x-lead-sync-id"),
    128,
    "x-lead-sync-id",
  );
  const signature = boundedText(
    request.headers.get("x-lead-sync-signature"),
    128,
    "x-lead-sync-signature",
  ).toLowerCase();

  if (!/^\d{10}$/.test(timestamp)) throw new AuthError("Invalid sync timestamp");
  if (!/^[a-zA-Z0-9._:-]{16,128}$/.test(idempotencyKey)) {
    throw new AuthError("Invalid sync id");
  }

  const timestampSeconds = Number(timestamp);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > SYNC_TIMESTAMP_TOLERANCE_SECONDS) {
    throw new AuthError("Expired sync timestamp");
  }

  const suppliedSignature = bytesFromHex(signature);
  if (!suppliedSignature) throw new AuthError("Invalid sync signature");

  const raw = await readTextBounded(request, MAX_SYNC_REQUEST_BYTES);
  const expectedSignature = await hmacSha256(secret, timestamp + "." + idempotencyKey + "." + raw);
  if (!crypto.subtle.timingSafeEqual(new Uint8Array(expectedSignature), suppliedSignature)) {
    throw new AuthError("Invalid sync signature");
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new InputError("Invalid lead sync body");
  }
  if (!isRecord(body) || !Array.isArray(body.leads)) {
    throw new InputError("Lead sync body must include a leads array");
  }
  if (!body.leads.length || body.leads.length > MAX_SYNC_BATCH) {
    throw new InputError("Lead sync must include between 1 and " + MAX_SYNC_BATCH + " leads");
  }

  return {
    body,
    idempotencyKey,
    requestHash: await sha256Hex(raw),
  };
}

async function claimSyncRequest(env, idempotencyKey, requestHash, receivedAt) {
  const db = requireOperationsDb(env);
  await db
    .prepare("DELETE FROM sync_requests WHERE idempotency_key = ? AND expires_at < ?")
    .bind(idempotencyKey, receivedAt)
    .run();

  const existing = await db
    .prepare(
      "SELECT id, request_hash, status, accepted_count, completed_count, failed_count " +
      "FROM sync_requests WHERE idempotency_key = ?",
    )
    .bind(idempotencyKey)
    .first();

  if (existing) {
    if (existing.request_hash !== requestHash) {
      throw new ConflictError("Idempotency key was already used for a different payload");
    }
    if (existing.status === "completed") {
      return {
        id: existing.id,
        replayed: true,
        acceptedCount: existing.accepted_count,
        completedCount: existing.completed_count,
      };
    }
    if (existing.status === "processing") {
      throw new ConflictError("Lead sync is already being processed");
    }

    const retry = await db
      .prepare(
        "UPDATE sync_requests SET status = 'processing', failed_count = 0, " +
        "received_at = ?, completed_at = NULL, expires_at = ? " +
        "WHERE id = ? AND status = 'failed'",
      )
      .bind(
        receivedAt,
        new Date(new Date(receivedAt).getTime() + SYNC_REPLAY_RETENTION_MS).toISOString(),
        existing.id,
      )
      .run();
    if (retry.meta.changes !== 1) {
      throw new ConflictError("Lead sync is already being processed");
    }
    return { id: existing.id, replayed: false };
  }

  const requestId = crypto.randomUUID();
  const insert = await db
    .prepare(
      "INSERT INTO sync_requests (" +
        "id, idempotency_key, request_hash, status, received_at, expires_at" +
      ") VALUES (?, ?, ?, 'processing', ?, ?) " +
      "ON CONFLICT(idempotency_key) DO NOTHING",
    )
    .bind(
      requestId,
      idempotencyKey,
      requestHash,
      receivedAt,
      new Date(new Date(receivedAt).getTime() + SYNC_REPLAY_RETENTION_MS).toISOString(),
    )
    .run();

  if (insert.meta.changes === 1) return { id: requestId, replayed: false };
  return claimSyncRequest(env, idempotencyKey, requestHash, receivedAt);
}

async function markSyncRequest(env, requestId, status, acceptedCount, completedCount, failedCount) {
  const db = requireOperationsDb(env);
  await db
    .prepare(
      "UPDATE sync_requests SET status = ?, accepted_count = ?, completed_count = ?, " +
      "failed_count = ?, completed_at = ? WHERE id = ?",
    )
    .bind(status, acceptedCount, completedCount, failedCount, nowIso(), requestId)
    .run();
}

function publicErrorResponse(error, headers, stage) {
  if (error instanceof InputError) {
    return jsonResponse({ error: error.message }, 400, headers);
  }
  if (error instanceof ServiceError) {
    console.error(JSON.stringify({ event: "lead_intake_unavailable" }));
    return jsonResponse({ error: "Lead intake is temporarily unavailable" }, 503, headers);
  }

  console.error(JSON.stringify({
    event: "lead_intake_failed",
    stage: stage || "unknown",
    error_type: error instanceof Error ? error.name : "unknown",
  }));
  return jsonResponse({ error: "Could not save your request. Please try again." }, 502, headers);
}

function syncErrorResponse(error) {
  if (error instanceof InputError) {
    return jsonResponse({ ok: false, error: "invalid_request" }, 400);
  }
  if (error instanceof AuthError) {
    return jsonResponse({ ok: false, error: "authentication_failed" }, 401);
  }
  if (error instanceof ConflictError) {
    return jsonResponse({ ok: false, error: "idempotency_conflict" }, 409);
  }
  if (error instanceof ServiceError) {
    console.error(JSON.stringify({ event: "lead_sync_unavailable" }));
    return jsonResponse({ ok: false, error: "sync_unavailable" }, 503);
  }

  console.error(JSON.stringify({ event: "lead_sync_failed" }));
  return jsonResponse({ ok: false, error: "sync_failed" }, 502);
}

export async function onRequestOptions({ request }) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request),
  });
}

export async function onRequestPost({ request, env }) {
  const headers = corsHeaders(request);
  let stage = "parse";

  try {
    const submission = await parseWebsiteSubmission(request);
    const tripped = honeypotField(submission.fields);
    if (tripped) {
      return jsonResponse({ ok: true, filtered: "honeypot", tripped }, 200, headers);
    }
    stage = "validate";
    validateWebsiteSubmission(submission.fields, submission.files);
    stage = "canonicalize";
    const lead = canonicalFromWebsite(submission.fields);
    stage = "persist_lead";
    const leadId = await persistCanonicalLead(env, lead, {
      type: "lead_received",
      channel: "website",
      occurredAt: nowIso(),
      requestId: "",
      detailsJson: JSON.stringify({ uploads: submission.files.length }),
    });
    stage = "persist_uploads";
    const uploadCount = await persistUploads(env, leadId, submission.files);

    return jsonResponse({
      ok: true,
      lead_id: leadId,
      uploaded_images: uploadCount,
    }, 201, headers);
  } catch (error) {
    return publicErrorResponse(error, headers, stage);
  }
}

export async function onN8nLeadPost({ request, env }) {
  const headers = corsHeaders(request);
  let stage = "parse";

  try {
    const body = (await parseJsonObject(request, MAX_SYNC_REQUEST_BYTES)).value;
    const tripped = honeypotField(body);
    if (tripped) {
      return jsonResponse({ ok: true, filtered: "honeypot", tripped }, 200, headers);
    }

    stage = "canonicalize";
    const lead = canonicalFromN8n(body);
    stage = "persist_lead";
    const leadId = await persistCanonicalLead(env, lead, {
      type: "lead_received",
      channel: "website-json",
      occurredAt: nowIso(),
      requestId: "",
      detailsJson: JSON.stringify({ endpoint: "api/n8n/lead" }),
    });

    return jsonResponse({ ok: true, lead_id: leadId }, 200, headers);
  } catch (error) {
    return publicErrorResponse(error, headers, stage);
  }
}

export async function onLeadSyncPost({ request, env }) {
  try {
    const authenticated = await authenticateSyncRequest(request, env);
    const receivedAt = nowIso();
    const claimed = await claimSyncRequest(
      env,
      authenticated.idempotencyKey,
      authenticated.requestHash,
      receivedAt,
    );

    if (claimed.replayed) {
      return jsonResponse({
        ok: true,
        replayed: true,
        accepted: claimed.acceptedCount,
        completed: claimed.completedCount,
      });
    }

    const leads = authenticated.body.leads.map(canonicalFromSync);
    try {
      await persistCanonicalLeads(env, leads, {
        type: "lead_synced",
        channel: "apps-script",
        occurredAt: nowIso(),
        requestId: claimed.id,
        detailsJson: JSON.stringify({ batch_size: leads.length }),
      });
      await markSyncRequest(env, claimed.id, "completed", leads.length, leads.length, 0);
    } catch (error) {
      try {
        await markSyncRequest(env, claimed.id, "failed", leads.length, 0, leads.length);
      } catch {
        console.error(JSON.stringify({ event: "lead_sync_failure_not_recorded" }));
      }
      throw error;
    }

    return jsonResponse({
      ok: true,
      replayed: false,
      accepted: leads.length,
      completed: leads.length,
    });
  } catch (error) {
    return syncErrorResponse(error);
  }
}
