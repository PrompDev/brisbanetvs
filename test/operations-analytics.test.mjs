import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(
  new URL("../astro/functions/operations/api/analytics.js", import.meta.url),
  "utf8",
)
  .replace(/^import .*;\r?\n/gm, "")
  .replace("export async function onRequestGet", "async function onRequestGet")
  + "\nglobalThis.__analyticsTest = { trafficReport, landingPagesReport, safeTraffic, safeLandingPages, safeDailySessions, sessionDiagnostics, searchPageInsights, optionalReport, runRealtimeReport, realtimeSummary };\n";

function loadAnalyticsApi(fetchImpl) {
  const context = vm.createContext({
    fetch: fetchImpl,
    Response,
    TextDecoder,
    Uint8Array,
    AbortSignal,
    URL,
    URLSearchParams,
    Intl,
    Date,
    Map,
    Set,
    Number,
    String,
    Boolean,
    Object,
    Array,
    JSON,
    Math,
    console: { error() {}, warn() {}, log() {} },
    importPKCS8: async () => ({}),
    SignJWT: class {},
    hasOperationsDatabase: () => false,
    json: (value) => value,
    requireOperationsAccess: async () => ({ response: null }),
    brisbaneDay: () => "2026-07-14",
    brisbaneDayDaysAgo: () => "2026-07-08",
  });
  vm.runInContext(source, context);
  return context.__analyticsTest;
}

test("realtime reporting uses the fixed GA4 endpoint and activeUsers metric", async () => {
  const calls = [];
  const api = loadAnalyticsApi(async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ rows: [{ metricValues: [{ value: "3" }] }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });

  const result = await api.realtimeSummary({ propertyId: "545397141" }, "access-token");
  assert.equal(result.status, "ready");
  assert.equal(result.activeUsersLast30Minutes, 3);
  assert.equal(result.windowMinutes, 30);
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    "https://analyticsdata.googleapis.com/v1beta/properties/545397141:runRealtimeReport",
  );
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers.authorization, "Bearer access-token");
  assert.deepEqual(JSON.parse(calls[0].init.body), { metrics: [{ name: "activeUsers" }] });
});

test("an empty realtime report is connected but quiet", async () => {
  const api = loadAnalyticsApi(async () => new Response(JSON.stringify({ rows: [] }), { status: 200 }));
  const result = await api.realtimeSummary({ propertyId: "545397141" }, "access-token");
  assert.equal(result.status, "ready");
  assert.equal(result.activeUsersLast30Minutes, 0);
  assert.equal(result.windowMinutes, 30);
});

test("a realtime outage degrades independently", async () => {
  const api = loadAnalyticsApi(async () => new Response(JSON.stringify({ error: "upstream" }), { status: 500 }));
  const result = await api.realtimeSummary({ propertyId: "545397141" }, "access-token");
  assert.equal(result.status, "unavailable");
  assert.equal(result.activeUsersLast30Minutes, null);
  assert.equal(result.windowMinutes, 30);
});

test("an optional GA4 report cannot blank the core session report", async () => {
  const api = loadAnalyticsApi(async () => new Response(JSON.stringify({ error: "upstream" }), { status: 500 }));
  const result = await api.optionalReport(
    { propertyId: "545397141" },
    "access-token",
    api.landingPagesReport({ startDate: "27daysAgo", endDate: "yesterday" }),
    "landing_pages",
  );
  assert.equal(result.status, "unavailable");
  assert.deepEqual(JSON.parse(JSON.stringify(result.payload)), { rows: [] });
});

test("the stable traffic report requests the session metrics needed for diagnosis", () => {
  const api = loadAnalyticsApi(async () => new Response("{}"));
  const report = api.trafficReport({ startDate: "27daysAgo", endDate: "yesterday" });
  assert.deepEqual(
    Array.from(report.metrics, (metric) => metric.name),
    [
      "sessions",
      "activeUsers",
      "screenPageViews",
      "averageSessionDuration",
      "engagedSessions",
      "engagementRate",
      "screenPageViewsPerSession",
    ],
  );
});

test("landing pages and daily sessions are parsed into privacy-safe paths", () => {
  const api = loadAnalyticsApi(async () => new Response("{}"));
  const landingPages = api.safeLandingPages({
    rows: [
      {
        dimensionValues: [{ value: "/tv-wall-mounting/" }],
        metricValues: [
          { value: "8" },
          { value: "6" },
          { value: "0.75" },
          { value: "14" },
          { value: "1.75" },
          { value: "240" },
        ],
      },
      {
        dimensionValues: [{ value: "https://malicious.example/" }],
        metricValues: [{ value: "50" }],
      },
    ],
  });
  assert.deepEqual(JSON.parse(JSON.stringify(landingPages)), [{
    path: "/tv-wall-mounting/",
    sessions: 8,
    engagedSessions: 6,
    engagementRate: 0.75,
    pageViews: 14,
    viewsPerSession: 1.75,
    averageEngagementSeconds: 30,
  }]);

  const days = api.safeDailySessions({
    rows: [{
      dimensionValues: [{ value: "20260714" }],
      metricValues: [{ value: "3" }, { value: "2" }, { value: "5" }],
    }],
  });
  assert.deepEqual(JSON.parse(JSON.stringify(days)), [{
    date: "2026-07-14",
    sessions: 3,
    engagedSessions: 2,
    pageViews: 5,
  }]);
  assert.equal(api.sessionDiagnostics({ sessions: 3 }, 3, days).status, "aligned");
});

test("Search Console rows become page-level opportunities with their safe queries", () => {
  const api = loadAnalyticsApi(async () => new Response("{}"));
  const current = {
    rows: [
      { keys: ["https://brisbanetvs.com/tv-wall-mounting/"], clicks: 0, impressions: 20, ctr: 0, position: 8 },
      { keys: ["https://brisbanetvs.com/tv-repairs/"], clicks: 2, impressions: 12, ctr: 1 / 6, position: 4 },
    ],
  };
  const previous = {
    rows: [
      { keys: ["https://brisbanetvs.com/tv-wall-mounting/"], clicks: 0, impressions: 5, ctr: 0, position: 11 },
    ],
  };
  const queryPages = {
    rows: [
      { keys: ["tv wall mounting brisbane", "https://brisbanetvs.com/tv-wall-mounting/"], clicks: 0, impressions: 15, ctr: 0, position: 7.5 },
      { keys: ["0412345678", "https://brisbanetvs.com/tv-wall-mounting/"], clicks: 0, impressions: 3, ctr: 0, position: 9 },
    ],
  };
  const result = api.searchPageInsights(current, previous, queryPages);
  const wallMounting = result.pages.find((page) => page.path === "/tv-wall-mounting/");
  assert.equal(result.totals.impressions, 32);
  assert.equal(result.changes.impressions, 27);
  assert.equal(wallMounting.impressionChange, 15);
  assert.equal(wallMounting.opportunity.type, "snippet_gap");
  assert.equal(wallMounting.topQueries.length, 1);
  assert.equal(wallMounting.topQueries[0].query, "tv wall mounting brisbane");
});
