import { importPKCS8, SignJWT } from "jose";
import { hasOperationsDatabase, json, requireOperationsAccess } from "./_lib/auth.js";
import { brisbaneDay, brisbaneDayDaysAgo } from "./_lib/dates.js";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GA4_DATA_API_BASE = "https://analyticsdata.googleapis.com/v1beta/properties/";
const SEARCH_CONSOLE_API_BASE = "https://www.googleapis.com/webmasters/v3/sites/";
const GOOGLE_READ_SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/webmasters.readonly",
].join(" ");
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_SERVICE_ACCOUNT_JSON_BYTES = 32 * 1024;
const MAX_TOKEN_RESPONSE_BYTES = 32 * 1024;
const MAX_REPORT_RESPONSE_BYTES = 64 * 1024;
const MAX_SEARCH_CONSOLE_RESPONSE_BYTES = 64 * 1024;
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

function configuredSearchConsoleSiteUrl(value) {
  const siteUrl = nonEmptyString(value, 512);
  if (!siteUrl) return null;
  if (siteUrl === "sc-domain:brisbanetvs.com") return siteUrl;

  try {
    const url = new URL(siteUrl);
    const allowedHost = url.hostname === "brisbanetvs.com" || url.hostname === "www.brisbanetvs.com";
    return url.protocol === "https:"
      && allowedHost
      && url.pathname === "/"
      && !url.username
      && !url.password
      && !url.search
      && !url.hash
      ? siteUrl
      : null;
  } catch {
    return null;
  }
}

