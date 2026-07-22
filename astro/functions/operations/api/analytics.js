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
const MAX_REPORT_RESPONSE_BYTES = 128 * 1024;
const MAX_SEARCH_CONSOLE_RESPONSE_BYTES = 256 * 1024;
const MAX_COUNT = Number.MAX_SAFE_INTEGER;
const SEARCH_CONSOLE_LAG_DAYS = 3;
const STABLE_WINDOW_DAYS = 28;
const OPERATIONS_PATH = "/operations/";

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

function safeRate(value) {
  const numeric = safeDecimal(value);
  return numeric >= 0 && numeric <= 1 ? numeric : 0;
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

async function runRealtimeReport(config, accessToken, reportRequest) {
  const payload = await requestJson(
    `${GA4_DATA_API_BASE}${config.propertyId}:runRealtimeReport`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(reportRequest),
    },
    "realtime_report_request_failed",
    MAX_REPORT_RESPONSE_BYTES,
  );

  if (!isRecord(payload)) throw new AnalyticsUpstreamError("realtime_report_request_failed");
  return payload;
}

async function realtimeSummary(config, accessToken) {
  try {
    const payload = await runRealtimeReport(config, accessToken, {
      metrics: [{ name: "activeUsers" }],
    });
    return {
      status: "ready",
      activeUsersLast30Minutes: metricFromFirstRow(payload, 0),
      windowMinutes: 30,
    };
  } catch (error) {
    console.error(JSON.stringify({
      event: "operations_analytics_realtime_unavailable",
      stage: error instanceof AnalyticsUpstreamError ? error.stage : "request_failed",
      upstreamStatus: error instanceof AnalyticsUpstreamError ? error.status : null,
    }));
    return {
      status: "unavailable",
      activeUsersLast30Minutes: null,
      windowMinutes: 30,
    };
  }
}

function trafficReport(dateRange) {
  return {
    dateRanges: [dateRange],
    metrics: [
      { name: "sessions" },
      { name: "activeUsers" },
      { name: "screenPageViews" },
      { name: "averageSessionDuration" },
      { name: "engagedSessions" },
      { name: "engagementRate" },
      { name: "screenPageViewsPerSession" },
    ],
    dimensionFilter: publicLandingPageFilter(),
  };
}

function publicLandingPageFilter() {
  return {
    notExpression: {
      filter: {
        fieldName: "landingPage",
        stringFilter: { matchType: "BEGINS_WITH", value: OPERATIONS_PATH, caseSensitive: false },
      },
    },
  };
}

function publicEventFilter(eventName) {
  return {
    andGroup: {
      expressions: [
        {
          filter: {
            fieldName: "eventName",
            stringFilter: { matchType: "EXACT", value: eventName, caseSensitive: true },
          },
        },
        publicLandingPageFilter(),
      ],
    },
  };
}

function generateLeadReport(dateRange) {
  return {
    dateRanges: [dateRange],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: publicEventFilter("generate_lead"),
  };
}

