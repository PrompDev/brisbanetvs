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
  + "\nglobalThis.__analyticsTest = { trafficReport, generateLeadReport, publicActionsReport, topChannelsReport, landingPagesReport, dailySessionsReport, sessionStartReport, searchConsoleReport, safeTraffic, safeLandingPages, safePublicActions, safeDailySessions, safeSearchQuery, safeSearchPage, safeOperationalPage, safeSearchDeviceRows, safeSearchCountryRows, safeBusinessOutcomes, safePageOutcomes, sessionDiagnostics, searchPageInsights, sourceForPublicPage, guidanceForOpportunity, operationalLeadSignals, optionalReport, runRealtimeReport, realtimeSummary };\n";

const analyticsPageSource = fs.readFileSync(
  new URL("../astro/src/pages/operations/analytics/index.astro", import.meta.url),
  "utf8",
);

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
    hasOperationsDatabase: (env) => Boolean(env?.OPERATIONS_DB),
    json: (value) => value,
    requireOperationsAccess: async () => ({ response: null }),
    brisbaneDay: () => "2026-07-14",
    brisbaneDayDaysAgo: (days) => days === 6 ? "2026-07-08" : "2026-06-17",
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

test("every standard GA4 report excludes sessions that land in Operations", () => {
  const api = loadAnalyticsApi(async () => new Response("{}"));
  const dateRange = { startDate: "27daysAgo", endDate: "yesterday" };
  const reports = [
    api.trafficReport(dateRange),
    api.generateLeadReport(dateRange),
    api.publicActionsReport(dateRange),
    api.topChannelsReport(dateRange),
    api.landingPagesReport(dateRange),
    api.dailySessionsReport(dateRange),
    api.sessionStartReport(dateRange),
  ];
  for (const report of reports) {
    const encoded = JSON.stringify(report.dimensionFilter);
    assert.match(encoded, /"fieldName":"landingPage"/);
    assert.match(encoded, /"matchType":"BEGINS_WITH"/);
    assert.match(encoded, /"value":"\/operations\/"/);
    assert.match(encoded, /"notExpression"/);
  }
});

test("public action reporting exposes measured events by safe public landing page", () => {
  const api = loadAnalyticsApi(async () => new Response("{}"));
  const report = api.publicActionsReport({ startDate: "27daysAgo", endDate: "yesterday" });
  assert.deepEqual(Array.from(report.dimensions, (dimension) => dimension.name), ["eventName", "landingPage"]);
  assert.match(JSON.stringify(report.dimensionFilter), /quote_cta_click/);
  assert.match(JSON.stringify(report.dimensionFilter), /form_error/);

  const result = api.safePublicActions({
    rows: [
      { dimensionValues: [{ value: "quote_cta_click" }, { value: "/" }], metricValues: [{ value: "4" }] },
      { dimensionValues: [{ value: "form_start" }, { value: "/quote/" }], metricValues: [{ value: "3" }] },
      { dimensionValues: [{ value: "form_error" }, { value: "/quote/" }], metricValues: [{ value: "1" }] },
      { dimensionValues: [{ value: "click_to_call" }, { value: "/operations/analytics/" }], metricValues: [{ value: "99" }] },
      { dimensionValues: [{ value: "unknown_event" }, { value: "/" }], metricValues: [{ value: "50" }] },
    ],
  });
  assert.equal(result.totals.quoteCtaClicks, 4);
  assert.equal(result.totals.formStarts, 3);
  assert.equal(result.totals.formErrors, 1);
  assert.equal(result.totals.callClicks, 0);
  assert.equal(result.pages.length, 2);
  assert.equal(result.pages.find((page) => page.path === "/quote/").formStarts, 3);
  assert.equal(result.pages.some((page) => page.path.startsWith("/operations/")), false);
});

