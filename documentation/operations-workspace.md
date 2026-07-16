# Operations workspace

`/operations/` is the private staff workspace for Brisbane TVs. It is not a
customer-facing website or a replacement for the public quote form.

## Safe port from `brisbanetvs-ops`

The operations design is tracked from
`https://github.com/bigdonnnybra/brisbanetvs-ops` at commit `831207d`. Its dark
navigation, compact overview metrics, pipeline and panel layout are now the
visual basis of the live Operations portal. The safe port reuses its screen
structure and workflow concepts for calls, quotes, jobs, stock, finance and an
approval-gated SMS outbox. It does not import the demo pricing data.

The port does not import the repository's Node HTTP server, local SQLite
database, runtime-created schema, demo customer records or seeded integration
statuses. It also does not copy its root `/api/*` routes, unsigned PBX and
Stripe webhooks, or direct Android gateway send handler. Those parts do not
fit the existing Cloudflare architecture or its customer-data controls.

Only the existing Brisbane TVs Google reporting is added to that dashboard.
No telephony, payment, SMS, social, AI or other connector from the standalone
repository becomes live merely because its design appears in Operations.

### Dark mode

Operations opens in a low-glare dark theme based on the GPT app palette. The
sun/moon control at the bottom of the desktop navigation, or in the mobile
header, switches between dark and light mode. The choice is saved in that
browser and applies to every Operations page; it does not affect the public
Brisbane TVs website.

The current systems remain authoritative:

| Data or function | Authoritative system |
| --- | --- |
| Contacts, enquiries and website attribution | Operations D1 |
| Facebook, Instagram and website lead follow-up | Existing private Google Sheet and Calendar Calls workflow |
| Uploaded quote photos and stored inbound mail | Private R2 buckets, indexed by D1 |
| Website reporting | Consent-aware GA4, Search Console and aggregate D1 lead counts |
| Staff identity and portal access | Cloudflare Access |

The new operations tables reference the existing D1 lead IDs. They do not
create another lead register or another Sheet-to-Calendar path.

### Updating from Tom's repository

Tom's repository is treated as an upstream design source, not as a deployable
backend dependency. When Tom publishes another commit:

1. Fetch or clone the repository and record the exact new commit ID.
2. Review its dashboard HTML, styles and view changes against the pinned commit.
3. Port the useful presentation and workflow changes into the Astro Operations
   pages while retaining Cloudflare Access, Pages Functions, D1 and the existing
   read-only boundaries.
4. Do not copy its local Node server, SQLite database, demo data, unsigned
   webhooks or direct send/write handlers.
5. Run the Operations API tests, Astro build and an authenticated visual check,
   then update the pinned commit in this document.

This keeps later updates small and reviewable while Tom is still iterating.

## Where to work

| Page | Purpose | Customer information shown? |
| --- | --- | --- |
| `/operations/` | Fast daily overview: intake health and aggregate lead counts. | No |
| `/operations/workspace/` | Read-only calls, quotes, jobs, stock, finance, social and connector views. | Yes, after staff access check |
| `/operations/leads/` | Master list of customer contacts and enquiries. | Yes, after staff access check |
| `/operations/inbox/` | Incoming team mail, saved reply drafts and invoice notes. | Yes, after staff access check |
| `/operations/analytics/` | Aggregate, consent-aware website activity from GA4. | No visitor or lead identity |

The public website, private portal, lead register, inbox and analytics are
separate on purpose. The overview is quick to scan, while customer data stays
in the pages where it is actually needed.

## Already connected

- Public website and lead-sheet submissions are stored in the protected
  Operations D1 database. The lead register exposes the stable external lead
  ID plus the retained quote, service, TV, wall, date, notes, campaign,
  consent and stored-photo-count fields to approved staff.
- Website submissions are copied server-side into the private spreadsheet's
  normal `Leads` tab, with stable IDs and a five-minute retry queue. They enter
  the same calendar follow-up workflow as Facebook and Instagram leads, while
  an origin guard prevents the Sheet sync from creating a second D1 record.
- Staff APIs sit behind Cloudflare Access and also verify the signed Access
  token before reading any customer data.
- Lead-sheet sync is HMAC-signed, time-limited and replay-safe.
- Customer files and raw inbound mail live in private R2 buckets. There is no
  public download route.
- Pages Functions are set to **fail closed**. If the Functions allowance is
  exhausted, an error is shown instead of falling through to a static asset.
- Drafts are saved in D1 only. There is no send endpoint, email binding or
  automatic reply.

The safe port adds nine empty D1 tables and one Access-verified read API for
the new workspace views. It does not change the existing connections or add a
live telephony, SMS, payment, transcription, social-publishing or AI provider.

## Remaining connectors and read-only modules