function topChannelsReport(dateRange) {
  return {
    dateRanges: [dateRange],
    dimensions: [{ name: "sessionDefaultChannelGroup" }],
    metrics: [{ name: "sessions" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: "10",
    dimensionFilter: publicLandingPageFilter(),
  };
}

function landingPagesReport(dateRange) {
  return {
    dateRanges: [dateRange],
    dimensions: [{ name: "landingPage" }],
    metrics: [
      { name: "sessions" },
      { name: "engagedSessions" },
      { name: "engagementRate" },
      { name: "screenPageViews" },
      { name: "screenPageViewsPerSession" },
      { name: "userEngagementDuration" },
    ],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: "50",
    dimensionFilter: publicLandingPageFilter(),
  };
}

function dailySessionsReport(dateRange) {
  return {
    dateRanges: [dateRange],
    dimensions: [{ name: "date" }],
    metrics: [
      { name: "sessions" },
      { name: "engagedSessions" },
      { name: "screenPageViews" },
    ],
    orderBys: [{ dimension: { dimensionName: "date" }, desc: false }],
    limit: "60",
    dimensionFilter: publicLandingPageFilter(),
  };
}

function sessionStartReport(dateRange) {
  return {
    dateRanges: [dateRange],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: publicEventFilter("session_start"),
  };
}

function searchConsoleReport(dimensions, startDaysAgo, endDaysAgo, rowLimit) {
  const report = {
    startDate: dateInPacificTime(startDaysAgo),
    endDate: dateInPacificTime(endDaysAgo),
    type: "web",
    dataState: "final",
    rowLimit,
  };
  if (dimensions.length) report.dimensions = dimensions;
  return report;
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
    engagedSessions: metricFromFirstRow(payload, 4),
    engagementRate: metricFromFirstRow(payload, 5, safeRate),
    viewsPerSession: metricFromFirstRow(payload, 6, safeDecimal),
    generateLeads,
  };
}

function safePagePath(value) {
  const path = nonEmptyString(value, 512);
  if (!path || !path.startsWith("/") || /[?#\r\n]/.test(path)) return null;
  return path === "/" ? "/" : `${path.replace(/\/+$/, "")}/`;
}

function safePublicPagePath(value) {
  const path = safePagePath(value);
  return path && path !== OPERATIONS_PATH && !path.startsWith(OPERATIONS_PATH) ? path : null;
}

function safeLandingPages(payload) {
  const rows = isRecord(payload) && Array.isArray(payload.rows) ? payload.rows : [];
  return rows.slice(0, 50).flatMap((row) => {
    const path = isRecord(row?.dimensionValues?.[0]) ? safePublicPagePath(row.dimensionValues[0].value) : null;
    const sessions = metricFromRow(row, 0);
    if (!path || sessions < 1) return [];

    const engagementSeconds = metricFromRow(row, 5, safeDecimal);
    return [{
      path,
      sessions,
      engagedSessions: metricFromRow(row, 1),
      engagementRate: metricFromRow(row, 2, safeRate),
      pageViews: metricFromRow(row, 3),
      viewsPerSession: metricFromRow(row, 4, safeDecimal),
      averageEngagementSeconds: engagementSeconds / sessions,
    }];
  }).slice(0, 20);
}

function safeDailySessions(payload) {
  const rows = isRecord(payload) && Array.isArray(payload.rows) ? payload.rows : [];
  return rows.slice(0, 60).flatMap((row) => {
    const rawDate = isRecord(row?.dimensionValues?.[0]) ? nonEmptyString(row.dimensionValues[0].value, 8) : null;
    if (!rawDate || !/^\d{8}$/.test(rawDate)) return [];
    return [{
      date: `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`,
      sessions: metricFromRow(row, 0),
      engagedSessions: metricFromRow(row, 1),
      pageViews: metricFromRow(row, 2),
    }];
  });
}

function sessionDiagnostics(traffic, sessionStartEvents, dailySessions) {
  const sessions = safeCount(traffic?.sessions);
  const startEvents = safeCount(sessionStartEvents);
  const difference = sessions - startEvents;
  const daysWithSessions = dailySessions.filter((day) => safeCount(day.sessions) > 0).length;
  const status = sessions === 0
    ? "no_consent_data"
    : Math.abs(difference) <= 1
      ? "aligned"
      : "processing_difference";

  return {
    status,
    sessions,
    sessionStartEvents: startEvents,
    difference,
    daysWithSessions,
    daysReported: dailySessions.length,
  };
}

function safeSearchQuery(value) {
  const query = nonEmptyString(value, 120);
  return query
    && !/[\r\n\t@]/.test(query)
    && !/https?:|www\.|\d{7,}/i.test(query)
    && (query.match(/\d/g) || []).length < 7
    && /^[\p{L}\p{N}\s&'’.,+()\-/]+$/u.test(query)
    ? query
    : null;
}

function safeSearchPage(value) {
  const pageUrl = nonEmptyString(value, 1_024);
  if (!pageUrl) return null;

  try {
    const url = new URL(pageUrl);
    const allowedHost = url.hostname === "brisbanetvs.com" || url.hostname === "www.brisbanetvs.com";
    return url.protocol === "https:" && allowedHost && !url.search && !url.hash ? safePublicPagePath(url.pathname) : null;
  } catch {
    return null;
  }
}

async function optionalReport(config, accessToken, reportRequest, reportName) {
  try {
    return { status: "ready", payload: await runReport(config, accessToken, reportRequest) };
  } catch (error) {
    console.error(JSON.stringify({
      event: "operations_analytics_optional_report_unavailable",
      report: reportName,
      stage: error instanceof AnalyticsUpstreamError ? error.stage : "request_failed",
      upstreamStatus: error instanceof AnalyticsUpstreamError ? error.status : null,
    }));
    return { status: "unavailable", payload: { rows: [] } };
  }
}

function safeSearchPageRows(payload) {
  if (!isRecord(payload) || !Array.isArray(payload.rows)) return [];

  const rows = payload.rows.slice(0, 250).flatMap((row) => {
    const path = Array.isArray(row?.keys) ? safeSearchPage(row.keys[0]) : null;
    const clicks = safeCount(row?.clicks);
    const impressions = safeCount(row?.impressions);
    if (!path || (clicks < 1 && impressions < 1)) return [];
    return [{
      path,
      clicks,
      impressions,
      ctr: safeRate(row?.ctr),
      position: safeDecimal(row?.position),
    }];
  });
  const byPath = new Map();
  for (const row of rows) {
    const current = byPath.get(row.path) || { path: row.path, clicks: 0, impressions: 0, weightedPosition: 0 };
    current.clicks += row.clicks;
    current.impressions += row.impressions;
    current.weightedPosition += row.position * row.impressions;
    byPath.set(row.path, current);
  }
  return Array.from(byPath.values(), (row) => ({
    path: row.path,
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.impressions > 0 ? row.clicks / row.impressions : 0,
    position: row.impressions > 0 ? row.weightedPosition / row.impressions : 0,
  }));
}

function safeSearchQueryRows(payload) {
  if (!isRecord(payload) || !Array.isArray(payload.rows)) return [];

  const rows = payload.rows.slice(0, 250).flatMap((row) => {
    const query = Array.isArray(row?.keys) ? safeSearchQuery(row.keys[0]) : null;
    const path = Array.isArray(row?.keys) ? safeSearchPage(row.keys[1]) : null;
    const clicks = safeCount(row?.clicks);
    const impressions = safeCount(row?.impressions);
    if (!query || !path || (clicks < 1 && impressions < 1)) return [];
    return [{
      query,
      path,
      clicks,
      impressions,
      ctr: safeRate(row?.ctr),
      position: safeDecimal(row?.position),
    }];
  });
  const combined = new Map();
  for (const row of rows) {
    const key = `${row.path}\u0000${row.query}`;
    const current = combined.get(key) || { query: row.query, path: row.path, clicks: 0, impressions: 0, weightedPosition: 0 };
    current.clicks += row.clicks;
    current.impressions += row.impressions;
    current.weightedPosition += row.position * row.impressions;
    combined.set(key, current);
  }
  return Array.from(combined.values(), (row) => ({
    query: row.query,
    path: row.path,
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.impressions > 0 ? row.clicks / row.impressions : 0,
    position: row.impressions > 0 ? row.weightedPosition / row.impressions : 0,
  }));
}

function safeSearchAggregate(payload) {
  const row = isRecord(payload) && Array.isArray(payload.rows) ? payload.rows[0] : null;
  if (!isRecord(row)) return { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  return {
    clicks: safeCount(row.clicks),
    impressions: safeCount(row.impressions),
    ctr: safeRate(row.ctr),
    position: safeDecimal(row.position),
  };
}

function searchTotals(rows) {
  const totals = rows.reduce((result, row) => {
    result.clicks += safeCount(row.clicks);
    result.impressions += safeCount(row.impressions);
    result.weightedPosition += safeDecimal(row.position) * safeCount(row.impressions);
    return result;
  }, { clicks: 0, impressions: 0, weightedPosition: 0 });

  return {
    clicks: totals.clicks,
    impressions: totals.impressions,
    ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : 0,
    position: totals.impressions > 0 ? totals.weightedPosition / totals.impressions : 0,
  };
}

function sourceForPublicPage(path) {
  if (path === "/") {
    return {
      file: "astro/public/index.html",
      label: "Homepage source",
      confidence: "exact",
    };
  }

  const contentPage = String(path || "").match(/^\/(locations|blog|services|products|mounts)\/([a-z0-9-]+)\/$/);
  if (contentPage) {
    const contentLabel = contentPage[1] === "blog"
      ? "Blog post"
      : `${contentPage[1].slice(0, -1)} content`;
    return {
      file: `astro/src/content/${contentPage[1]}/${contentPage[2]}.md`,
      label: `${contentLabel} source`,
      confidence: "exact",
    };
  }

  const collectionIndex = String(path || "").match(/^\/(locations|blog|services|products|mounts)\/$/);
  if (collectionIndex) {
    return {
      file: `astro/src/pages/${collectionIndex[1]}/index.astro`,
      label: `${collectionIndex[1]} index source`,
      confidence: "exact",
    };
  }

  const directPage = String(path || "").match(/^\/(quote|pricing)\/$/);
  if (directPage) {
    return {
      file: `astro/src/pages/${directPage[1]}.astro`,
      label: `${directPage[1]} page source`,
      confidence: "exact",
    };
  }

  return {
    file: null,
    label: "Trace this public route before editing",
    confidence: "trace",
    hint: "Find the route under astro/src/pages, astro/src/content or astro/public and confirm the live page before changing it.",
  };
}

function guidanceForOpportunity(type) {
  if (type === "snippet_gap") {
    return {
      hypothesis: "The page is visible close enough to compete, but its search title or description may not answer the visible queries strongly enough to earn the click.",
      successCheck: "Keep the change if clicks and click-through rate rise in the next complete 28-day window without a material loss of impressions.",
    };
  }
  if (type === "near_page_one") {
    return {
      hypothesis: "Google sees the page as relevant, but the page may need more complete query coverage and stronger internal links to move into the highest-visibility results.",
      successCheck: "Keep the change if average position improves for the top queries and clicks rise without impressions collapsing.",
    };
  }
  if (type === "low_ctr") {
    return {
      hypothesis: "The result is being seen, but its search snippet may be less specific or useful than the results around it.",
      successCheck: "Keep the change if click-through rate and clicks rise in the next complete 28-day window while impressions remain comparable.",
    };
  }
  if (type === "growing_visibility") {
    return {
      hypothesis: "Demand or relevance is rising; improving the sections already aligned with visible queries may turn that momentum into stronger rankings and more visits.",
      successCheck: "Keep the change if impressions continue rising and either clicks increase or average position improves in the next complete 28-day window.",
    };
  }
  return {
    hypothesis: "The sample is still too small or mixed to support a confident SEO change.",
    successCheck: "Wait for more final data. Do not change this page solely because of this card.",
  };
}

function opportunityForPage(page) {
  let type = "monitor";
  let label = "Monitor";
  let recommendation = "Keep watching this page as more search data arrives.";

  if (page.impressions >= 8 && page.clicks === 0 && page.position > 0 && page.position <= 15) {
    type = "snippet_gap";
    label = "Shown, not clicked";
    recommendation = "Review the title and search description so they answer the visible queries more clearly.";
  } else if (page.impressions >= 3 && page.position > 3 && page.position <= 12) {
    type = "near_page_one";
    label = "Within reach";
    recommendation = "Strengthen the page around its top queries and add useful internal links from related pages.";
  } else if (page.impressions >= 10 && page.ctr < 0.02) {
    type = "low_ctr";
    label = "Low click rate";
    recommendation = "Compare the search snippet with competing results and make the title more specific to the query.";
  } else if (page.impressionChange > 0) {
    type = "growing_visibility";
    label = "Growing visibility";
    recommendation = "Review the page's visible queries and strengthen the sections that already match them.";
  }

  const positionWeight = page.position > 0 && page.position <= 20 ? 1 : 0.5;
  const score = page.impressions * Math.max(0.05, 1 - page.ctr) * positionWeight
    + Math.max(0, page.impressionChange);
  return {
    type,
    label,
    recommendation,
    ...guidanceForOpportunity(type),
    source: sourceForPublicPage(page.path),
    reviewRule: "Publish one focused change, record the date, then compare the first complete 28 days after publication with this baseline once Search Console data is final.",
    score,
  };
}

function searchPageInsights(currentPayload, previousPayload, queryPayload, currentAggregatePayload = null, previousAggregatePayload = null) {
  const currentRows = safeSearchPageRows(currentPayload);
  const previousRows = safeSearchPageRows(previousPayload);
  const queryRows = safeSearchQueryRows(queryPayload);
  const previousByPath = new Map(previousRows.map((row) => [row.path, row]));
  const queriesByPath = new Map();

  for (const row of queryRows) {
    const pageQueries = queriesByPath.get(row.path) || [];
    pageQueries.push(row);
    queriesByPath.set(row.path, pageQueries);
  }

  const pages = currentRows.map((row) => {
    const previous = previousByPath.get(row.path) || { clicks: 0, impressions: 0, ctr: 0, position: 0 };
    const page = {
      ...row,
      previousClicks: previous.clicks,
      previousImpressions: previous.impressions,
      clickChange: row.clicks - previous.clicks,
      impressionChange: row.impressions - previous.impressions,
      ctrChange: row.ctr - previous.ctr,
      positionChange: previous.position > 0 && row.position > 0 ? previous.position - row.position : 0,
      topQueries: (queriesByPath.get(row.path) || [])
        .sort((left, right) => right.impressions - left.impressions || right.clicks - left.clicks)
        .slice(0, 5)
        .map(({ query, clicks, impressions, ctr, position }) => ({ query, clicks, impressions, ctr, position })),
    };
    return { ...page, opportunity: opportunityForPage(page) };
  });

  const totals = currentAggregatePayload ? safeSearchAggregate(currentAggregatePayload) : searchTotals(currentRows);
  const previousTotals = previousAggregatePayload ? safeSearchAggregate(previousAggregatePayload) : searchTotals(previousRows);
  const changes = {
    clicks: totals.clicks - previousTotals.clicks,
    impressions: totals.impressions - previousTotals.impressions,
    ctr: totals.ctr - previousTotals.ctr,
    position: previousTotals.position > 0 && totals.position > 0
      ? previousTotals.position - totals.position
      : 0,
  };
  const opportunities = [...pages]
    .sort((left, right) => right.opportunity.score - left.opportunity.score)
    .slice(0, 30);

  return {
    totals,
    previousTotals,
    changes,
    pages: pages.slice(0, 50),
    opportunities,
    queries: [...queryRows]
      .sort((left, right) => right.impressions - left.impressions || right.clicks - left.clicks)
      .slice(0, 10),
  };
}

function emptySearchConsole(status) {
  return {
    status,
    window: {
      startDate: dateInPacificTime(30),
      endDate: dateInPacificTime(SEARCH_CONSOLE_LAG_DAYS),
      lagDays: SEARCH_CONSOLE_LAG_DAYS,
    },
    previousWindow: {
      startDate: dateInPacificTime(58),
      endDate: dateInPacificTime(31),
    },
    totals: { clicks: 0, impressions: 0, ctr: 0, position: 0 },
    previousTotals: { clicks: 0, impressions: 0, ctr: 0, position: 0 },
    changes: { clicks: 0, impressions: 0, ctr: 0, position: 0 },
    pages: [],
    opportunities: [],
    queries: [],
  };
}

async function searchConsoleSummary(config, accessToken) {
  if (!config.searchConsoleSiteUrl) return emptySearchConsole("not_configured");

  try {
    const currentPageRequest = searchConsoleReport(["page"], 30, SEARCH_CONSOLE_LAG_DAYS, 250);
    const previousPageRequest = searchConsoleReport(["page"], 58, 31, 250);
    const queryPageRequest = searchConsoleReport(["query", "page"], 30, SEARCH_CONSOLE_LAG_DAYS, 250);
    const currentTotalRequest = searchConsoleReport([], 30, SEARCH_CONSOLE_LAG_DAYS, 1);
    const previousTotalRequest = searchConsoleReport([], 58, 31, 1);
    const [currentPages, previousPages, queryPages, currentTotal, previousTotal] = await Promise.all([
      runSearchConsoleReport(config, accessToken, currentPageRequest),
      runSearchConsoleReport(config, accessToken, previousPageRequest),
      runSearchConsoleReport(config, accessToken, queryPageRequest),
      runSearchConsoleReport(config, accessToken, currentTotalRequest),
      runSearchConsoleReport(config, accessToken, previousTotalRequest),
    ]);
    return {
      status: "ready",
      window: {
        startDate: currentPageRequest.startDate,
        endDate: currentPageRequest.endDate,
        lagDays: SEARCH_CONSOLE_LAG_DAYS,
      },
      previousWindow: {
        startDate: previousPageRequest.startDate,
        endDate: previousPageRequest.endDate,
      },
      ...searchPageInsights(currentPages, previousPages, queryPages, currentTotal, previousTotal),
    };
  } catch (error) {
    const stage = error instanceof AnalyticsUpstreamError ? error.stage : "request_failed";
    const upstreamStatus = error instanceof AnalyticsUpstreamError ? error.status : null;
    console.error(JSON.stringify({ event: "operations_search_console_unavailable", stage, upstreamStatus }));
    return emptySearchConsole("unavailable");
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
    return url.protocol === "https:" && allowedHost ? safePublicPagePath(url.pathname) : null;
  } catch {
    return safePublicPagePath(pageUrl);
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
      last28Days: 0,
      websiteLast7Days: 0,
      websiteLast28Days: 0,
      bySource: [],
      topCampaigns: [],
      topLandingPages: [],
      sheetDelivery: { delivered: 0, pending: 0, failed: 0, missing: 0 },
    };
  }

  const now = new Date();
  const today = brisbaneDay(now);
  const weekStart = brisbaneDayDaysAgo(6, now);
  const periodStart = brisbaneDayDaysAgo(27, now);

  try {
    const [todayRow, weekRow, periodRow, websiteRow, websitePeriodRow, sourceResult, campaignResult, pageResult, deliveryResult, missingDeliveryRow] = await Promise.all([
      env.OPERATIONS_DB.prepare("SELECT COUNT(*) AS count FROM leads WHERE received_day = ?")
        .bind(today)
        .first(),
      env.OPERATIONS_DB.prepare(
        "SELECT COUNT(*) AS count FROM leads WHERE received_day >= ? AND received_day <= ?",
      ).bind(weekStart, today).first(),
      env.OPERATIONS_DB.prepare(
        "SELECT COUNT(*) AS count FROM leads WHERE received_day >= ? AND received_day <= ?",
      ).bind(periodStart, today).first(),
      env.OPERATIONS_DB.prepare(
        "SELECT COUNT(*) AS count FROM leads WHERE source = 'website' AND received_day >= ? AND received_day <= ?",
      ).bind(weekStart, today).first(),
      env.OPERATIONS_DB.prepare(
        "SELECT COUNT(*) AS count FROM leads WHERE source = 'website' AND received_day >= ? AND received_day <= ?",
      ).bind(periodStart, today).first(),
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
      last28Days: safeCount(periodRow?.count),
      websiteLast7Days: safeCount(websiteRow?.count),
      websiteLast28Days: safeCount(websitePeriodRow?.count),
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
      last28Days: 0,
      websiteLast7Days: 0,
      websiteLast28Days: 0,
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
    measurementBasis: "consented_visitors_only",
    dataWindows: {
      today: { startDate: "today", endDate: "today", provisional: true },
      stable: { startDate: "27daysAgo", endDate: "yesterday", days: STABLE_WINDOW_DAYS },
    },
    realtime: {
      status: gaStatus === "not_configured" ? "not_configured" : "unavailable",
      activeUsersLast30Minutes: null,
      windowMinutes: 30,
    },
    today: null,
    last28Days: null,
    topSources: [],
    landingPages: [],
    dailySessions: [],
    sessionDiagnostics: null,
    reportHealth: {
      todayLeadEvents: "unavailable",
      stableLeadEvents: "unavailable",
      trafficChannels: "unavailable",
      landingPages: "unavailable",
      dailySessions: "unavailable",
      sessionStartEvents: "unavailable",
    },
    searchConsole: emptySearchConsole(searchStatus),
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
  const stableWindow = { startDate: "27daysAgo", endDate: "yesterday" };

  try {
    const accessToken = await getAccessToken(config);
    const [todayTraffic, stableTraffic, todayLeads, stableLeads, topChannels, landingPages, dailySessions, sessionStarts, searchConsole, realtime] = await Promise.all([
      runReport(config, accessToken, trafficReport(today)),
      runReport(config, accessToken, trafficReport(stableWindow)),
      optionalReport(config, accessToken, generateLeadReport(today), "today_lead_events"),
      optionalReport(config, accessToken, generateLeadReport(stableWindow), "stable_lead_events"),
      optionalReport(config, accessToken, topChannelsReport(stableWindow), "traffic_channels"),
      optionalReport(config, accessToken, landingPagesReport(stableWindow), "landing_pages"),
      optionalReport(config, accessToken, dailySessionsReport(stableWindow), "daily_sessions"),
      optionalReport(config, accessToken, sessionStartReport(stableWindow), "session_start_events"),
      searchConsoleSummary(config, accessToken),
      realtimeSummary(config, accessToken),
    ]);

    const stableTrafficSummary = safeTraffic(stableTraffic, metricFromFirstRow(stableLeads.payload, 0));
    const safeDaily = safeDailySessions(dailySessions.payload);

    return json({
      ok: true,
      analytics: {
        gaStatus: "ready",
        measurementBasis: "consented_visitors_only",
        dataWindows: {
          today: { startDate: "today", endDate: "today", provisional: true },
          stable: { startDate: stableWindow.startDate, endDate: stableWindow.endDate, days: STABLE_WINDOW_DAYS },
        },
        realtime,
        today: safeTraffic(todayTraffic, metricFromFirstRow(todayLeads.payload, 0)),
        last28Days: stableTrafficSummary,
        topSources: safeTopSources(topChannels.payload),
        landingPages: safeLandingPages(landingPages.payload),
        dailySessions: safeDaily,
        sessionDiagnostics: sessionStarts.status === "ready"
          ? sessionDiagnostics(
              stableTrafficSummary,
              metricFromFirstRow(sessionStarts.payload, 0),
              safeDaily,
            )
          : null,
        reportHealth: {
          todayLeadEvents: todayLeads.status,
          stableLeadEvents: stableLeads.status,
          trafficChannels: topChannels.status,
          landingPages: landingPages.status,
          dailySessions: dailySessions.status,
          sessionStartEvents: sessionStarts.status,
        },
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