test("Search Console device and country rows stay aggregate and controlled", () => {
  const api = loadAnalyticsApi(async () => new Response("{}"));
  const devices = api.safeSearchDeviceRows({ rows: [
    { keys: ["MOBILE"], clicks: 3, impressions: 30, ctr: 0.1, position: 8 },
    { keys: ["WATCH"], clicks: 9, impressions: 90, ctr: 0.1, position: 2 },
  ] });
  assert.deepEqual(JSON.parse(JSON.stringify(devices)), [{ label: "Mobile", clicks: 3, impressions: 30, ctr: 0.1, position: 8 }]);

  const countries = api.safeSearchCountryRows({ rows: [
    { keys: ["aus"], clicks: 4, impressions: 40, ctr: 0.1, position: 7 },
    { keys: ["usa"], clicks: 1, impressions: 10, ctr: 0.1, position: 12 },
    { keys: ["gbr"], clicks: 0, impressions: 5, ctr: 0, position: 20 },
  ] });
  assert.equal(countries[0].label, "Australia");
  assert.equal(countries[1].label, "Outside Australia");
  assert.equal(countries[1].impressions, 15);
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
      {
        dimensionValues: [{ value: "/operations/analytics/" }],
        metricValues: [{ value: "99" }],
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
  assert.equal(api.safeSearchPage("https://brisbanetvs.com/operations/"), null);
  assert.equal(api.safeOperationalPage("/operations/analytics/"), null);
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
  assert.match(wallMounting.opportunity.hypothesis, /title or description/i);
  assert.match(wallMounting.opportunity.successCheck, /28-day window/i);
  assert.match(wallMounting.opportunity.reviewRule, /one focused change/i);
  assert.equal(wallMounting.topQueries.length, 1);
  assert.equal(wallMounting.topQueries[0].query, "tv wall mounting brisbane");
});

test("SEO tasks point agents to known page sources and fall back to route tracing", () => {
  const api = loadAnalyticsApi(async () => new Response("{}"));
  assert.deepEqual(JSON.parse(JSON.stringify(api.sourceForPublicPage("/"))), {
    file: "astro/public/index.html",
    label: "Homepage source",
    confidence: "exact",
  });
  assert.equal(api.sourceForPublicPage("/locations/sinnamon-park/").file, "astro/src/content/locations/sinnamon-park.md");
  assert.equal(api.sourceForPublicPage("/blog/mounting-big-tv-on-brick/").file, "astro/src/content/blog/mounting-big-tv-on-brick.md");
  assert.equal(api.sourceForPublicPage("/quote/").file, "astro/src/pages/quote.astro");
  assert.equal(api.sourceForPublicPage("/older-public-route/").file, null);
  assert.match(api.sourceForPublicPage("/older-public-route/").hint, /confirm the live page/i);
});

test("the dashboard exposes the complete human-controlled improvement loop", () => {
  assert.match(analyticsPageSource, /Recorded facts/);
  assert.match(analyticsPageSource, /What customers actually did/);
  assert.match(analyticsPageSource, /Observed facts/);
  assert.match(analyticsPageSource, /Still unknown/);
  assert.match(analyticsPageSource, /A dash means the source is unavailable/);
  assert.match(analyticsPageSource, /One page\. One change\. One measured decision\./);
  assert.match(analyticsPageSource, /Copy agent task/);
  assert.match(analyticsPageSource, /HYPOTHESIS TO VERIFY/);
  assert.match(analyticsPageSource, /SUCCESS DECISION/);
  assert.match(analyticsPageSource, /Nothing changes automatically/);
  assert.match(analyticsPageSource, /Preserve the Analytics Design Certificate and the exclusion of \/operations\/\*/);
});

test("Search Console property totals do not depend on truncated page rows", () => {
  const api = loadAnalyticsApi(async () => new Response("{}"));
  const currentPages = {
    rows: [{ keys: ["https://brisbanetvs.com/"], clicks: 3, impressions: 20, ctr: 0.15, position: 12 }],
  };
  const previousPages = {
    rows: [{ keys: ["https://brisbanetvs.com/"], clicks: 1, impressions: 10, ctr: 0.1, position: 14 }],
  };
  const currentTotal = { rows: [{ clicks: 8, impressions: 80, ctr: 0.1, position: 18 }] };
  const previousTotal = { rows: [{ clicks: 4, impressions: 40, ctr: 0.1, position: 20 }] };
  const result = api.searchPageInsights(currentPages, previousPages, { rows: [] }, currentTotal, previousTotal);
  assert.equal(result.pages[0].impressions, 20);
  assert.equal(result.totals.impressions, 80);
  assert.equal(result.changes.clicks, 4);
  assert.equal(result.changes.position, 2);
  assert.equal("dimensions" in api.searchConsoleReport([], 30, 3, 1), false);
});

test("Search Console normalises duplicate hosts and removes phone-like queries", () => {
  const api = loadAnalyticsApi(async () => new Response("{}"));
  const current = {
    rows: [
      { keys: ["https://brisbanetvs.com/quote"], clicks: 1, impressions: 10, ctr: 0.1, position: 8 },
      { keys: ["https://www.brisbanetvs.com/quote/"], clicks: 2, impressions: 20, ctr: 0.1, position: 6 },
    ],
  };
  const queries = {
    rows: [
      { keys: ["tv mounting 0412 345 678", "https://brisbanetvs.com/quote/"], clicks: 0, impressions: 5, ctr: 0, position: 7 },
      { keys: ["tv mounting quote", "https://www.brisbanetvs.com/quote"], clicks: 1, impressions: 8, ctr: 0.125, position: 6 },
    ],
  };
  const result = api.searchPageInsights(current, { rows: [] }, queries);
  assert.equal(result.pages.length, 1);
  assert.equal(result.pages[0].path, "/quote/");
  assert.equal(result.pages[0].impressions, 30);
  assert.equal(result.pages[0].topQueries.length, 1);
  assert.equal(result.pages[0].topQueries[0].query, "tv mounting quote");
  assert.equal(api.safeSearchQuery("0412 345 678"), null);
});

test("saved enquiry signals expose matching seven and twenty-eight day totals", async () => {
  const api = loadAnalyticsApi(async () => new Response("{}"));
  const database = {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async first() {
              if (sql.includes("source = 'website'")) return { count: values[0] === "2026-07-08" ? 3 : 9 };
              if (sql.includes("received_day >=")) return { count: values[0] === "2026-07-08" ? 7 : 28 };
              return { count: 1 };
            },
            async all() { return { results: [] }; },
          };
        },
        async first() { return { count: 0 }; },
        async all() { return { results: [] }; },
      };
    },
  };
  const result = await api.operationalLeadSignals({ OPERATIONS_DB: database });
  assert.equal(result.status, "ready");
  assert.equal(result.last7Days, 7);
  assert.equal(result.last28Days, 28);
  assert.equal(result.websiteLast7Days, 3);
  assert.equal(result.websiteLast28Days, 9);
});
