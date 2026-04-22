# n8n Automations — Brisbane TVs

This doc lists every automation we need to wire up in n8n cloud so the
site's forms, quote flows, and lead notifications all work end-to-end.

Every webhook URL referenced here is defined once in
`astro/src/data/business.ts` under `BUSINESS.webhooks`. If you change a
webhook path, change it there — the site reads from that object.

---

## Summary — how many automations?

**8 automations in total.** 5 are public-facing webhook receivers (the
site POSTs to them); 3 are internal scheduled / triggered workflows
(lead follow-up, review requests, daily digest).

| # | Automation | Trigger | Primary action |
|---|---|---|---|
| 1 | Quick Quote Receiver | Webhook (`/api/n8n/quick-quote`) | Email + SMS lead → Tom; auto-reply to customer |
| 2 | Photo Quote Receiver | Webhook (`/api/n8n/photo-quote`) | Same as #1 + attach photo(s) to Tom's email |
| 3 | Call-Back Request Receiver | Webhook (`/api/n8n/call-back`) | SMS Tom "call back" ticket; Slack/Discord ping |
| 4 | Email Signup Receiver | Webhook (`/api/n8n/email-signup`) | Add to newsletter / "send me the quote form" email |
| 5 | Booking Request Receiver | Webhook (`/api/n8n/booking-request`) | Confirm booking email + calendar invite |
| 6 | Abandoned-Quote Follow-up | Schedule (every 4h) | Email anyone who started a quote 24h ago and didn't convert |
| 7 | Post-Install Review Request | Schedule (daily) | SMS customer 48h after install asking for a Google review |
| 8 | Daily Lead Digest | Schedule (06:30 daily) | Email Tom a summary of all leads from the previous day |

---

## 1. Quick Quote Receiver

**Webhook path:** `/api/n8n/quick-quote`  
**Source:** `pricing.astro` → instant-quote form  
**Body:** form-data, fields include `tvSize`, `wallType`, `suburb`,
`name`, `phone`, `email`, `notes`, `source`, `submittedAt`.

**Flow:**
1. **Webhook node** — receives POST.
2. **Set node** — compute `estimatedPackage` by mapping tvSize to the
   same tiers as `business.ts#packageForSize`.
3. **Gmail / SMTP node** — email Tom (admin@brisbanetvs.com) with:
   - Subject: `Quick quote — {name} — {suburb} — {tvSize}"`
   - Body: all form fields, plus the computed package + price.
4. **ClickSend / Twilio node** — SMS Tom's mobile (`0432 145 101`):
   > "New quote: {name} {suburb} {tvSize}" — est {package} ${price}. Phone {phone}."
5. **Gmail node (customer auto-reply)** — send confirmation to
   `email` on the form:
   > "Thanks {firstName} — we've got your details. We'll reply with
   > a locked-in quote within the hour during business hours."
6. **Google Sheets node** — append the lead to "Leads" sheet for the
   daily digest (#8).

---

## 2. Photo Quote Receiver

**Webhook path:** `/api/n8n/photo-quote`  
**Source:** `quote.astro` → photo-upload form  
**Body:** multipart/form-data, same fields as #1 PLUS `photo` (one or
more image files) and `extras` (comma-list).

**Flow:**
1. **Webhook node** — receives POST, `binaryPropertyName: "photo"`.
2. **Set node** — as in #1, map size to package.
3. **Google Drive node** — save uploaded photo(s) to
   `Brisbane TVs / Photo Quotes / {YYYY-MM-DD}-{name}/`.
4. **Gmail node** — email Tom with inline photos + all fields + the
   computed package. Subject: `Photo quote — {name} — {suburb} — {tvSize}"`.
5. **ClickSend / Twilio node** — SMS Tom with the same shortlink
   format as #1 plus `+ photo attached`.
6. **Gmail node (customer auto-reply)** — same copy as #1.
7. **Google Sheets node** — log to the same "Leads" sheet, column
   `type = photo`.

---

## 3. Call-Back Request Receiver

**Webhook path:** `/api/n8n/call-back`  
**Source:** reserved for any page that wants a "call me back" button
(e.g. chat widget, mobile menu if we ever wire it up).  
**Body:** `name`, `phone`, `reason`, `source`, `submittedAt`.

**Flow:**
1. **Webhook node** — receives POST.
2. **ClickSend / Twilio node** — SMS Tom: `Call back: {name} {phone}
   re: {reason}`.
3. **Slack / Discord node** — ping #leads channel with same.
4. **Google Sheets node** — log to "Call Backs" tab.

---

