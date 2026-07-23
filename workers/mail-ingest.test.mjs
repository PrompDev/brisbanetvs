import { receiveInboundMail } from "./mail-ingest.js";

const source = [
  "From: sender@example.test",
  "To: deandre@brisbanetvs.com",
  "Subject: Test inbox",
  "Message-ID: <test-message@example.test>",
  "Content-Type: text/plain; charset=utf-8",
  "",
  "Hello team.",
].join("\r\n");

function createMessage({
  raw = source,
  rawSize,
  from = "sender@example.test",
  to = "deandre@brisbanetvs.com",
  headers = {},
} = {}) {
  const bytes = new TextEncoder().encode(raw);
  const result = { rejection: "" };
  return {
    result,
    message: {
      raw: new ReadableStream({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      }),
      rawSize: rawSize ?? bytes.byteLength,
      from,
      to,
      headers: new Headers({
        subject: "Test inbox",
        "message-id": "<test-message@example.test>",
        ...headers,
      }),
      setReject(reason) {
        result.rejection = reason;
      },
    },
  };
}

function createEnvironment({
  failPut = false,
  failRun = false,
  duplicate = false,
  referencedThreadId = "",
} = {}) {
  const objects = [];
  const writes = [];
  const deleted = [];
  const reads = [];
  return {
    objects,
    writes,
    deleted,
    reads,
    env: {
      INBOX_MAIL_RAW: {
        put: async (key, body, options) => {
          if (failPut) throw new Error("storage failure");
          objects.push({ key, size: body.byteLength, type: options.httpMetadata.contentType });
        },
        delete: async (key) => {
          deleted.push(key);
        },
      },
      OPERATIONS_DB: {
        prepare: (sql) => ({
          bind: (...args) => ({
            first: async () => {
              reads.push({ sql, args });
              if (duplicate && sql.includes("WHERE ingest_key = ?")) return { id: "existing-message" };
              if (referencedThreadId && sql.includes("message_id IN")) {
                return { thread_id: referencedThreadId };
              }
              return null;
            },
            run: async () => {
              if (failRun) throw new Error("database failure");
              writes.push({ sql, args });
              return { success: true };
            },
          }),
        }),
      },
    },
  };
}

const mailboxIngestKeys = [];
for (const mailbox of [
  "deandre@brisbanetvs.com",
  "kody@brisbanetvs.com",
  "tom@brisbanetvs.com",
]) {
  const successfulMail = createMessage({ to: mailbox });
  const successfulEnv = createEnvironment();
  await receiveInboundMail(successfulMail.message, successfulEnv.env);
  if (
    successfulMail.result.rejection
    || successfulEnv.objects.length !== 1
    || successfulEnv.writes.length !== 1
    || !successfulEnv.writes[0].args.includes("Hello team.")
    || !successfulEnv.writes[0].args.includes(mailbox)
  ) {
    throw new Error(`mail ingest did not store the expected safe record for ${mailbox}`);
  }
  mailboxIngestKeys.push(successfulEnv.writes[0].args.at(-1));
}
if (
  new Set(mailboxIngestKeys).size !== 3
  || !mailboxIngestKeys.every((key) => /^(deandre|kody|tom)@brisbanetvs\.com:[a-f0-9]{64}$/.test(key))
) {
  throw new Error("mail ingest deduplication was not scoped to each approved mailbox");
}

const replyToMail = createMessage({
  from: "bounce+123@platform.example",
  raw: [
    "From: Booking Platform <noreply@platform.example>",
    "Reply-To: Customer <customer@example.test>",
    "To: deandre@brisbanetvs.com",
    "Subject: Customer enquiry",
    "Message-ID: <platform-message@example.test>",
    "Content-Type: text/plain; charset=utf-8",
    "",
    "Please reply to the customer.",
  ].join("\r\n"),
});
const replyToEnv = createEnvironment();
await receiveInboundMail(replyToMail.message, replyToEnv.env);
const replyToWrite = replyToEnv.writes[0]?.args || [];
if (
  replyToMail.result.rejection
  || replyToWrite[3] !== "noreply@platform.example"
  || replyToWrite[4] !== "customer@example.test"
  || replyToWrite[5] !== "bounce+123@platform.example"
  || !replyToEnv.reads.some(({ sql, args }) => (
    sql.includes("SELECT id FROM contacts") && args[0] === "customer@example.test"
  ))
) {
  throw new Error("reply-to, visible from and SMTP envelope sender were not kept distinct");
}

