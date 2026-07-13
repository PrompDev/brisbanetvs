import { receiveInboundMail } from "./mail-ingest.js";

const source = [
  "From: sender@example.test",
  "To: team@brisbanetvs.com",
  "Subject: Test inbox",
  "Message-ID: <test-message@example.test>",
  "Content-Type: text/plain; charset=utf-8",
  "",
  "Hello team.",
].join("\r\n");

function createMessage({ raw = source, rawSize } = {}) {
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
      from: "sender@example.test",
      to: "team@brisbanetvs.com",
      headers: new Headers({
        subject: "Test inbox",
        "message-id": "<test-message@example.test>",
      }),
      setReject(reason) {
        result.rejection = reason;
      },
    },
  };
}

function createEnvironment({ failPut = false, failRun = false } = {}) {
  const objects = [];
  const writes = [];
  const deleted = [];
  return {
    objects,
    writes,
    deleted,
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
            first: async () => null,
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

const successfulMail = createMessage();
const successfulEnv = createEnvironment();
await receiveInboundMail(successfulMail.message, successfulEnv.env);
if (
  successfulMail.result.rejection
  || successfulEnv.objects.length !== 1
  || successfulEnv.writes.length !== 1
  || !successfulEnv.writes[0].args.includes("Hello team.")
) {
  throw new Error("mail ingest did not store the expected safe record");
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
