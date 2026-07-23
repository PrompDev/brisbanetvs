import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  mailboxForAddress,
  mailboxSummaries,
  requestedMailbox,
  TEAM_MAILBOXES,
} from "../astro/functions/operations/api/inbox/_mailboxes.js";
import {
  normaliseDraft,
  sameOriginMutation,
} from "../astro/functions/operations/api/inbox/_drafts.js";
import { mailboxRoutingReadiness } from "../astro/functions/operations/api/inbox/_readiness.js";
import {
  plainTextToHtml,
  safeProviderErrorCode,
  senderForIdentity,
  sendingCapability,
  sendingReadiness,
  threadHeaders,
  toOutboxSummary,
} from "../astro/functions/operations/api/inbox/_sending.js";
import {
  canonicalOperationsMailbox,
  OPERATIONS_TEST_MAILBOXES,
} from "../workers/mailboxes.js";

const migrationPath = (name) => fileURLToPath(new URL(`../workers/migrations/${name}`, import.meta.url));

test("Operations inbox exposes only the three approved aliases", () => {
  assert.deepEqual(
    TEAM_MAILBOXES.map(({ address }) => address),
    [
      "deandre@brisbanetvs.com",
      "kody@brisbanetvs.com",
      "tom@brisbanetvs.com",
    ],
  );
  assert.equal(mailboxForAddress(" TOM@brisbanetvs.com ")?.id, "tom");
  assert.equal(mailboxForAddress("team@brisbanetvs.com"), null);
  assert.equal(requestedMailbox("kody")?.address, "kody@brisbanetvs.com");
  assert.equal(requestedMailbox("all"), null);
});

test("mailbox summaries ignore unknown recipients and unsafe counts", () => {
  assert.deepEqual(
    mailboxSummaries([
      { address: "deandre@brisbanetvs.com", count: 4 },
      { address: "tom@brisbanetvs.com", count: -1 },
      { address: "unknown@brisbanetvs.com", count: 99 },
    ]).map(({ id, count }) => [id, count]),
    [["deandre", 4], ["kody", 0], ["tom", 0]],
  );
});

test("isolated receiver aliases map to the three canonical staff mailboxes", () => {
  assert.deepEqual(OPERATIONS_TEST_MAILBOXES, [
    "deandre@inbound.brisbanetvs.com",
    "kody@inbound.brisbanetvs.com",
    "tom@inbound.brisbanetvs.com",
  ]);
  assert.equal(
    canonicalOperationsMailbox(" KODY@inbound.brisbanetvs.com "),
    "kody@brisbanetvs.com",
  );
  assert.equal(canonicalOperationsMailbox("other@inbound.brisbanetvs.com"), null);
});

test("mailbox readiness distinguishes staged, isolated-test and root delivery", () => {
  assert.deepEqual(
    mailboxRoutingReadiness({}).status,
    "staged",
  );
  const testReady = mailboxRoutingReadiness({
    MAIL_TEST_RECEIVER_ENABLED: "true",
    MAIL_TEST_RECEIVER_DOMAIN: "inbound.brisbanetvs.com",
  });
  assert.equal(testReady.status, "test_ready");
  assert.equal(testReady.rootDeliveryActive, false);
  assert.equal(testReady.testReceiverActive, true);
  assert.equal(testReady.testDomain, "inbound.brisbanetvs.com");

  const active = mailboxRoutingReadiness({
    TEAM_INBOX_ENABLED: "true",
    MAIL_TEST_RECEIVER_ENABLED: "true",
  });
  assert.equal(active.status, "active");
  assert.equal(active.rootDeliveryActive, true);
  assert.equal(active.testReceiverActive, false);
  assert.equal(active.testDomain, null);
});

test("mail Worker uses exact inbound aliases with private storage and no sending binding", () => {
  const config = readFileSync(
    fileURLToPath(new URL("../workers/mail-wrangler.toml", import.meta.url)),
    "utf8",
  );
  for (const address of OPERATIONS_TEST_MAILBOXES) {
    assert.match(config, new RegExp(address.replaceAll(".", "\\.")));
  }
  assert.doesNotMatch(config, /\*\s*@|catch_all|send_email/i);
  assert.match(config, /binding = "INBOX_MAIL_RAW"/);
  assert.match(config, /binding = "OPERATIONS_DB"/);
  assert.match(config, /\[observability\][\s\S]*enabled = true/);
});

test("mail composer warns on unsaved work and supports keyboard save", () => {
  const script = readFileSync(
    fileURLToPath(new URL("../astro/src/scripts/operations-inbox.js", import.meta.url)),
    "utf8",
  );
  assert.match(script, /Discard unsaved changes\?/);
  assert.match(script, /event\.ctrlKey \|\| event\.metaKey/);
  assert.match(script, /requestSubmit\(saveDraftButton\)/);
  assert.match(script, /closeComposer\(\{ force: true \}\)/);
  assert.match(script, /Send this email now\?/);
  assert.match(script, /send_already_attempted/);
  assert.match(script, /Review delivery/);
  assert.match(script, /data-send-message/);
});

