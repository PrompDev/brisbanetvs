# Secure lead intake

The public form endpoints now write canonical lead records to the
brisbanetvs-operations D1 database. This is the operational copy used by
the staff portal. It does not send email, call n8n, or call Twenty CRM.

The D1 migration is at
[workers/migrations/0001_operations_intake.sql](../workers/migrations/0001_operations_intake.sql).
It creates:

- contacts, leads, lead_uploads, and intake_events;
- sync_requests for signed Apps Script batch replay protection;
- mail_messages, mail_drafts, and mail_attachments as an empty mailbox
  foundation only.

leads is the portal's canonical query surface. Its stable fields are id,
source, external_id, received_at, received_day, full_name, email, phone,
postcode, platform, tv_size, and status. The unique pair is
(source, external_id).

## Public form endpoints

- POST /api/website-lead accepts the existing multipart or URL-encoded
  website forms and stores the lead plus any allowed image uploads.
- POST /api/n8n/lead accepts the existing JSON quote and footer payloads.
  Its historical name remains for browser compatibility; it no longer
  forwards submissions to n8n.

Image files are stored with an opaque R2 path:

~~~
website-leads/<opaque lead UUID>/<opaque upload UUID>.<extension>
~~~

No customer name, phone number, suburb, original filename, or custom
metadata is put in R2. Original file names remain only in the protected D1
record. /api/lead-upload is intentionally not a public route. Future staff
file retrieval must be added behind the Operations Access policy.

## Apps Script batch sync

Apps Script can post historical and future Sheet leads to:

~~~
POST https://brisbanetvs.com/api/lead-sync
Content-Type: application/json
~~~

Set LEAD_SYNC_SECRET as a Worker secret. It must never be added to
wrangler.toml, Apps Script source, or a browser.

Every request needs these headers:

| Header | Value |
| --- | --- |
| x-lead-sync-timestamp | Current UTC Unix time in seconds |
| x-lead-sync-id | New 16–128 character idempotency ID for this batch |
| x-lead-sync-signature | Lowercase hexadecimal HMAC-SHA-256 signature |

Sign the exact UTF-8 request body, without reformatting it after signing:

~~~
<timestamp>.<idempotency ID>.<raw JSON body>
~~~

For Apps Script, the signing sequence is:

~~~javascript
const rawBody = JSON.stringify({ leads });
const timestamp = String(Math.floor(Date.now() / 1000));
const requestId = Utilities.getUuid();
const material = timestamp + "." + requestId + "." + rawBody;
const bytes = Utilities.computeHmacSha256Signature(
  material,
  LEAD_SYNC_SECRET,
  Utilities.Charset.UTF_8,
);
const signature = bytes
  .map((byte) => ((byte + 256) % 256).toString(16).padStart(2, "0"))
  .join("");
~~~

The JSON body is bounded to 100 leads and 512 KiB:

~~~json
{
  "leads": [
    {
      "external_id": "stable-sheet-or-provider-record-id",
      "received_at": "2026-07-14T01:00:00.000Z",
      "source": "google_apps_script",
      "platform": "meta",
      "full_name": "Example customer",
      "email": "example@example.com",
      "phone": "0400 000 000",
      "postcode": "4000",
      "tv_size": "75",
      "suburb": "Brisbane",
      "service": "TV mounting",
      "wall_type": "plasterboard",
      "preferred_date": "asap",
      "message": "Optional customer note",
      "page_url": "https://brisbanetvs.com/quote/",
      "campaign": "Optional campaign"
    }
  ]
}
~~~

external_id and ISO received_at are required. The accepted aliases are
name/full_name, mobile/phone, tvsize/tv_size, wall/wall_type, and
notes/message.

The timestamp is accepted for five minutes. Reusing the same ID with the
same body returns a successful replayed: true response without duplicate
lead records. Reusing the ID with a different body returns 409.

## Deployment order

1. Apply the remote D1 migration:

   ~~~powershell
   npx wrangler d1 migrations apply brisbanetvs-operations --remote --config workers/wrangler.toml
   ~~~

2. Set the Worker secret interactively:

   ~~~powershell
   npx wrangler secret put LEAD_SYNC_SECRET --config workers/wrangler.toml
   ~~~

3. Deploy the Worker:

   ~~~powershell
   npx wrangler deploy --config workers/wrangler.toml
   ~~~

4. Only then deploy the Apps Script update and send a small signed test
   batch. Check the protected Operations page before retiring the Sheet as
   the original source.
