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
