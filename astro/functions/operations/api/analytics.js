import { importPKCS8, SignJWT } from "jose";
import { json, requireOperationsAccess } from "./_lib/auth.js";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GA4_DATA_API_BASE = "https://analyticsdata.googleapis.com/v1beta/properties/";
const GA4_READ_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_SERVICE_ACCOUNT_JSON_BYTES = 32 * 1024;
const MAX_TOKEN_RESPONSE_BYTES = 32 * 1024;
const MAX_REPORT_RESPONSE_BYTES = 64 * 1024;
const MAX_COUNT = Number.MAX_SAFE_INTEGER;

// Session default channel groups are a controlled GA4 taxonomy. Deliberately
// avoid free-form campaign, referrer and UTM dimensions: those can contain
// customer or visitor-supplied text and do not belong in this staff summary.
const SAFE_CHANNEL_LABELS = new Set([
  "Direct",
  "Organic Search",
  "Organic Social",
  "Organic Video",
  "Organic Shopping",
  "Organic Other",
  "Paid Search",
  "Paid Social",
  "Paid Video",
  "Paid Shopping",
  "Paid Other",
  "Display",
  "Cross-network",
  "Email",
  "Affiliates",
  "Referral",
  "Audio",
  "SMS",
  "Mobile Push Notifications",
  "Video",
  "Unassigned",
  "(not set)",
]);

class AnalyticsUpstreamError extends Error {
  constructor(stage, status = null) {
    super(stage);
    this.stage = stage;
    this.status = Number.isInteger(status) && status >= 100 && status <= 599 ? status : null;
  }
}

function nonEmptyString(value, maximumLength = 4_096) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= maximumLength ? trimmed : null;
}

function configuredPropertyId(value) {
  const propertyId = nonEmptyString(value, 20);
  return propertyId && /^[1-9]\d{0,18}$/.test(propertyId) ? propertyId : null;
}

function configuredServiceAccount(value) {
  const raw = nonEmptyString(value, MAX_SERVICE_ACCOUNT_JSON_BYTES);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || parsed.type !== "service_account") return null;

    const clientEmail = nonEmptyString(parsed.client_email, 320);
    const privateKey = nonEmptyString(parsed.private_key, 16_384);
    const validServiceAccountEmail = clientEmail
      && /^[^@\s]+@[a-z0-9.-]+\.iam\.gserviceaccount\.com$/i.test(clientEmail);

    return validServiceAccountEmail && privateKey ? { clientEmail, privateKey } : null;
  } catch {
    return null;
  }
}

function analyticsConfig(env) {
  const propertyId = configuredPropertyId(env?.GA4_PROPERTY_ID);
  const serviceAccount = configuredServiceAccount(env?.GA4_SERVICE_ACCOUNT_JSON);
  return propertyId && serviceAccount ? { propertyId, serviceAccount } : null;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeCount(value) {
  const numeric = typeof value === "string" || typeof value === "number" ? Number(value) : Number.NaN;
  return Number.isSafeInteger(numeric) && numeric >= 0 && numeric <= MAX_COUNT ? numeric : 0;
}

function metricFromFirstRow(payload, metricIndex) {
  if (!isRecord(payload) || !Array.isArray(payload.rows) || !isRecord(payload.rows[0])) return 0;
  const metrics = payload.rows[0].metricValues;
  if (!Array.isArray(metrics) || !isRecord(metrics[metricIndex])) return 0;
  return safeCount(metrics[metricIndex].value);
}

async function parseLimitedJson(response, maximumBytes) {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    throw new AnalyticsUpstreamError("response_too_large", response.status);
  }

  if (!response.body) return null;

  const reader = response.body.getReader();
  const chunks = [];
  let byteLength = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      byteLength += value.byteLength;
      if (byteLength > maximumBytes) {
        await reader.cancel();
        throw new AnalyticsUpstreamError("response_too_large", response.status);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(merged));
  } catch {
    throw new AnalyticsUpstreamError("invalid_json", response.status);
  }
}

async function requestJson(url, init, stage, maximumBytes) {
  let response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch {
    throw new AnalyticsUpstreamError(stage);
  }

  let payload;
  try {
    payload = await parseLimitedJson(response, maximumBytes);
  } catch (error) {
    if (error instanceof AnalyticsUpstreamError) throw error;
    throw new AnalyticsUpstreamError(stage, response.status);
  }

  if (!response.ok) throw new AnalyticsUpstreamError(stage, response.status);
  return payload;
}