function analyticsConfig(env) {
  const propertyId = configuredPropertyId(env?.GA4_PROPERTY_ID);
  const serviceAccount = configuredServiceAccount(env?.GA4_SERVICE_ACCOUNT_JSON);
  return propertyId && serviceAccount
    ? { propertyId, serviceAccount, searchConsoleSiteUrl: configuredSearchConsoleSiteUrl(env?.SEARCH_CONSOLE_SITE_URL) }
    : null;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeCount(value) {
  const numeric = typeof value === "string" || typeof value === "number" ? Number(value) : Number.NaN;
  return Number.isSafeInteger(numeric) && numeric >= 0 && numeric <= MAX_COUNT ? numeric : 0;
}

function safeDecimal(value) {
  const numeric = typeof value === "string" || typeof value === "number" ? Number(value) : Number.NaN;
  return Number.isFinite(numeric) && numeric >= 0 && numeric <= MAX_COUNT ? numeric : 0;
}

function metricFromFirstRow(payload, metricIndex, parseValue = safeCount) {
  if (!isRecord(payload) || !Array.isArray(payload.rows) || !isRecord(payload.rows[0])) return 0;
  const metrics = payload.rows[0].metricValues;
  if (!Array.isArray(metrics) || !isRecord(metrics[metricIndex])) return 0;
  return parseValue(metrics[metricIndex].value);
}

function metricFromRow(row, metricIndex, parseValue = safeCount) {
  if (!isRecord(row) || !Array.isArray(row.metricValues) || !isRecord(row.metricValues[metricIndex])) return 0;
  return parseValue(row.metricValues[metricIndex].value);
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
    assertion = await new SignJWT({ scope: GOOGLE_READ_SCOPES })
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

async function runSearchConsoleReport(config, accessToken, reportRequest) {
  if (!config.searchConsoleSiteUrl) throw new AnalyticsUpstreamError("search_console_not_configured");

  const payload = await requestJson(
    `${SEARCH_CONSOLE_API_BASE}${encodeURIComponent(config.searchConsoleSiteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(reportRequest),
    },
    "search_console_request_failed",
    MAX_SEARCH_CONSOLE_RESPONSE_BYTES,
  );

  if (!isRecord(payload)) throw new AnalyticsUpstreamError("search_console_request_failed");
  return payload;
}

function trafficReport(dateRange) {
  return {
    dateRanges: [dateRange],
    metrics: [
      { name: "sessions" },
      { name: "activeUsers" },
      { name: "screenPageViews" },
      { name: "averageSessionDuration" },
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

function topPagesReport(dateRange) {
  return {
    dateRanges: [dateRange],
    dimensions: [{ name: "unifiedPagePathScreen" }],
    metrics: [{ name: "screenPageViews" }, { name: "userEngagementDuration" }],
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    limit: "20",
  };
}

function searchConsoleQueryReport() {
  return {
    startDate: dateInPacificTime(30),
    endDate: dateInPacificTime(3),
    dimensions: ["query", "page"],
    type: "web",
    dataState: "final",
    rowLimit: 10,
  };
}

function dateInPacificTime(daysAgo) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1_000));
  const value = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function safeTraffic(payload, generateLeads) {
  return {
    sessions: metricFromFirstRow(payload, 0),
    activeUsers: metricFromFirstRow(payload, 1),
    pageViews: metricFromFirstRow(payload, 2),
    averageSessionDuration: metricFromFirstRow(payload, 3, safeDecimal),
    generateLeads,
  };
}

function safePagePath(value) {
  const path = nonEmptyString(value, 512);
  return path && path.startsWith("/") && !/[?#\r\n]/.test(path) ? path : null;
}

function safeTopPages(currentPayload, previousPayload) {
  const previousViews = new Map();
  const previousRows = isRecord(previousPayload) && Array.isArray(previousPayload.rows) ? previousPayload.rows : [];
  previousRows.forEach((row) => {
    const path = isRecord(row?.dimensionValues?.[0]) ? safePagePath(row.dimensionValues[0].value) : null;
    if (path) previousViews.set(path, metricFromRow(row, 0));
  });

  const currentRows = isRecord(currentPayload) && Array.isArray(currentPayload.rows) ? currentPayload.rows : [];
  return currentRows.slice(0, 20).flatMap((row) => {
    const path = isRecord(row?.dimensionValues?.[0]) ? safePagePath(row.dimensionValues[0].value) : null;
    const pageViews = metricFromRow(row, 0);
    const engagementSeconds = metricFromRow(row, 1, safeDecimal);
    if (!path || pageViews < 1) return [];

    return [{
      path,
      pageViews,
      averageEngagementSeconds: engagementSeconds / pageViews,
      changeFromPreviousWeek: pageViews - (previousViews.get(path) || 0),
    }];
  }).slice(0, 5);
}

function safeSearchQuery(value) {
  const query = nonEmptyString(value, 120);
  return query
    && !/[\r\n\t@]/.test(query)
    && !/https?:|www\.|\d{7,}/i.test(query)
    && /^[\p{L}\p{N}\s&'’.,+()\-/]+$/u.test(query)
    ? query
    : null;
}

function safeSearchQueries(payload) {
  if (!isRecord(payload) || !Array.isArray(payload.rows)) return [];

  return payload.rows.slice(0, 10).flatMap((row) => {
    const query = Array.isArray(row?.keys) ? safeSearchQuery(row.keys[0]) : null;
    const page = Array.isArray(row?.keys) ? safeSearchPage(row.keys[1]) : null;
    const clicks = safeCount(row?.clicks);
    const impressions = safeCount(row?.impressions);
    if (!query || !page || (clicks < 1 && impressions < 1)) return [];
    return [{ query, page, clicks, impressions, position: safeDecimal(row?.position) }];
  });
}

function safeSearchPage(value) {
  const pageUrl = nonEmptyString(value, 1_024);
  if (!pageUrl) return null;

  try {
    const url = new URL(pageUrl);
    const allowedHost = url.hostname === "brisbanetvs.com" || url.hostname === "www.brisbanetvs.com";
    return url.protocol === "https:" && allowedHost && !url.search && !url.hash ? url.pathname : null;
  } catch {
    return null;
  }
}

async function searchConsoleSummary(config, accessToken) {
  if (!config.searchConsoleSiteUrl) return { status: "not_configured", queries: [] };

  try {
    const report = await runSearchConsoleReport(config, accessToken, searchConsoleQueryReport());
    return { status: "ready", queries: safeSearchQueries(report) };
  } catch (error) {
    const stage = error instanceof AnalyticsUpstreamError ? error.stage : "request_failed";
    const upstreamStatus = error instanceof AnalyticsUpstreamError ? error.status : null;
    console.error(JSON.stringify({ event: "operations_search_console_unavailable", stage, upstreamStatus }));
    return { status: "unavailable", queries: [] };
  }
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

function operationalSourceLabel(value) {
  const text = String(value || "").toLowerCase();
  if (text === "ig" || text.includes("instagram")) return "Instagram";
  if (text === "fb" || text.includes("facebook")) return "Facebook";
  if (text.includes("meta")) return "Meta (unattributed)";
  if (text.includes("google")) return "Google";
  if (
    text.includes("website")
    || text.includes("web")
    || text.includes("quote")
    || text.includes("footer")
  ) return "Website";
  return "Other";
}

function aggregateOperationalSources(rows) {
  const order = ["Facebook", "Instagram", "Meta (unattributed)", "Website", "Google", "Other"];
  const counts = new Map(order.map((label) => [label, 0]));
  for (const row of rows || []) {
    const label = operationalSourceLabel(row.value);
    counts.set(label, (counts.get(label) || 0) + safeCount(row.count));
  }
  return order
    .map((label) => ({ label, leads: counts.get(label) || 0 }))
    .filter((item) => item.leads > 0);
}

function safeCampaignLabel(value) {
  const label = nonEmptyString(value, 100);
  return label
    && !/[@\r\n\t]|https?:|www\.|\d{7,}/i.test(label)
    && /^[\p{L}\p{N}\s&'’.,+()\-_/]+$/u.test(label)
    ? label
    : null;
}

function safeOperationalPage(value) {
  const pageUrl = nonEmptyString(value, 1_024);
  if (!pageUrl) return null;
  try {
    const url = new URL(pageUrl);
    const allowedHost = url.hostname === "brisbanetvs.com" || url.hostname === "www.brisbanetvs.com";
    return url.protocol === "https:" && allowedHost ? safePagePath(url.pathname) : null;
  } catch {
    return safePagePath(pageUrl);
  }
}

function aggregateSafeLabels(rows, labelFor, countKey) {
  const counts = new Map();
  for (const row of rows || []) {
    const label = labelFor(row.value);
    if (!label) continue;
    counts.set(label, (counts.get(label) || 0) + safeCount(row.count));
  }
  return Array.from(counts, ([label, count]) => ({ label, [countKey]: count }))
    .sort((left, right) => right[countKey] - left[countKey] || left.label.localeCompare(right.label))
    .slice(0, 5);
}

async function operationalLeadSignals(env) {
  if (!hasOperationsDatabase(env)) {
    return {
      status: "not_configured",
      today: 0,
      last7Days: 0,
      websiteLast7Days: 0,
      bySource: [],
      topCampaigns: [],
      topLandingPages: [],
      sheetDelivery: { delivered: 0, pending: 0, failed: 0, missing: 0 },
    };
  }

  const now = new Date();
  const today = brisbaneDay(now);
  const weekStart = brisbaneDayDaysAgo(6, now);

  try {
    const [todayRow, weekRow, websiteRow, sourceResult, campaignResult, pageResult, deliveryResult, missingDeliveryRow] = await Promise.all([
      env.OPERATIONS_DB.prepare("SELECT COUNT(*) AS count FROM leads WHERE received_day = ?")
        .bind(today)
        .first(),
      env.OPERATIONS_DB.prepare(
        "SELECT COUNT(*) AS count FROM leads WHERE received_day >= ? AND received_day <= ?",
      ).bind(weekStart, today).first(),
      env.OPERATIONS_DB.prepare(
        "SELECT COUNT(*) AS count FROM leads WHERE source = 'website' AND received_day >= ? AND received_day <= ?",
      ).bind(weekStart, today).first(),
      env.OPERATIONS_DB.prepare(
        "SELECT platform AS value, COUNT(*) AS count FROM leads " +
        "WHERE received_day >= ? AND received_day <= ? GROUP BY platform LIMIT 30",
      ).bind(weekStart, today).all(),
      env.OPERATIONS_DB.prepare(
        "SELECT campaign AS value, COUNT(*) AS count FROM leads " +
        "WHERE received_day >= ? AND received_day <= ? AND campaign <> '' " +
        "GROUP BY campaign ORDER BY count DESC LIMIT 20",
      ).bind(weekStart, today).all(),
      env.OPERATIONS_DB.prepare(
        "SELECT value, COUNT(*) AS count FROM (" +
          "SELECT CASE WHEN json_valid(tracking_json) " +
            "THEN COALESCE(NULLIF(CAST(json_extract(tracking_json, '$.landing_page') AS TEXT), ''), page_url) " +
            "ELSE page_url END AS value FROM leads " +
          "WHERE source = 'website' AND received_day >= ? AND received_day <= ?" +
        ") WHERE value <> '' GROUP BY value ORDER BY count DESC LIMIT 20",
      ).bind(weekStart, today).all(),
      env.OPERATIONS_DB.prepare(
        "SELECT status AS value, COUNT(*) AS count FROM lead_deliveries " +
        "WHERE destination = 'google_sheet' GROUP BY status LIMIT 10",
      ).all(),
      env.OPERATIONS_DB.prepare(
        "SELECT COUNT(*) AS count FROM leads " +
        "LEFT JOIN lead_deliveries ON lead_deliveries.lead_id = leads.id " +
          "AND lead_deliveries.destination = 'google_sheet' " +
        "WHERE leads.source = 'website' AND lead_deliveries.id IS NULL",
      ).first(),
    ]);

    const delivery = { delivered: 0, pending: 0, failed: 0, missing: safeCount(missingDeliveryRow?.count) };
    for (const row of deliveryResult.results || []) {
      const status = String(row.value || "");
      const count = safeCount(row.count);
      if (status === "delivered") delivery.delivered += count;
      else if (status === "failed") delivery.failed += count;
      else if (status === "pending" || status === "processing") delivery.pending += count;
    }

    return {
      status: "ready",
      today: safeCount(todayRow?.count),
      last7Days: safeCount(weekRow?.count),
      websiteLast7Days: safeCount(websiteRow?.count),
      bySource: aggregateOperationalSources(sourceResult.results),
      topCampaigns: aggregateSafeLabels(campaignResult.results, safeCampaignLabel, "leads"),
      topLandingPages: aggregateSafeLabels(pageResult.results, safeOperationalPage, "leads"),
      sheetDelivery: delivery,
    };
  } catch (error) {
    console.error(JSON.stringify({
      event: "operations_lead_signals_unavailable",
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    }));
    return {
      status: "unavailable",
      today: 0,
      last7Days: 0,
      websiteLast7Days: 0,
      bySource: [],
      topCampaigns: [],
      topLandingPages: [],
      sheetDelivery: { delivered: 0, pending: 0, failed: 0, missing: 0 },
    };
  }
}

function analyticsWithoutGa(gaStatus, searchStatus, leadSignals) {
  return {
    gaStatus,
    today: null,
    last7Days: null,
    topSources: [],
    topPages: [],
    searchConsole: { status: searchStatus, queries: [] },
    leadSignals,
  };
}

/**
 * Fixed, aggregate-only GA4 reporting for the protected Operations portal.
 * The service-account credential is used only server-side and the route does
 * not accept query parameters, report definitions, property IDs or dimensions.
 */
export async function onRequestGet({ request, env }) {
  const access = await requireOperationsAccess(request, env);
  if (access.response) return access.response;

  const leadSignals = await operationalLeadSignals(env);
  const config = analyticsConfig(env);
  if (!config) {
    console.error(JSON.stringify({ event: "operations_analytics_not_configured" }));
    return json({
      ok: true,
      analytics: analyticsWithoutGa("not_configured", "not_configured", leadSignals),
    });
  }

  const today = { startDate: "today", endDate: "today" };
  const last7Days = { startDate: "6daysAgo", endDate: "today" };
  const previous7Days = { startDate: "13daysAgo", endDate: "7daysAgo" };

  try {
    const accessToken = await getAccessToken(config);
    const [todayTraffic, last7DaysTraffic, todayLeads, last7DaysLeads, topChannels, topPages, previousTopPages, searchConsole] = await Promise.all([
      runReport(config, accessToken, trafficReport(today)),
      runReport(config, accessToken, trafficReport(last7Days)),
      runReport(config, accessToken, generateLeadReport(today)),
      runReport(config, accessToken, generateLeadReport(last7Days)),
      runReport(config, accessToken, topChannelsReport()),
      runReport(config, accessToken, topPagesReport(last7Days)),
      runReport(config, accessToken, topPagesReport(previous7Days)),
      searchConsoleSummary(config, accessToken),
    ]);

    return json({
      ok: true,
      analytics: {
        gaStatus: "ready",
        today: safeTraffic(todayTraffic, metricFromFirstRow(todayLeads, 0)),
        last7Days: safeTraffic(last7DaysTraffic, metricFromFirstRow(last7DaysLeads, 0)),
        topSources: safeTopSources(topChannels),
        topPages: safeTopPages(topPages, previousTopPages),
        searchConsole,
        leadSignals,
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
    return json({
      ok: true,
      analytics: analyticsWithoutGa("unavailable", "unavailable", leadSignals),
    });
  }
}