Provider-backed modules must remain read-only or show `Not connected` until
their authenticated backend and provider callbacks have been configured and
tested. A screen or database table does not make a connector live.

| Module | Current state | Required before write or send actions are enabled |
| --- | --- | --- |
| Lead pipeline | Reads the canonical D1 leads | Access-verified status updates with an audit event |
| Calls and PBX | Empty D1 records and read view; no provider connected | Voice provider, signed callbacks, provider call IDs and phone-to-lead matching |
| Call recordings and transcripts | Private-reference fields and read view; no transcription provider connected | Recording decision, retention rule, private storage and authenticated callbacks |
| Quotes, jobs, stock and finance | Empty D1 tables and read views | Access-verified write APIs, audit events and field-level validation |
| SMS outbox | Empty approval-state table and read view; sending disabled | SMS transport, authenticated dispatch, staff approval, idempotency and delivery callbacks |
| Stripe reconciliation | Not connected | Stripe account integration, signed raw-body webhook verification and invoice/payment mapping |
| Inbox | Storage and draft interface are ready; live routing is off | Approved Email Routing migration; outbound delivery remains a separate change |
| Social publishing | Not connected | Provider accounts, scoped credentials and an explicit approval/send workflow |
| Dave automation | No AI or calling provider connected | Defined actions, service credentials, audit logging and enforced approval gates |

## Access and webhook boundary

Cloudflare Access protects `/operations/*`. Every staff API that reads customer
data or changes operational state must also verify the signed Access assertion.
The verified staff identity supplies fields such as `approved_by`; the browser
must not choose or assert that identity.

Phone, Stripe and other provider callbacks cannot depend on an interactive
Access session. Put them on dedicated webhook routes and validate the
provider's signature before parsing or storing an event. Each route also needs
a bounded body, replay protection, a unique provider event ID and rate
limiting. Webhook retries must return the previously recorded result without
creating another call, payment activity or SMS.

Customer-data responses use private, no-store headers. Portal pages should
request only the current view and use pagination instead of loading every
lead, transcript, invoice and message into the browser at startup. Gateway and
provider credentials stay in server-side encrypted secrets and never appear
in browser code, D1 status rows or logs.

## Phone setup decisions

Tom must make these decisions before phone actions can be enabled:

1. **SMS sender:** use the Pixel's existing SIM and number through an Android
   gateway, or use a cloud SMS provider and provider number.
2. **Voice number:** keep the current business number with call diversion,
   port it to the chosen voice provider, or use a new provider number.
3. **Recording and transcription:** store call metadata only, or record and
   transcribe calls. If recording is enabled, set a retention period and a
   deletion process for recordings and transcripts.

## Phone setup checklist

### Common setup

- [ ] Record the three decisions above in the project notes.
- [ ] Choose one voice provider and one SMS transport. They may be the same
  provider, but they do not have to be.
- [ ] Add provider credentials through the Cloudflare secret store. Do not put
  them in source, Wrangler variables, D1 or the browser.
- [ ] Add D1 records for calls and messages that reference the existing text
  lead ID. Store a unique provider call, event or message ID on every record.
- [ ] Normalise Australian phone numbers to E.164 before matching or sending.
- [ ] Place staff read, draft and approval endpoints under
  `/operations/api/*` and apply the existing Access verifier.
- [ ] Place provider callbacks on dedicated signed webhook routes. Validate
  the exact raw request required by the selected provider.
- [ ] Make message approval an atomic `draft` to `queued` change. Dispatch in
  a background queue with a stable idempotency key; a repeated click must not
  send a second SMS.
- [ ] Store delivery, failure and reply callbacks against the provider message
  ID. Do not mark an SMS delivered after the initial send request alone.
- [ ] Keep phone numbers, message bodies, transcripts and recording addresses
  out of analytics events and routine logs.

### Pixel SIM SMS option

- [ ] Install an Android SMS gateway that supports an authenticated HTTPS send
  API and returns a stable message ID.
- [ ] Select the correct SIM, grant SMS permission and confirm the phone can
  send a normal test message.
- [ ] Exempt the gateway from Android battery optimisation and allow required
  background activity.
- [ ] Provide an always-on HTTPS relay or tunnel. A Cloudflare Worker cannot
  call a phone-only Tailscale address directly.
- [ ] Protect the relay with service-to-service authentication and a separate
  mandatory gateway credential. Reject plain HTTP and requests without both
  checks.
- [ ] Add a gateway health check that reports only availability and last
  successful contact. It must not return its credential or recent messages.

### Cloud SMS provider option

- [ ] Complete the provider's business verification and number setup.
- [ ] Configure the approved sender or provider number and confirm Australian
  messaging support for the intended message type.
- [ ] Configure signed delivery and inbound-message callbacks.
- [ ] Restrict the provider credential to the required messaging operations
  where the provider supports scoped credentials.

