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

function websiteLeadInternals() {
  const code = websiteLeadSource.replace(/\bexport\s+/g, "")
    + "\nglobalThis.__websiteLeadTest = { validateWebsiteSubmission, canonicalFromWebsite };\n";
  const context = vm.createContext({
    crypto: { randomUUID: () => "internal-lead-id" },
    Date,
    Intl,
    URL,
    URLSearchParams,
    JSON,
    Math,
    Number,
    String,
    Boolean,
    Object,
    Array,
    RegExp,
    Set,
    Map,
  });
  vm.runInContext(code, context);
  return context.__websiteLeadTest;
}

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

  const emailOnlyFooter = websiteSheetRow({
    external_id: "submission-126",
    platform: "website",
    tracking_json: "{}",
    details_json: JSON.stringify({ form_source: "footer-quote" }),
    email: "footer@example.invalid",
  });
  assert.equal(emailOnlyFooter[12], "", "email-only footer enquiries must not invent TV-mounting intent");
});

test("a complete quote submission validates and preserves every submitted detail", () => {
  const { validateWebsiteSubmission, canonicalFromWebsite } = websiteLeadInternals();
  const fields = {
    submission_id: "submission-complete-1",
    form_source: "quote-page",
    name: "Synthetic Customer",
    phone: "+61 400 000 000",
    email: "synthetic@example.invalid",
    suburb: "Paddington",
    postcode: "4064",
    service: "XL Living Room Package",
    package: "xl-living-room",
    tv_count: "2",
    tv_size: "85",
    tv_brand: "Samsung QN90",
    wall_type: "brick",
    addons_json: JSON.stringify(["soundbar", "cable-concealment"]),
    preferred_date: "any-day-this-week",
    message: "Use the side gate.",
    consent: "yes",
    marketing_consent: "yes",
    page_url: "https://brisbanetvs.com/quote/",
    utm_source: "facebook",
    utm_medium: "paid-social",
    utm_campaign: "Winter Mounts",
    utm_term: "tv mounting brisbane",
    utm_content: "video-one",
    utm_id: "campaign-42",
    landing_page: "/quote/",
    referrer: "https://facebook.com/ads/",
    source_platform: "facebook",
  };

  assert.doesNotThrow(() => validateWebsiteSubmission(fields, []));
  const lead = canonicalFromWebsite(fields, 0);
  const details = JSON.parse(lead.detailsJson);
  const tracking = JSON.parse(lead.trackingJson);

  assert.equal(lead.externalId, "submission-complete-1");
  assert.equal(lead.fullName, fields.name);
  assert.equal(lead.phone, fields.phone);
  assert.equal(lead.email, fields.email);
  assert.equal(lead.suburb, fields.suburb);
  assert.equal(lead.postcode, fields.postcode);
  assert.equal(lead.service, fields.service);
  assert.equal(lead.tvSize, fields.tv_size);
  assert.equal(lead.wallType, fields.wall_type);
  assert.equal(lead.preferredDate, fields.preferred_date);
  assert.equal(lead.message, fields.message);
  assert.equal(lead.pageUrl, fields.page_url);
  assert.equal(lead.campaign, fields.utm_campaign);
  assert.equal(lead.marketingConsent, 1);
  assert.equal(details.form_source, fields.form_source);
  assert.equal(details.package, fields.package);
  assert.equal(details.tv_count, Number(fields.tv_count));
  assert.equal(details.tv_brand, fields.tv_brand);
  assert.deepEqual([...details.addons], ["soundbar", "cable-concealment"]);
  assert.equal(details.quote_contact_consent, 1);
  assert.equal(details.marketing_consent, 1);
  assert.equal(tracking.utm_source, fields.utm_source);
  assert.equal(tracking.utm_medium, fields.utm_medium);
  assert.equal(tracking.utm_campaign, fields.utm_campaign);
  assert.equal(tracking.utm_term, fields.utm_term);
  assert.equal(tracking.utm_content, fields.utm_content);
  assert.equal(tracking.utm_id, fields.utm_id);
  assert.equal(tracking.landing_page, fields.landing_page);
  assert.equal(tracking.referrer, "https://facebook.com/ads/");
  assert.equal(tracking.source_platform, fields.source_platform);
});

test("quote intake rejects missing consent and invalid core values", () => {
  const { validateWebsiteSubmission } = websiteLeadInternals();
  const valid = {
    name: "Synthetic Customer",
    phone: "0400 000 000",
    email: "synthetic@example.invalid",
    suburb: "Paddington",
    service: "TV mounting",
    tv_size: "65",
    wall_type: "timber-stud",
    postcode: "4064",
    consent: "yes",
  };

  assert.throws(() => validateWebsiteSubmission({ ...valid, consent: "" }, []), /Missing field: consent/);
  assert.throws(() => validateWebsiteSubmission({ ...valid, phone: "123" }, []), /Invalid phone number/);
  assert.throws(() => validateWebsiteSubmission({ ...valid, tv_size: "200" }, []), /Invalid field: tv_size/);
  assert.throws(() => validateWebsiteSubmission({ ...valid, postcode: "40A4" }, []), /Invalid field: postcode/);
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