test("sending stays locked until both the feature flag and binding are present", () => {
  assert.deepEqual(sendingReadiness({}), {
    enabled: false,
    status: "onboarding_pending",
    detail: "Cloudflare Email Sending onboarding and a controlled live test are still required.",
  });
  assert.equal(sendingReadiness({ MAIL_SEND_ENABLED: "true" }).status, "binding_missing");
  assert.equal(sendingReadiness({
    MAIL_SEND_ENABLED: "true",
    OPERATIONS_EMAIL: { send() {} },
  }).enabled, true);
});

test("each permanent staff login maps to exactly one sender address", () => {
  assert.equal(senderForIdentity("DRDEANDREHYDE@GMAIL.COM")?.address, "deandre@brisbanetvs.com");
  assert.equal(senderForIdentity("kodycameron2000@gmail.com")?.address, "kody@brisbanetvs.com");
  assert.equal(senderForIdentity("tomdavie016@gmail.com")?.address, "tom@brisbanetvs.com");
  assert.equal(senderForIdentity("other@example.com"), null);

  const capability = sendingCapability({
    MAIL_SEND_ENABLED: "true",
    OPERATIONS_EMAIL: { send() {} },
  }, "tomdavie016@gmail.com");
  assert.equal(capability.send, true);
  assert.equal(capability.senderAddress, "tom@brisbanetvs.com");
});

test("outbound content escapes HTML and accepts only a bounded message-id header", () => {
  assert.equal(
    plainTextToHtml("<strong>Customer & TV</strong>"),
    '<div style="font-family:Arial,sans-serif;line-height:1.55;white-space:pre-wrap">&lt;strong&gt;Customer &amp; TV&lt;/strong&gt;</div>',
  );
  assert.deepEqual(threadHeaders("<message@example.com>"), {
    "In-Reply-To": "<message@example.com>",
    References: "<message@example.com>",
  });
  assert.equal(threadHeaders("message@example.com\r\nBcc: bad@example.com"), undefined);
  assert.equal(safeProviderErrorCode({ code: "E_SENDER_NOT_VERIFIED" }), "E_SENDER_NOT_VERIFIED");
  assert.equal(safeProviderErrorCode({ code: "private provider detail" }), "E_DELIVERY_FAILED");
});

test("outbox summaries expose safe delivery state without a full message body", () => {
  const summary = toOutboxSummary({
    id: "outbox-1",
    draft_id: "draft-1",
    from_address: "tom@brisbanetvs.com",
    to_address: "customer@example.com",
    subject: "Installation",
    plain_text: "A".repeat(400),
    status: "sent",
    requested_by: "tomdavie016@gmail.com",
    requested_at: "2026-07-24T01:00:00.000Z",
    updated_at: "2026-07-24T01:00:01.000Z",
    provider_message_id: "message-1",
  });
  assert.equal(summary.status, "sent");
  assert.equal(summary.preview.length, 220);
  assert.equal("plainText" in summary, false);
});

test("drafts accept exact Brisbane TVs sender aliases and reply metadata", () => {
  const draft = normaliseDraft({
    from: "KODY@brisbanetvs.com",
    to: "customer@example.com",
    subject: " Re: Installation ",
    plainText: "Thanks for your message.",
    threadId: "thread-123",
    inReplyTo: "<message@example.com>",
  });

  assert.deepEqual(draft, {
    fromAddress: "kody@brisbanetvs.com",
    toAddress: "customer@example.com",
    subject: "Re: Installation",
    plainText: "Thanks for your message.",
    status: "draft",
    threadId: "thread-123",
    inReplyTo: "<message@example.com>",
  });
});

test("drafts reject arbitrary or header-injected sender aliases", () => {
  const base = {
    to: "customer@example.com",
    subject: "Hello",
    plainText: "Message",
  };

  assert.equal(normaliseDraft({ ...base, from: "other@brisbanetvs.com" }), null);
  assert.equal(normaliseDraft({
    ...base,
    from: "tom@brisbanetvs.com\r\nBcc: attacker@example.com",
  }), null);
});

test("draft mutations accept same-origin requests and reject cross-site requests", () => {
  assert.equal(sameOriginMutation(new Request("https://brisbanetvs.com/operations/api/inbox/drafts", {
    method: "POST",
    headers: {
      origin: "https://brisbanetvs.com",
      "sec-fetch-site": "same-origin",
    },
  })), true);
  assert.equal(sameOriginMutation(new Request("https://brisbanetvs.com/operations/api/inbox/drafts", {
    method: "POST",
    headers: {
      origin: "https://attacker.example",
      "sec-fetch-site": "cross-site",
    },
  })), false);
});