const unknownMailboxMail = createMessage({ to: "unknown@brisbanetvs.com" });
const unknownMailboxEnv = createEnvironment();
await receiveInboundMail(unknownMailboxMail.message, unknownMailboxEnv.env);
if (!unknownMailboxMail.result.rejection || unknownMailboxEnv.objects.length || unknownMailboxEnv.writes.length) {
  throw new Error("unknown mailbox was not rejected before storage");
}

const duplicateMail = createMessage();
const duplicateEnv = createEnvironment({ duplicate: true });
await receiveInboundMail(duplicateMail.message, duplicateEnv.env);
if (duplicateMail.result.rejection || duplicateEnv.objects.length || duplicateEnv.writes.length) {
  throw new Error("duplicate inbound message was not accepted without a second write");
}

const replyMail = createMessage({
  raw: [
    "From: sender@example.test",
    "To: deandre@brisbanetvs.com",
    "Subject: Re: Test inbox",
    "Message-ID: <reply-message@example.test>",
    "In-Reply-To: <original-message@example.test>",
    "References: <original-message@example.test>",
    "Content-Type: text/plain; charset=utf-8",
    "",
    "A threaded reply.",
  ].join("\r\n"),
});
const replyEnv = createEnvironment({ referencedThreadId: "thread-existing" });
await receiveInboundMail(replyMail.message, replyEnv.env);
if (
  replyMail.result.rejection
  || replyEnv.writes.length !== 1
  || replyEnv.writes[0].args[1] !== "thread-existing"
  || !replyEnv.reads.some(({ sql, args }) => (
    sql.includes("WHERE mailbox_address = ? AND message_id IN")
    && args[0] === "deandre@brisbanetvs.com"
  ))
) {
  throw new Error("reply did not resolve to an existing thread in the same mailbox");
}

const malformedMimeMail = createMessage({
  raw: [
    "Content-Type: multipart/mixed; boundary=broken",
    "",
    "--broken",
    "Content-Type: text/plain; charset=utf-8",
    "",
    "Incomplete multipart body",
  ].join("\r\n"),
});
const malformedMimeEnv = createEnvironment();
await receiveInboundMail(malformedMimeMail.message, malformedMimeEnv.env);
if (malformedMimeMail.result.rejection || malformedMimeEnv.objects.length !== 1 || malformedMimeEnv.writes.length !== 1) {
  throw new Error("malformed MIME was not handled safely");
}

const oversizedMail = createMessage({ rawSize: 8 * 1024 * 1024 + 1 });
const oversizedEnv = createEnvironment();
await receiveInboundMail(oversizedMail.message, oversizedEnv.env);
if (!oversizedMail.result.rejection || oversizedEnv.objects.length || oversizedEnv.writes.length) {
  throw new Error("oversized mail was not rejected before storage");
}

const brokenStorageMail = createMessage();
const brokenStorageEnv = createEnvironment({ failPut: true });
await receiveInboundMail(brokenStorageMail.message, brokenStorageEnv.env);
if (!brokenStorageMail.result.rejection || brokenStorageEnv.writes.length) {
  throw new Error("R2 failure did not reject without a database write");
}

const brokenDatabaseMail = createMessage();
const brokenDatabaseEnv = createEnvironment({ failRun: true });
await receiveInboundMail(brokenDatabaseMail.message, brokenDatabaseEnv.env);
if (!brokenDatabaseMail.result.rejection || !brokenDatabaseEnv.deleted.length) {
  throw new Error("D1 failure did not remove the stored raw message");
}

console.log("mail-ingest test passed");
