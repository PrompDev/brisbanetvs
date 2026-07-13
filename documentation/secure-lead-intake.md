# Secure lead intake

The public form endpoints now write canonical lead records to the
brisbanetvs-operations D1 database. This is the operational copy used by
the staff portal. It does not send email, call n8n, or call Twenty CRM.
Website leads are also queued for a private, server-to-server copy into the
`Website Leads` tab of the existing Brisbane TVs lead spreadsheet.

The D1 schema is split across two migrations:

- [workers/migrations/0001_operations_intake.sql](../workers/migrations/0001_operations_intake.sql)
  creates contacts, leads, uploads, intake events, sync requests and the
  unused mailbox foundation;
- [workers/migrations/0003_website_sheet_delivery.sql](../workers/migrations/0003_website_sheet_delivery.sql)
  creates the retry-safe website-to-Sheet delivery ledger and index.

Together they create:

- contacts, leads, lead_uploads, and intake_events;
- sync_requests for signed Apps Script batch replay protection;
- lead_deliveries for retry-safe website-to-Sheet delivery state (migration
  0003, not migration 0001);
- mail_messages, mail_drafts, and mail_attachments as an empty mailbox
  foundation only.

leads is the portal's canonical query surface. Its stable fields are id,
source, external_id, received_at, received_day, full_name, email, phone,
postcode, platform, tv_size, and status. The unique pair is
(source, external_id).

## Public form endpoints

- POST /api/website-lead accepts the multipart photo-quote form (and legacy
  URL-encoded submissions) and stores the lead plus any allowed image uploads.
- POST /api/n8n/lead accepts the existing JSON footer and other compact forms.
  Its historical name remains for browser compatibility; it no longer
  forwards submissions to n8n.

All public forms generate one stable `submission_id` per enquiry attempt.
D1 uses that value as the website lead's external ID, so a browser retry cannot
create a second lead. After D1 accepts the lead, the Worker queues a private
copy for Google Apps Script. The form does not receive the Apps Script secret
and does not post customer details directly to Google.

## Website leads copied to Google Sheets

Website lead delivery uses the existing private Apps Script receiver and a
separate `Website Leads` tab. Keeping website rows out of the Meta `Leads` tab
prevents the existing Sheet-to-D1 synchroniser from importing the same website
lead back into Operations as a duplicate.

- Sheet row ID: `website:<submission_id>`
- Immediate delivery: Cloudflare `waitUntil()` after the D1 commit
- Recovery: scheduled Worker retry every five minutes
- Recovery cadence: eight fast attempts with bounded exponential backoff,
  then a slow retry every six hours until delivery succeeds
- Idempotency: Apps Script deduplicates the stable Sheet row ID
- Reconciliation: each lead and initial delivery row commit together, and the
  scheduler also repairs any website lead missing a delivery ledger row
- Delivery visibility: aggregate delivered, pending, failed and missing-ledger
  counts appear on `/operations/analytics/`

The Worker requires:

- `GOOGLE_APPS_SCRIPT_URL` as a non-secret Worker variable;
- `GOOGLE_APPS_SCRIPT_SECRET` as an encrypted Worker secret matching the
  receiver's existing `INGEST_SECRET` Script Property.

No contact values are stored in the retry table. It contains only a lead
reference, status, retry timestamps and a bounded error code.

The Sheet keeps its compact existing schema. Calculator TV count, TV brand,
selected add-ons and uploaded-photo count are appended to the `notes` cell;
the package label remains in the service column.

Production was checked before activation and had no pre-existing website
leads, so no historical backfill is required. Do not bulk-copy old rows through
the receiver without first suppressing its calendar-call automation.

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

The JSON body is bounded to 15 leads and 512 KiB. Fifteen keeps the signed
Sheet-to-D1 sync below the Workers Free-plan D1 query ceiling because each
canonical lead is written with three statements:

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

2. Set both Worker secrets interactively:

   ~~~powershell
   npx wrangler secret put LEAD_SYNC_SECRET --config workers/wrangler.toml
   npx wrangler secret put GOOGLE_APPS_SCRIPT_SECRET --config workers/wrangler.toml
   ~~~

3. Deploy the Worker:

   ~~~powershell
   npx wrangler deploy --config workers/wrangler.toml
   ~~~

4. Store `GOOGLE_APPS_SCRIPT_SECRET` in the Brisbane TVs Pages project as
   well. The Pages preview fallback uses the same canonical intake path; the
   production custom domain is still owned by the standalone Worker route.

5. Deploy Pages, then run one labelled, retry-safe test. Confirm one D1 lead,
   one `Website Leads` row and a delivered queue state before deleting the
   synthetic record. Check the protected Operations page before considering
   the integration complete.
