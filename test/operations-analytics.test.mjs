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
  + "\nglobalThis.__analyticsTest = { runRealtimeReport, realtimeSummary };\n";

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
