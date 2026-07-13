import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const websiteLeadSource = fs.readFileSync(
  new URL("../functions/api/website-lead.js", import.meta.url),
  "utf8",
);
const websiteLeadModule = await import(
  "data:text/javascript;base64," + Buffer.from(websiteLeadSource).toString("base64")
);
const {
  WEBSITE_SHEET_HEADERS,
  WEBSITE_SHEET_NAME,
  websiteSheetRow,
} = websiteLeadModule;

const LEADS_HEADERS = [
  "id",
  "created_time",
  "ad_id",
  "ad_name",
  "adset_id",
  "adset_name",
  "campaign_id",
  "campaign_name",
  "form_id",
  "form_name",
  "is_organic",
  "platform",
  "want_to_get_your_tv_mounted",
  "what_size_is_your_tv",
  "email",
  "full_name",
  "phone_number",
  "postcode",
];

test("website leads use the normal Leads contract and a stable ID", () => {
  const row = websiteSheetRow({
    external_id: "submission-123",
    received_at: "2026-07-14T01:00:00.000Z",
    platform: "facebook",
    campaign: "Winter TV Mounting",
    tracking_json: JSON.stringify({ utm_campaign: "Winter TV Mounting" }),
    details_json: JSON.stringify({ form_source: "quote-page" }),
    service: "TV mounting",
    tv_size: "75 inch",
    email: "synthetic@example.invalid",
    full_name: "Synthetic Website Lead",
    phone: "+61400000000",
    postcode: "4000",
  });

  assert.equal(WEBSITE_SHEET_NAME, "Leads");
  assert.deepEqual([...WEBSITE_SHEET_HEADERS], LEADS_HEADERS);
  assert.equal(row.length, LEADS_HEADERS.length);
  assert.equal(row[0], "website:submission-123");
  assert.deepEqual(row.slice(2, 7), ["", "", "", "", ""]);
  assert.equal(row[7], "Winter TV Mounting");
  assert.equal(row[8], "");
  assert.equal(row[9], "quote-page");
  assert.equal(row[10], "");
  assert.equal(row[11], "fb");
  assert.equal(row[12], "yes");
  assert.equal(row[13], "56\"–75\"");
  assert.equal(row[15], "Synthetic Website Lead");

  const instagramLargeTv = websiteSheetRow({
    external_id: "submission-124",
    platform: "instagram",
    tv_size: "85",
    tracking_json: "{}",
    details_json: "{}",
  });
  assert.equal(instagramLargeTv[11], "ig");
  assert.equal(instagramLargeTv[13], "over_75\"");

  const smallTv = websiteSheetRow({
    external_id: "submission-125",
    tv_size: "32",
    tracking_json: "{}",
    details_json: "{}",
  });
  assert.equal(smallTv[12], "yes");
  assert.equal(smallTv[13], "under_40\"");
});

function loadOperationsSync() {
  const code = fs.readFileSync(
    new URL("../integrations/google-apps-script/operations-lead-sync.gs", import.meta.url),
    "utf8",
  );
  const context = vm.createContext({});
  vm.runInContext(code, context);
  return context;
}

test("return sync skips website-origin rows but keeps normal paid-social leads", () => {
  const context = loadOperationsSync();
  const headers = ["id", "created_time", "source", "platform", "full_name"];
  const index = context.operationsHeaderIndex_(headers);

  assert.equal(
    context.operationsLeadFromRow_(
      ["website:submission-123", "2026-07-14T01:00:00.000Z", "", "facebook", "Website Lead"],
      index,
    ),
    null,
  );
  assert.equal(
    context.operationsLeadFromRow_(
      ["provider-123", "2026-07-14T01:00:00.000Z", "website", "website", "Website Lead"],
      index,
    ),
    null,
  );

  const paidSocialLead = context.operationsLeadFromRow_(
    ["l:123", "2026-07-14T01:00:00.000Z", "", "ig", "Instagram Lead"],
    index,
  );
  assert.equal(paidSocialLead.external_id, "l:123");
  assert.equal(paidSocialLead.platform, "ig");
  assert.equal(paidSocialLead.source, "google_lead_sheet");
});
