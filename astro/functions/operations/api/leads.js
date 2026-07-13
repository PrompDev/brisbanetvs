import { hasOperationsDatabase, json, requireOperationsAccess } from "./_lib/auth.js";
import { brisbaneDay, brisbaneDayDaysAgo } from "./_lib/dates.js";

const MAX_LIMIT = 100;
const MAX_OFFSET = 1000;
const MAX_QUERY_LENGTH = 80;

function boundedInteger(value, fallback, maximum) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isInteger(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, maximum);
}

function requestedRange(value) {
  return ["today", "7d", "all"].includes(value) ? value : "today";
}

function searchTerm(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_QUERY_LENGTH);
}

function escapeLike(value) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function parsedRecord(value) {
  try {
    const parsed = JSON.parse(String(value || "{}"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function safeText(value, maximum = 4_096) {
  return String(value == null ? "" : value).trim().slice(0, maximum);
}

function safeStringArray(value, maximumItems = 20, maximumLength = 80) {
  return Array.isArray(value)
    ? value.slice(0, maximumItems).map((item) => safeText(item, maximumLength)).filter(Boolean)
    : [];
}

function recordedConsent(details, key, fallbackValue) {
  if (Object.prototype.hasOwnProperty.call(details, key)) {
    return Number(details[key]) === 1;
  }
  return Number(fallbackValue) === 1 ? true : null;
}

function toLead(row) {
  const details = parsedRecord(row.details_json);
  const tracking = parsedRecord(row.tracking_json);
  return {
    id: safeText(row.id, 160),
    externalId: safeText(row.external_id, 160),
    name: safeText(row.full_name, 160),
    email: safeText(row.email, 254),
    phone: safeText(row.phone, 64),
    postcode: safeText(row.postcode, 20),
    suburb: safeText(row.suburb, 120),
    source: safeText(row.platform || row.source || "Other", 96),
    tvSize: safeText(row.tv_size, 80),
    service: safeText(row.service, 160),
    wallType: safeText(row.wall_type, 120),
    preferredDate: safeText(row.preferred_date, 100),
    message: safeText(row.message, 4_000),
    pageUrl: safeText(row.page_url, 2_048),
    campaign: safeText(row.campaign || tracking.utm_campaign, 200),
    formSource: safeText(details.form_source || details.intake, 96),
    packageId: safeText(details.package, 160),
    tvCount: safeText(details.tv_count, 2),
    tvBrand: safeText(details.tv_brand, 160),
    addons: safeStringArray(details.addons),
    photoCount: Math.max(0, Math.min(6, Number(row.photo_count) || 0)),
    photoAttachmentCount: Math.max(0, Math.min(6, Number(details.photos_attached_count) || 0)),
    quoteContactConsent: recordedConsent(details, "quote_contact_consent", null),
    marketingConsent: recordedConsent(details, "marketing_consent", row.marketing_consent),
    attribution: {
      source: safeText(tracking.utm_source, 200),
      medium: safeText(tracking.utm_medium, 200),
      campaignId: safeText(tracking.utm_id, 160),
      term: safeText(tracking.utm_term, 200),
      content: safeText(tracking.utm_content, 200),
      landingPage: safeText(tracking.landing_page, 512),
      referrer: safeText(tracking.referrer, 512),
    },
    status: safeText(row.status || "new", 64),
    receivedAt: safeText(row.received_at, 64),
  };
}

export async function onRequestGet({ request, env }) {
  const access = await requireOperationsAccess(request, env);
  if (access.response) return access.response;
  if (!hasOperationsDatabase(env)) {
    console.error(JSON.stringify({ event: "operations_leads_database_not_configured" }));
    return json({ ok: false, error: "lead_store_unavailable" }, 503);
  }

  const url = new URL(request.url);
  const range = requestedRange(url.searchParams.get("range"));
  const limit = Math.max(1, boundedInteger(url.searchParams.get("limit"), 50, MAX_LIMIT));
  const offset = boundedInteger(url.searchParams.get("offset"), 0, MAX_OFFSET);
  const query = searchTerm(url.searchParams.get("q"));
  const where = [];
  const values = [];
  const now = new Date();

  if (range === "today") {
    where.push("received_day = ?");
    values.push(brisbaneDay(now));
  } else if (range === "7d") {
    where.push("received_day >= ? AND received_day <= ?");
    values.push(brisbaneDayDaysAgo(6, now), brisbaneDay(now));
  }

  if (query) {
    const pattern = `%${escapeLike(query)}%`;
    where.push(
      "(full_name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\' OR postcode LIKE ? ESCAPE '\\' OR id LIKE ? ESCAPE '\\' OR external_id LIKE ? ESCAPE '\\' OR suburb LIKE ? ESCAPE '\\' OR service LIKE ? ESCAPE '\\')",
    );
    values.push(pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern);
  }

  const whereClause = where.length ? ` WHERE ${where.join(" AND ")}` : "";
  const listSql = `SELECT id, external_id, full_name, email, phone, postcode, suburb, source, platform, ` +
    `tv_size, service, wall_type, preferred_date, message, page_url, campaign, tracking_json, ` +
    `details_json, marketing_consent, status, received_at, ` +
    `(SELECT COUNT(*) FROM lead_uploads WHERE lead_uploads.lead_id = leads.id) AS photo_count ` +
    `FROM leads${whereClause} ORDER BY received_at DESC, id DESC LIMIT ? OFFSET ?`;
  const countSql = `SELECT COUNT(*) AS count FROM leads${whereClause}`;

  try {
    const [listResult, countRow] = await Promise.all([
      env.OPERATIONS_DB.prepare(listSql).bind(...values, limit, offset).all(),
      env.OPERATIONS_DB.prepare(countSql).bind(...values).first(),
    ]);
    const total = Number(countRow?.count) || 0;

    return json({
      ok: true,
      range,
      query: query || "",
      total: Number.isSafeInteger(total) && total >= 0 ? total : 0,
      offset,
      limit,
      leads: (listResult.results || []).map(toLead),
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: "operations_leads_query_failed",
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    }));
    return json({ ok: false, error: "lead_store_unavailable" }, 503);
  }
}
