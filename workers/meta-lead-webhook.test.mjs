import assert from "node:assert/strict";
import { createHmac, webcrypto } from "node:crypto";
import test from "node:test";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const {
  canonicalMetaLead,
  extractMetaLeadEvents,
  onMetaWebhookGet,
  verifyMetaWebhookSignature,
} = await import("./meta-lead-webhook.js");
const { metaSheetRow } = await import("../functions/api/website-lead.js");

test("Meta leadgen webhook events are extracted once with their routing IDs", () => {
  const payload = {
    object: "page",
    entry: [{
      id: "123456789012345",
      changes: [
        {
          field: "leadgen",
          value: {
            leadgen_id: "987654321098765",
            page_id: "123456789012345",
            form_id: "222222222222222",
            ad_id: "333333333333333",
            created_time: 1784080800,
          },
        },
        {
          field: "leadgen",
          value: { leadgen_id: "987654321098765" },
        },
      ],
    }],
  };

  assert.deepEqual(extractMetaLeadEvents(payload), [{
    id: "987654321098765",
    pageId: "123456789012345",
    formId: "222222222222222",
    adId: "333333333333333",
    createdTime: 1784080800,
  }]);
});

test("Meta lead answers preserve campaign data and recognise phone aliases", () => {
  const event = {
    id: "987654321098765",
    page_id: "123456789012345",
    form_id: "222222222222222",
    ad_id: "333333333333333",
    created_time: 1784080800,
  };
  const lead = canonicalMetaLead({
    id: event.id,
    created_time: "2026-07-15T02:00:00+0000",
    platform: "ig",
    ad_id: event.ad_id,
    ad_name: "Synthetic ad",
    adset_id: "444444444444444",
    adset_name: "Synthetic ad set",
    campaign_id: "555555555555555",
    campaign_name: "Synthetic campaign",
    form_id: event.form_id,
    is_organic: false,
    field_data: [
      { name: "full_name", values: ["Synthetic Customer"] },
      { name: "your_phone_number", values: ["+61 400 000 000"] },
      { name: "email", values: ["SYNTHETIC@EXAMPLE.INVALID"] },
      { name: "postcode", values: ["4000"] },
      { name: "what_size_is_your_tv?", values: ["56–75\""] },
      { name: "want_to_get_your_tv_mounted?", values: ["Yes"] },
    ],
  }, event);

  assert.equal(lead.source, "meta_lead_ads");
  assert.equal(lead.externalId, event.id);
  assert.equal(lead.platform, "instagram");
  assert.equal(lead.fullName, "Synthetic Customer");
  assert.equal(lead.phone, "+61 400 000 000");
  assert.equal(lead.email, "synthetic@example.invalid");
  assert.equal(lead.postcode, "4000");
  assert.equal(lead.tvSize, "56–75\"");

  const row = metaSheetRow({
    source: lead.source,
    external_id: lead.externalId,
    received_at: lead.receivedAt,
    platform: lead.platform,
    campaign: lead.campaign,
    details_json: lead.detailsJson,
    service: lead.service,
    tv_size: lead.tvSize,
    email: lead.email,
    full_name: lead.fullName,
    phone: lead.phone,
    postcode: lead.postcode,
  });
  assert.equal(row.length, 18);
  assert.equal(row[0], event.id);
  assert.equal(row[2], event.ad_id);
  assert.equal(row[7], "Synthetic campaign");
  assert.equal(row[11], "ig");
  assert.equal(row[12], "Yes");
  assert.equal(row[16], "+61 400 000 000");
});

test("Meta signatures and callback verification fail closed", async () => {
  const appSecret = "synthetic-app-secret-0123456789";
  const rawBody = new TextEncoder().encode('{"object":"page"}');
  const digest = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  assert.equal(await verifyMetaWebhookSignature(rawBody, "sha256=" + digest, appSecret), true);
  assert.equal(await verifyMetaWebhookSignature(rawBody, "sha256=" + "0".repeat(64), appSecret), false);

  const verifyToken = "synthetic-verify-token-01234567890123456789";
  const request = new Request(
    "https://brisbanetvs.com/api/meta-lead-webhook" +
      "?hub.mode=subscribe&hub.verify_token=" + encodeURIComponent(verifyToken) + "&hub.challenge=12345",
  );
  const accepted = await onMetaWebhookGet({ request, env: { META_WEBHOOK_VERIFY_TOKEN: verifyToken } });
  assert.equal(accepted.status, 200);
  assert.equal(await accepted.text(), "12345");

  const rejected = await onMetaWebhookGet({
    request: new Request(
      "https://brisbanetvs.com/api/meta-lead-webhook" +
        "?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=12345",
    ),
    env: { META_WEBHOOK_VERIFY_TOKEN: verifyToken },
  });
  assert.equal(rejected.status, 403);
});
