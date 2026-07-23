import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const overview = readFileSync(
  new URL("../astro/src/pages/operations/index.astro", import.meta.url),
  "utf8",
);

test("Operations overview links only to the retained staff sections", () => {
  for (const href of [
    "/operations/leads/",
    "/operations/inbox/",
    "/operations/analytics/",
  ]) {
    assert.match(overview, new RegExp(`href="${href.replaceAll("/", "\\/")}"`));
  }

  assert.doesNotMatch(overview, /\/operations\/workspace\//);
  assert.doesNotMatch(
    overview,
    /Calls & transcripts|Quotes to review|Active jobs|Missed calls|Open workspace/,
  );
});

test("Operations overview names the three customer mailboxes and their real capabilities", () => {
  for (const address of [
    "deandre@brisbanetvs.com",
    "kody@brisbanetvs.com",
    "tom@brisbanetvs.com",
  ]) {
    assert.match(overview, new RegExp(address.replace(".", "\\.")));
  }

  assert.match(overview, /data-mail-routing-status/);
  assert.match(overview, /data-draft-status/);
  assert.match(overview, /data-send-status/);
  assert.match(overview, /sendingEnabled \? "Live" : "Disabled"/);
  assert.match(overview, /inboundEnabled \? "Live" : "Staged"/);
});

test("Operations overview refreshes focused lead, inbox and analytics data", () => {
  assert.match(overview, /requestJson\("\/operations\/api\/summary"\)/);
  assert.match(overview, /requestJson\("\/operations\/api\/inbox\?status=stored&limit=1"\)/);
  assert.match(overview, /requestJson\("\/operations\/api\/analytics"\)/);
  assert.doesNotMatch(overview, /operations\/api\/workspace/);
  assert.match(overview, /Cloudflare account sign-in for three approved staff identities/);
  assert.match(overview, /staged routing means new email is not yet being delivered here/);
});