async function getAccessToken(config) {
  let privateKey;
  try {
    privateKey = await importPKCS8(config.serviceAccount.privateKey, "RS256");
  } catch {
    throw new AnalyticsUpstreamError("credentials_invalid");
  }

  const now = Math.floor(Date.now() / 1_000);
  let assertion;
  try {
    assertion = await new SignJWT({ scope: GA4_READ_SCOPE })
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setIssuer(config.serviceAccount.clientEmail)
      .setAudience(GOOGLE_TOKEN_URL)
      .setIssuedAt(now)
      .setExpirationTime(now + 3_000)
      .sign(privateKey);
  } catch {
    throw new AnalyticsUpstreamError("credentials_invalid");
  }

  const payload = await requestJson(
    GOOGLE_TOKEN_URL,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    },
    "token_request_failed",
    MAX_TOKEN_RESPONSE_BYTES,
  );

  const accessToken = isRecord(payload) ? nonEmptyString(payload.access_token, 4_096) : null;
  if (!accessToken) throw new AnalyticsUpstreamError("token_request_failed");
  return accessToken;
}

async function runReport(config, accessToken, reportRequest) {
  const payload = await requestJson(
    `${GA4_DATA_API_BASE}${config.propertyId}:runReport`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(reportRequest),
    },
    "report_request_failed",
    MAX_REPORT_RESPONSE_BYTES,
  );

  if (!isRecord(payload)) throw new AnalyticsUpstreamError("report_request_failed");
  return payload;
}

function trafficReport(dateRange) {
  return {
    dateRanges: [dateRange],
    metrics: [
      { name: "sessions" },
      { name: "activeUsers" },
      { name: "screenPageViews" },
    ],
  };
}

function generateLeadReport(dateRange) {
  return {
    dateRanges: [dateRange],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: {
      filter: {
        fieldName: "eventName",
        stringFilter: { matchType: "EXACT", value: "generate_lead", caseSensitive: true },
      },
    },
  };
}

function topChannelsReport() {
  return {
    dateRanges: [{ startDate: "6daysAgo", endDate: "today" }],
    dimensions: [{ name: "sessionDefaultChannelGroup" }],
    metrics: [{ name: "sessions" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: "10",
  };
}

function safeTraffic(payload, generateLeads) {
  return {
    sessions: metricFromFirstRow(payload, 0),
    activeUsers: metricFromFirstRow(payload, 1),
    pageViews: metricFromFirstRow(payload, 2),
    generateLeads,
  };
}

function safeTopSources(payload) {
  if (!isRecord(payload) || !Array.isArray(payload.rows)) return [];

  return payload.rows.slice(0, 10).flatMap((row) => {
    if (!isRecord(row) || !Array.isArray(row.dimensionValues) || !Array.isArray(row.metricValues)) {
      return [];
    }

    const label = isRecord(row.dimensionValues[0]) ? row.dimensionValues[0].value : null;
    const sessions = isRecord(row.metricValues[0]) ? safeCount(row.metricValues[0].value) : 0;
    return typeof label === "string" && SAFE_CHANNEL_LABELS.has(label) && sessions > 0
      ? [{ label, sessions }]
      : [];
  }).slice(0, 5);
}

/**
 * Fixed, aggregate-only GA4 reporting for the protected Operations portal.
 * The service-account credential is used only server-side and the route does
 * not accept query parameters, report definitions, property IDs or dimensions.
 */
export async function onRequestGet({ request, env }) {
  const access = await requireOperationsAccess(request, env);
  if (access.response) return access.response;

  const config = analyticsConfig(env);
  if (!config) {
    console.error(JSON.stringify({ event: "operations_analytics_not_configured" }));
    return json({ ok: false, error: "analytics_not_configured", analytics: null }, 503);
  }

  const today = { startDate: "today", endDate: "today" };
  const last7Days = { startDate: "6daysAgo", endDate: "today" };

  try {
    const accessToken = await getAccessToken(config);
    const [todayTraffic, last7DaysTraffic, todayLeads, last7DaysLeads, topChannels] = await Promise.all([
      runReport(config, accessToken, trafficReport(today)),
      runReport(config, accessToken, trafficReport(last7Days)),
      runReport(config, accessToken, generateLeadReport(today)),
      runReport(config, accessToken, generateLeadReport(last7Days)),
      runReport(config, accessToken, topChannelsReport()),
    ]);

    return json({
      ok: true,
      analytics: {
        today: safeTraffic(todayTraffic, metricFromFirstRow(todayLeads, 0)),
        last7Days: safeTraffic(last7DaysTraffic, metricFromFirstRow(last7DaysLeads, 0)),
        topSources: safeTopSources(topChannels),
      },
    });
  } catch (error) {
    const stage = error instanceof AnalyticsUpstreamError ? error.stage : "request_failed";
    const upstreamStatus = error instanceof AnalyticsUpstreamError ? error.status : null;
    console.error(JSON.stringify({
      event: "operations_analytics_unavailable",
      stage,
      upstreamStatus,
    }));
    return json({ ok: false, error: "analytics_unavailable", analytics: null }, 503);
  }
}
