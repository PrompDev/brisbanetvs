import assert from "node:assert/strict";
import test from "node:test";
import {
  exchangeMobilePairing,
  normalisedExternalReference,
  sha256Hex,
} from "./mobile-call.js";

function environment({ pairing = null } = {}) {
  const writes = [];
  return {
    writes,
    env: {
      CALL_RECORDINGS: {
        put: async () => null,
        delete: async () => undefined,
      },
      OPERATIONS_DB: {
        prepare(sql) {
          return {
            bind(...args) {
              return {
                async first() {
                  if (sql.startsWith("UPDATE mobile_call_pairings")) return pairing;
                  return null;
                },
                async run() {
                  writes.push({ sql, args });
                  return { success: true };
                },
              };
            },
          };
        },
      },
    },
  };
}

test("sha256Hex returns the expected lowercase digest", async () => {
  assert.equal(
    await sha256Hex("brisbane-tvs"),
    "10dfbe9b8c85643d2ae90507923b78b140c701bbff835793152ff2b1da380498",
  );
});

test("website Calendar IDs resolve to the D1 external ID", () => {
  assert.equal(
    normalisedExternalReference("website:9ca0ebda-b062-49fb-ac22-b78dd43302d0", "website"),
    "9ca0ebda-b062-49fb-ac22-b78dd43302d0",
  );
  assert.equal(normalisedExternalReference("l:1234", "google_lead_sheet"), "l:1234");
});

test("pairing rejects malformed codes before database use", async () => {
  const fixture = environment();
  const response = await exchangeMobilePairing(
    new Request("https://brisbanetvs.com/api/mobile-call/pair", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "short" }),
    }),
    fixture.env,
  );
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { ok: false, error: "invalid_pairing" });
  assert.equal(fixture.writes.length, 0);
});

test("a valid one-time pairing returns a device token and stores only its hash", async () => {
  const fixture = environment({ pairing: { id: "pairing_test", created_by: "tom@example.test" } });
  const response = await exchangeMobilePairing(
    new Request("https://brisbanetvs.com/api/mobile-call/pair", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "a".repeat(43), deviceLabel: "Tom's Pixel" }),
    }),
    fixture.env,
  );
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.match(payload.token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(fixture.writes.length, 1);
  assert.equal(fixture.writes[0].args.includes(payload.token), false);
  assert.equal(fixture.writes[0].args[1], await sha256Hex(payload.token));
});
