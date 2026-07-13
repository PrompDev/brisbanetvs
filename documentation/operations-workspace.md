# Operations workspace

`/operations/` is the private staff workspace for Brisbane TVs. It is not a
customer-facing website or a replacement for the public quote form.

## Where to work

| Page | Purpose | Customer information shown? |
| --- | --- | --- |
| `/operations/` | Fast daily overview: intake health and aggregate lead counts. | No |
| `/operations/leads/` | Master list of customer contacts and enquiries. | Yes, after staff access check |
| `/operations/inbox/` | Incoming team mail, saved reply drafts and invoice notes. | Yes, after staff access check |
| `/operations/analytics/` | Aggregate, consent-aware website activity from GA4. | No visitor or lead identity |

The public website, private portal, lead register, inbox and analytics are
separate on purpose. The overview is quick to scan, while customer data stays
in the pages where it is actually needed.

## What is connected now

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

## Website analytics and lead signals

GA4 and Search Console reporting are connected. Public GA4 tracking waits for
visitor consent and records aggregate use plus successful `generate_lead`
events; names, emails, phone numbers and form answers are never sent to GA4.
The Analytics page labels these figures as consented traffic and uses the GA4
Realtime API for a separate last-30-minutes collection health signal. Saved
lead counts come from D1 and include every accepted enquiry regardless of the
visitor's analytics choice.

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
