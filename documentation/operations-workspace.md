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

The Operations mailbox follows the split-view interaction pattern from
[Cloudflare Agentic Inbox](https://github.com/cloudflare/agentic-inbox) at
commit `48039bb6785af34e592c2966f87cde2b255c4c80` (Apache-2.0). Only the
mailbox layout and workflow ideas were ported. Its React, Durable Object,
Workers AI, MCP and shared-all-mailboxes backend were not copied or deployed.
The existing Access/D1/private-R2 boundary remains authoritative.

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

The private `/operations/*` routes are also excluded from the customer
analytics feedback loop. `OperationsLayout` does not load the public analytics
client, the client refuses to start on an Operations path if it is included by
mistake, GA4 report requests exclude Operations landing sessions, and returned
page-path data is filtered again before display. In analytics tables, `/` is
labelled `Homepage (/)`; it means the public `brisbanetvs.com/` homepage.

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
- Drafts are saved in D1 only and retain the selected DeAndre, Kody or Tom
  sender plus reply-thread metadata. There is no send endpoint, email binding
  or automatic reply.

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
| Inbox | Three-address storage, threaded reader and draft interface are ready; live routing is off | Apply migration `0009`, deploy, then complete the approved Email Routing migration; outbound delivery remains a separate change |
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

The Analytics page is governed by
[`ANALYTICS-DESIGN-CERTIFICATE.md`](./ANALYTICS-DESIGN-CERTIFICATE.md). New
content must justify which improvement decision it supports, use the stable
definitions in that certificate, and remain readable in both themes and at a
390 px viewport. The required order is Site pulse, Improvement loop, Do next,
Attention, Acquisition, collapsed reporting health, then definitions and
privacy.

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

Each queue card is a human-controlled agent handoff. It carries the live URL,
a deterministic source-file hint where the route is known, the current
baseline, a hypothesis to verify, one focused change and a success rule. The
copy action produces a complete Codex task that preserves the Operations
analytics exclusion, requires validation and records the release date. It does
not edit or publish anything by itself. Results are reviewed after 28 complete
post-release days have finalised in Search Console, then kept, iterated or
undone.

Property-wide Search Console totals come from separate reports with no page
dimension, so the Site pulse is not limited to the first page rows returned for
the improvement queue. Normalised `www` and apex URLs are combined before page
scoring, obvious contact-like queries are removed, and only three queries are
shown per action card. The Attention section uses the existing landing-page
session, average engaged-time and views-per-session fields. These are review
signals; the page never claims to know why somebody left.

Operations D1 now supplies matching 28-day all-source and website-enquiry
counts for the Enquire stage. Saved enquiries remain authoritative and are
never divided by consented GA4 sessions. GA `generate_lead` events and Sheet
delivery state live under reporting health as collection diagnostics.

Facebook/Instagram campaign attribution is retained for the browser session,
so a visitor can move from an ad landing page to `/quote/` without losing the
source, campaign or first landing page attached to the saved lead. The protected
Analytics page combines consent-aware traffic with aggregate actual-lead counts
from D1, including source, privacy-filtered campaign labels, lead pages and
website-to-Sheet delivery health.

## Operations mailbox: ready, but not switched over

The mailbox code is prepared for the following exact aliases:

- `deandre@brisbanetvs.com`
- `kody@brisbanetvs.com`
- `tom@brisbanetvs.com`

They are Worker-backed mail addresses, not three external hosted inbox
accounts. Cloudflare Email Routing can deliver each address directly to the
existing Worker, which stores the message for the Operations page.

The prepared implementation:

- A Cloudflare Worker accepts routed mail, stores raw MIME privately in the
  dedicated mail bucket, and stores only safe text/metadata for staff review.
- The Worker rejects every envelope recipient outside the three-address
  allowlist. Do not create a catch-all routing rule.
- A deterministic ingest key ignores repeated inbound deliveries, and reply
  headers resolve to an internal thread ID instead of controlling it.
- Replies prefer the parsed `Reply-To` address, then the visible `From`
  address; the SMTP envelope sender is retained separately for audit and is
  never mistaken for the customer by default.
- It does not forward, automatically reply, or make attachments downloadable.
- Incoming mail is limited in size and failed storage is rejected rather than
  silently dropped.
- The Operations page has mailbox filters, search, read/archive state, safe
  plain-text threads and a responsive reply composer.
- Staff can save response, thank-you or invoice drafts from the three approved
  aliases. Saving a draft never sends it.
- A separately locked send route is prepared behind
  `MAIL_SEND_ENABLED=false`. It is unusable without both the flag and the
  restricted Cloudflare Email Sending binding.
- When enabled, each Cloudflare Access identity can send only from its mapped
  Brisbane TVs address. The UI requires a fresh human confirmation, claims
  the draft once in `mail_outbox`, and records Cloudflare's message ID or a
  safe failure code. It does not retry an uncertain delivery automatically.
- The Delivery view reads the protected outbox audit; it never treats a saved
  draft as proof of delivery.

An isolated Cloudflare receiver is live at `inbound.brisbanetvs.com` with
three exact Worker routes and catch-all disabled. The root domain's existing
MX records and business mail provider remain unchanged. Root aliases must be
forwarded at the current provider to their matching isolated aliases, or moved
only through a separately approved root migration with rollback.

The recommended receive path does not replace the root MX records: the
existing mail provider forwards each approved root alias to its matching
`inbound.brisbanetvs.com` receiver address. A future root-domain move to
Cloudflare Email Routing would be a separate migration because it replaces the
root MX path. Email Sending has its own `cf-bounce` DNS records and can be
onboarded without that root receive cutover. Its SPF/DKIM/DMARC state still
needs a controlled test before sending is enabled.

Migration `0009_mailbox_threads_outbox.sql` must be applied before deploying
the new page or ingest code. It adds canonical mailbox, read, deduplication and
draft-thread fields plus an inert outbox table for a later idempotent sending
workflow.

### Mail activation order

1. Inventory the current provider's addresses, aliases, forwards, mailbox
   contents, MX, SPF and DKIM records. Export anything that must be retained.
2. Apply D1 migration `0009`, then deploy the Worker and Pages changes while
   `TEAM_INBOX_ENABLED` remains false.
3. Onboard `brisbanetvs.com` in Cloudflare Email Sending. Its `cf-bounce`
   records are independent of the root inbound MX cutover.
4. Give DeAndre, Kody and Tom permanent Cloudflare Access identities through
   the selected Google, Microsoft or other identity provider. Do not make an
   OTP sent into the protected mailbox the only way to open that mailbox.
5. At the current provider, forward each approved root alias to its matching
   isolated receiver address. Keep the existing root MX records. If a future
   root Email Routing migration is approved, inventory every address and
   prepare rollback first; create exact Worker rules and do not use catch-all.
6. Send labelled external tests to all three aliases. Confirm one D1 message
   and one private R2 object per test, correct mailbox filtering and no
   duplicates.
7. Set `TEAM_INBOX_ENABLED=true` only after those receive tests pass.
8. Add outbound delivery separately. Keep `MAIL_SEND_ENABLED=false` while
   Tom activates Workers Paid and `brisbanetvs.com` is onboarded for Email
   Sending. Preserve the existing root MX records and merge Cloudflare into
   the single SPF policy rather than creating a second SPF record.
9. Add an `OPERATIONS_EMAIL` binding restricted with
   `allowed_sender_addresses` for exactly `deandre@`, `kody@` and `tom@`.
   Run a controlled message to an address Brisbane TVs owns, verify SPF,
   DKIM, DMARC and the Cloudflare message ID, then set
   `MAIL_SEND_ENABLED=true`.
10. The human-confirmed route calls the binding only after an atomic D1
    outbox claim. Any failed or uncertain attempt remains locked for manual
    review so a retry cannot duplicate a customer email.

Cloudflare Email Sending can later deliver transactional replies such as
contact acknowledgements and invoices from the three aliases. Promotions are
different: only contacts with recorded consent may be used, and they need
unsubscribe handling and a suitable marketing platform. The current lead data
has no marketing-consent records.

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