test("mailbox migration adds deduplication, draft sender and inert outbox state", () => {
  const database = new DatabaseSync(":memory:");
  database.exec(readFileSync(migrationPath("0001_operations_intake.sql"), "utf8"));
  database.exec(readFileSync(migrationPath("0002_mail_inbox_ingest.sql"), "utf8"));
  database.exec(readFileSync(migrationPath("0009_mailbox_threads_outbox.sql"), "utf8"));

  const messageColumns = database.prepare("PRAGMA table_info(mail_messages)").all().map(({ name }) => name);
  const draftColumns = database.prepare("PRAGMA table_info(mail_drafts)").all().map(({ name }) => name);
  const outboxTable = database.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'mail_outbox'",
  ).get();
  const indexes = database.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'mail_messages'",
  ).all().map(({ name }) => name);

  assert.ok(messageColumns.includes("mailbox_address"));
  assert.ok(messageColumns.includes("read_at"));
  assert.ok(messageColumns.includes("ingest_key"));
  assert.ok(messageColumns.includes("reply_to_address"));
  assert.ok(messageColumns.includes("envelope_from_address"));
  assert.ok(draftColumns.includes("from_address"));
  assert.ok(draftColumns.includes("thread_id"));
  assert.ok(draftColumns.includes("reply_to_message_id"));
  assert.equal(outboxTable.name, "mail_outbox");
  assert.ok(indexes.includes("idx_mail_messages_ingest_key"));
});

test("outbox unique draft claim prevents duplicate delivery attempts", () => {
  const database = new DatabaseSync(":memory:");
  database.exec(readFileSync(migrationPath("0001_operations_intake.sql"), "utf8"));
  database.exec(readFileSync(migrationPath("0002_mail_inbox_ingest.sql"), "utf8"));
  database.exec(readFileSync(migrationPath("0009_mailbox_threads_outbox.sql"), "utf8"));
  database.prepare(
    `INSERT INTO mail_drafts (
      id, to_address, subject, plain_text, status, created_at, updated_at,
      created_by, from_address, thread_id, reply_to_message_id, updated_by
    ) VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, '', '', ?)`,
  ).run(
    "draft-1",
    "customer@example.com",
    "Installation",
    "Thanks",
    "2026-07-24T01:00:00.000Z",
    "2026-07-24T01:00:00.000Z",
    "tomdavie016@gmail.com",
    "tom@brisbanetvs.com",
    "tomdavie016@gmail.com",
  );

  const claim = database.prepare(
    `INSERT INTO mail_outbox (
      id, draft_id, from_address, to_address, subject, plain_text, status,
      requested_by, requested_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'sending', ?, ?, ?)
    ON CONFLICT(draft_id) DO NOTHING
    RETURNING id`,
  );
  assert.equal(claim.get(
    "outbox-1",
    "draft-1",
    "tom@brisbanetvs.com",
    "customer@example.com",
    "Installation",
    "Thanks",
    "tomdavie016@gmail.com",
    "2026-07-24T01:00:01.000Z",
    "2026-07-24T01:00:01.000Z",
  ).id, "outbox-1");
  assert.equal(claim.get(
    "outbox-2",
    "draft-1",
    "tom@brisbanetvs.com",
    "customer@example.com",
    "Installation",
    "Thanks",
    "tomdavie016@gmail.com",
    "2026-07-24T01:00:02.000Z",
    "2026-07-24T01:00:02.000Z",
  ), undefined);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM mail_outbox").get().count, 1);
});

test("production config keeps sending off until onboarding and restricted binding review", () => {
  for (const relativePath of ["../wrangler.toml", "../astro/wrangler.toml"]) {
    const config = readFileSync(
      fileURLToPath(new URL(relativePath, import.meta.url)),
      "utf8",
    );
    assert.match(config, /MAIL_SEND_ENABLED = "false"/);
    assert.doesNotMatch(config, /send_email/);
  }

  const sendRoute = readFileSync(
    fileURLToPath(new URL(
      "../astro/functions/operations/api/inbox/drafts/[id]/send.js",
      import.meta.url,
    )),
    "utf8",
  );
  assert.match(sendRoute, /ON CONFLICT\(draft_id\) DO NOTHING/);
  assert.match(sendRoute, /senderForIdentity/);
  assert.match(sendRoute, /OPERATIONS_EMAIL\.send/);
  assert.match(sendRoute, /email_sending_unavailable/);

  const draftRoute = readFileSync(
    fileURLToPath(new URL(
      "../astro/functions/operations/api/inbox/drafts/[id].js",
      import.meta.url,
    )),
    "utf8",
  );
  assert.match(draftRoute, /draft_send_attempted/);
});