### Voice and PBX

- [ ] Complete the keep, port, divert or replace decision for the current
  business number before changing live call routing.
- [ ] Configure the Pixel as the provider's mobile endpoint or softphone if
  calls should ring there.
- [ ] Add signed call-status callbacks and a unique provider call ID. A replay
  of a completed-call callback must update the same call record.
- [ ] Match caller and recipient numbers to canonical contacts after E.164
  normalisation. A provider callback cannot be expected to know an internal
  D1 lead ID.
- [ ] If recording is approved, keep recordings private, store only protected
  object references and apply the selected deletion schedule.
- [ ] If transcription is approved, send recordings only to the selected
  provider and store transcripts behind the Operations Access boundary.

### Acceptance checks

- [ ] An unauthenticated request cannot read a lead, approve a message or
  change an operational record.
- [ ] A callback with a missing or invalid provider signature is rejected and
  does not alter D1.
- [ ] One labelled test call creates one call record and links to the expected
  lead by phone number. Replaying its callback creates no duplicate.
- [ ] One labelled SMS to Tom's own number creates one queued item, one provider
  message ID and one final delivery state. Repeating the approval request sends
  nothing else.
- [ ] If replies are enabled, a reply attaches to the correct conversation and
  does not create a new lead.
- [ ] If recordings are enabled, the test recording and transcript follow the
  selected access and deletion rules.

Do not change live call diversion, port a number or expose the Pixel gateway
until the labelled tests pass and Tom approves the cutover.

## Website analytics and lead signals

GA4 and Search Console reporting are connected. Public GA4 tracking waits for
visitor consent and records aggregate use plus successful `generate_lead`
events; names, emails, phone numbers and form answers are never sent to GA4.
The Analytics page labels these figures as consented traffic and uses the GA4
Realtime API for a separate last-30-minutes collection health signal. Saved
lead counts come from D1 and include every accepted enquiry regardless of the
visitor's analytics choice.

The primary GA4 period is the last 28 complete days (`27daysAgo` through
`yesterday`). Today is shown separately as provisional because standard GA4
reports can continue processing after activity occurs. A session health panel
compares `sessions` with `session_start` event counts and shows how many days
actually contain consented visits. This distinguishes collection or processing
issues from a quiet period.

Search Console uses a final 28-day window ending three days ago and compares it
with the preceding 28 days. Page-only rows supply clicks, impressions, CTR and
average position; a separate query-plus-page report adds the privacy-filtered
queries behind each page's visibility. The page queue combines those signals
with consented GA4 landing sessions and highlights pages that are shown but not
clicked, close to page one, low in CTR or gaining visibility. Search impressions
are result appearances, not visits, and therefore must not be expected to match
consented GA4 sessions.

Facebook/Instagram campaign attribution is retained for the browser session,
so a visitor can move from an ad landing page to `/quote/` without losing the
source, campaign or first landing page attached to the saved lead. The protected
Analytics page combines consent-aware traffic with aggregate actual-lead counts
from D1, including source, privacy-filtered campaign labels, lead pages and
website-to-Sheet delivery health.

## Team inbox: ready, but not switched over

The inbox backend is deployed and safe to use once inbound routing is approved:

- A Cloudflare Worker accepts routed mail, stores raw MIME privately in the
  dedicated mail bucket, and stores only safe text/metadata for staff review.
- It does not forward, reply, send, or make attachments downloadable.
- Incoming mail is limited in size and failed storage is rejected rather than
  silently dropped.
- Staff can already save response, thank-you or invoice drafts. Saving a draft
  never sends it.

Cloudflare Email Routing remains **off**. The existing domain MX records and
business mail provider have not been changed, so `team@brisbanetvs.com` is not
yet receiving through this system.

Turning it on is a separate live-mail migration: Cloudflare would add root MX,
SPF and DKIM records, and a routing rule would direct `team@` to the Worker.
That can affect every address at the domain, so do not enable it without an
explicit approval, a current-mail test, and a rollback plan.

When outbound mail is approved later, transactional messages (such as a
contact acknowledgement or invoice) can use Cloudflare Email Service with a
human review/send step. Promotions are different: only contacts with recorded
consent may be used, and they need unsubscribe handling and a suitable
marketing platform. The current lead data has no marketing-consent records.

## Ongoing checks

- Keep the Google Sheet and its Apps Script editor/share list restricted. D1
  is the secure operational mirror, but the Sheet is still a source copy of
  customer information.
- Rotate the Apps Script sync secret if a person with script-edit access
  leaves.
- Do not change the Cloudflare Access allow-list casually; it protects the
  customer register, inbox and analytics APIs.
- Public enquiry forms remain public by design. Honeypot and rate limiting are
  active; add Cloudflare Turnstile before expanding campaigns if spam becomes a
  problem.