## 4. Email Signup Receiver

**Webhook path:** `/api/n8n/email-signup`  
**Source:** `Footer.astro` → email signup form.  
**Body:** `email`, `source`, `submittedAt`.

**Flow:**
1. **Webhook node** — receives POST.
2. **Mailchimp / Brevo node** — add to "Brisbane TVs — Quote Drip"
   list; trigger tag `source:footer-form`.
3. **Gmail node (customer)** — immediate email with a 1-click link to
   `/quote/` and the short version of prices.
4. **Google Sheets node** — log to "Email Signups" tab.

---

## 5. Booking Request Receiver

**Webhook path:** `/api/n8n/booking-request`  
**Source:** future wiring — any page that actually locks in a date
(e.g. a calendar-picker flow after Tom sends the quote).  
**Body:** `name`, `phone`, `email`, `suburb`, `preferredDate`,
`preferredWindow`, `package`, `notes`, `source`, `submittedAt`.

**Flow:**
1. **Webhook node** — receives POST.
2. **Google Calendar node** — create a tentative event on Tom's
   calendar for the preferred window.
3. **Gmail node** — send customer a calendar invite + install-day
   checklist (clear wall, PowerPoint nearby, pet plan, etc.).
4. **ClickSend / Twilio node** — SMS Tom the booking summary.
5. **Google Sheets node** — log to "Bookings" tab.

---

## 6. Abandoned-Quote Follow-up

**Trigger:** Schedule node, every 4 hours.  
**Source:** "Leads" sheet from #1 and #2.

**Flow:**
1. **Schedule node** — fires every 4 hours between 7 AM and 8 PM.
2. **Google Sheets node** — pull rows where
   `submittedAt > 24h ago` AND `status = new` (i.e. Tom hasn't
   marked it closed).
3. **Filter node** — keep only rows where `email` is present.
4. **Gmail node** — send: "Hi {firstName}, just checking we replied
   to your quote — if not, reply to this email and we'll get onto it."
5. **Google Sheets node** — update row `status = follow-up-sent`.

---

## 7. Post-Install Review Request

**Trigger:** Schedule node, daily at 10:00 AM.  
**Source:** "Bookings" sheet from #5.

**Flow:**
1. **Schedule node** — fires daily at 10:00 AM.
2. **Google Sheets node** — pull rows where
   `installDate = 2 days ago` AND `reviewRequested = false`.
3. **ClickSend / Twilio node** — SMS customer:
   > "Hey {firstName}, thanks for having us Tuesday. If the install's
   > holding up nicely, a Google review helps us hugely —
   > {shortLinkToGoogleReviewPage}"
4. **Google Sheets node** — update row `reviewRequested = true`.

---

## 8. Daily Lead Digest

**Trigger:** Schedule node, daily at 06:30 AM.

**Flow:**
1. **Schedule node** — 06:30 daily.
2. **Google Sheets node** — pull all rows from "Leads" where
   `submittedAt >= yesterday 00:00`.
3. **Function node** — group by type (quick, photo, call-back),
   count totals, compute conversion %.
4. **Gmail node** — email Tom: "Yesterday: 3 leads (2 photo, 1 quick).
   Top priority: 85" Samsung in Toowong, no reply yet."

---

## Security / anti-spam notes

- Every webhook should be rate-limited (n8n has this built-in on the
  Webhook node — set to e.g. 10 req/min per IP).
- Add a honeypot field to every form (`<input name="website" style="display:none">`)
  and drop submissions where it's populated. The form pages already
  have unused layout space for this — adding is trivial.
- For the photo-quote webhook, validate that uploaded files are
  actually images (n8n has a MIME-type filter node) — dump anything
  else to a quarantine drive.
- Use an n8n environment variable `TOM_MOBILE` rather than hardcoding
  `0432145101` in every SMS node.

---

## Wiring checklist

Before going live with GitHub → Cloudflare Workers deploy:

- [ ] Spin up the 8 n8n workflows above (at least #1, #2, #4 day one)
- [ ] Replace `/api/n8n/*` paths in `business.ts` with real n8n cloud
  webhook URLs (e.g. `https://brisbanetvs.app.n8n.cloud/webhook/...`)
- [ ] Test each form end-to-end from a staging URL
- [ ] Verify Tom's SMS number and email are set in n8n env vars
- [ ] Set up a Google Sheet "Brisbane TVs Leads 2026" with the
  required tabs (Leads, Call Backs, Email Signups, Bookings)
- [ ] Set up the Google Drive folder "Brisbane TVs / Photo Quotes"
  and grant the n8n service account write access
