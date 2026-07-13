import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const analyticsSource = fs.readFileSync(
  new URL("../astro/public/scripts/brisbane-analytics.js", import.meta.url),
  "utf8",
);

function browserHarness({ consent = "granted", url = "https://brisbanetvs.com/" } = {}) {
  const storage = new Map(consent ? [["brisbane_tvs_analytics_consent_v1", consent]] : []);
  const session = new Map();
  const scripts = [];
  let fetchCount = 0;

  function element(tagName) {
    return {
      tagName,
      style: {},
      classList: { add() {}, remove() {}, toggle() {} },
      append() {},
      appendChild() {},
      addEventListener() {},
      setAttribute() {},
      getAttribute() { return ""; },
      remove() {},
      closest() { return null; },
      textContent: "",
    };
  }

  const location = new URL(url);
  const document = {
    referrer: "https://www.facebook.com/brisbane/path?private=value",
    readyState: "complete",
    cookie: "",
    createElement: element,
    querySelector() { return null; },
    addEventListener() {},
    body: { append() {}, appendChild() {} },
    head: {
      appendChild(script) {
        scripts.push(script.src);
        if (typeof script.onload === "function") script.onload();
      },
    },
  };
  const window = {
    document,
    location,
    localStorage: {
      getItem(key) { return storage.get(key) || null; },
      setItem(key, value) { storage.set(key, value); },
    },
    sessionStorage: {
      getItem(key) { return session.get(key) || null; },
      setItem(key, value) { session.set(key, value); },
    },
    crypto: { randomUUID: () => "submission-id" },
    async fetch() {
      fetchCount += 1;
      return { ok: true, json: async () => ({ enabled: true, measurementId: "G-TEST123" }) };
    },
  };

  const context = vm.createContext({
    window,
    document,
    URL,
    URLSearchParams,
    WeakSet,
    Element: class Element {},
    Date,
    Map,
    Object,
    Array,
    Boolean,
    Number,
    String,
    RegExp,
    JSON,
    console: { error() {}, warn() {}, log() {} },
  });
  vm.runInContext(analyticsSource, context);
  return {
    window,
    scripts,
    get fetchCount() { return fetchCount; },
    async settle() {
      await Promise.resolve();
      await Promise.resolve();
      await new Promise((resolve) => setImmediate(resolve));
    },
  };
}

function commands(window) {
  return (window.dataLayer || []).map((entry) => Array.from(entry));
}

test("Google Analytics is not requested before explicit consent", async () => {
  const browser = browserHarness({ consent: null });
  await browser.settle();
  assert.equal(browser.fetchCount, 0);
  assert.deepEqual(browser.scripts, []);
});

test("the Google tag initializes before config and forwards only allowlisted campaign fields", async () => {
  const browser = browserHarness({
    url: "https://brisbanetvs.com/quote/?utm_source=facebook&utm_medium=paid-social&utm_campaign=Winter%20Mounts&utm_term=tv%20mounting&utm_content=video-one&utm_id=campaign-42&fbclid=secret-click&email=private%40example.com&arbitrary=ignore-me",
  });
  await browser.settle();

  assert.equal(browser.fetchCount, 1);
  assert.deepEqual(browser.scripts, ["https://www.googletagmanager.com/gtag/js?id=G-TEST123"]);

  const dataLayer = commands(browser.window);
  const jsIndex = dataLayer.findIndex((entry) => entry[0] === "js");
  const configIndex = dataLayer.findIndex((entry) => entry[0] === "config");
  assert.ok(jsIndex >= 0 && jsIndex < configIndex);

  const config = dataLayer[configIndex][2];
  assert.equal(config.page_location, "https://brisbanetvs.com/quote/");
  assert.equal(config.page_referrer, "https://www.facebook.com/brisbane/path");
  assert.deepEqual(
    Object.fromEntries(Object.entries(config).filter(([key]) => key.startsWith("campaign_"))),
    {
      campaign_source: "facebook",
      campaign_medium: "paid-social",
      campaign_name: "Winter Mounts",
      campaign_term: "tv mounting",
      campaign_content: "video-one",
      campaign_id: "campaign-42",
    },
  );
  const serialized = JSON.stringify(config);
  assert.doesNotMatch(serialized, /fbclid|secret-click|private@example\.com|arbitrary|ignore-me/);
});

test("campaign attribution that looks like personal information is not sent to GA4", async () => {
  const browser = browserHarness({
    url: "https://brisbanetvs.com/?utm_source=facebook&utm_campaign=person%40example.com&utm_content=mobile%3D0412345678",
  });
  await browser.settle();

  const configCall = commands(browser.window).find((entry) => entry[0] === "config");
  assert.equal(configCall[2].campaign_source, "facebook");
  assert.equal(configCall[2].campaign_name, undefined);
  assert.equal(configCall[2].campaign_content, undefined);
});
