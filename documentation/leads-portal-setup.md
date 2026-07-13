# Brisbane TVs leads portal and analytics activation

## What is ready in this branch

- `/login/` is a branded staff entry point. It does not collect or store a password.
- `/operations/` is an aggregate-only staff dashboard. It is designed to be protected by Cloudflare Access and deliberately excludes customer names, phone numbers, emails, lead IDs, raw answers and exact timestamps.
- `/operations/api/summary` validates a Cloudflare Access JWT, calls the private Google Apps Script from the server, and applies a second allow-list before returning counts to the browser.
- Public pages use consent-based Google Analytics. No Google tag is requested until a visitor allows analytics. Quote and footer forms send a `generate_lead` event only after their endpoint responds successfully, with no personal data.

## Live status — 14 July 2026

- Cloudflare Access protects `https://brisbanetvs.com/operations/` and its API. The **Brisbane TVs Staff Portal** policy allows only the two approved staff email addresses and signs them in with a one-time code.
- The existing **Brisbane TVs Lead Ingest** Apps Script Web App now has the aggregate-only `portal_summary` endpoint and a separate `PORTAL_READ_SECRET` Script Property. No contact details are returned by this endpoint.
- The matching `PORTAL_READ_SECRET` is stored as an encrypted Cloudflare Pages secret, not in Git. The non-sensitive Access, Apps Script URL, and GA4 configuration values are in the root `wrangler.toml`, which this Git-integrated Pages project uses as configuration source of truth.
- A dedicated **Brisbane TVs** GA4 property and `https://brisbanetvs.com` web stream are active. The Google tag still waits for explicit visitor analytics consent.

## Activation order

### 1. Deploy the Google Apps Script update

The local lead watcher’s `google-apps-script/Code.gs` now supports a new `portal_summary` request. Paste that version into the bound Apps Script project, then create a new Web App deployment.

Add a **new** Script Property called `PORTAL_READ_SECRET`. Generate a long random value and keep it separate from `INGEST_SECRET`; never reuse the ingestion secret for portal reads.

The Web App must be callable by the Cloudflare function. If the project is deployed as “Anyone”, this is acceptable only because the request requires the separate high-entropy secret and returns aggregates only. Do not add contact details or raw lead rows to this endpoint. If that access setting is not acceptable for the Google account, pause here and use an authenticated proxy instead.

### 2. Configure Cloudflare Access before deploying the portal

Create a **Self-hosted** Cloudflare Access application for:

| Setting | Value |
| --- | --- |
| Domain | `brisbanetvs.com` |
| Path | `/operations` |
| Policy | Allow only approved Brisbane TVs staff identities |

Do not use an “Everyone” policy. A policy rooted at `/operations` protects the child API path as well. The public `/login/` page is only a sign-in entry point; it contains no lead data.

Copy the Access team domain and the application audience (`AUD`) from that application’s settings.

### 3. Add Pages environment values

In the Brisbane TVs Cloudflare Pages project, add these values in **Production**. Use Preview only after creating an appropriate preview Access policy.

| Name | Store as | Purpose |
| --- | --- | --- |
| `GA_MEASUREMENT_ID` | variable | Dedicated Brisbane TVs GA4 stream ID, e.g. `G-…` |
| `PORTAL_ACCESS_TEAM_DOMAIN` | variable | Access team domain, including `https://` |
| `PORTAL_ACCESS_AUD` | variable | Access application audience |
| `PORTAL_APPS_SCRIPT_URL` | variable | Deployed Google Apps Script Web App URL |
| `PORTAL_READ_SECRET` | secret | Same distinct secret stored in Apps Script |

This Pages project uses the root `wrangler.toml` as its configuration source of truth, so its non-sensitive variables belong there. Keep `PORTAL_READ_SECRET` out of Git and store it only as an encrypted Pages secret. The endpoint fails closed until every portal value is present.

### 4. Create the correct GA4 property

Create a dedicated **Brisbane TVs** GA4 property and a Web data stream for `https://brisbanetvs.com`. Use that stream’s measurement ID for `GA_MEASUREMENT_ID`.

Do not attach the site to an unrelated Firebase property. After deployment, use GA4 Realtime or DebugView to confirm a consented page view and a successful `generate_lead` event. Do not send names, emails, phone numbers, postcodes, lead IDs or free-text form answers as Analytics event parameters.

### 5. Deploy and verify

Deploy the Pages build from the `astro` root as usual. Then verify:

1. Signed out, `/operations/` prompts for Cloudflare Access and `/operations/api/summary` never returns lead data.
2. Signed in, the dashboard shows only counts, buckets and broad recency labels.
3. In browser network tools, the summary response contains no contact information or raw form values.
4. Before analytics consent, no request is made to Google’s tag service. After consent, a page view appears in GA4.
5. A successful quote/footer submission triggers `generate_lead` with a `lead_source` only.

## Important existing lead-path issue

The current production route owner responds to `/api/website-lead`, while the public quote and footer forms call `/api/n8n/lead`. The new Analytics conversion event correctly waits for a successful response, so it will not fire until that route mismatch is repaired. Treat that as a separate lead-delivery fix; do not change form endpoints blindly because their payloads need to be mapped to the live receiver first.
