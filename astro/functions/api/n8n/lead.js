/**
 * Brisbane TVs — Lead Webhook Proxy (Cloudflare Pages Function)
 * ------------------------------------------------------------------
 * Path:  POST /api/n8n/lead
 *
 * Purpose
 *   Accepts JSON lead submissions from the site, drops bot traffic,
 *   enriches with server-side metadata (real IP, country, UA, referer),
 *   and forwards to the n8n workflow webhook.
 *
 *   The n8n webhook URL is NOT exposed in the browser — it lives in a
 *   Cloudflare Pages environment variable. The site only ever talks to
 *   /api/n8n/lead (same-origin, no CORS).
 *
 * Location note
 *   This file MUST live at `astro/functions/...` (NOT `/functions/` at
 *   the repo root) because CF Pages' "Root directory" setting for this
 *   project is `/astro`. Pages looks for the functions folder relative
 *   to that root. Moving this file back to the repo root will make it
 *   invisible to the deploy and every form POST will 405.
 *
 * Setup (Cloudflare dashboard)
 *   Pages → brisbanetvs → Settings → Environment variables
 *     Production:
 *       N8N_LEAD_WEBHOOK = https://prompdev.app.n8n.cloud/webhook/brisbane-tvs-lead
 *     Preview (optional, for branch deploys testing the test webhook):
 *       N8N_LEAD_WEBHOOK = https://prompdev.app.n8n.cloud/webhook-test/brisbane-tvs-lead
 *
 * Audit-safe
 *   `scripts/audit-links.mjs` treats /api/n8n/* as runtime-only and won't
 *   flag callers to this endpoint as 404s.
 */

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });

export async function onRequestPost({ request, env }) {
  // 1) Parse body
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }
  if (!body || typeof body !== 'object') {
    return json({ ok: false, error: 'invalid_body' }, 400);
  }

  // 2) Honeypot — silent 200 so the bot thinks it succeeded.
  //    Three field names so even bots that skip the obvious "honeypot"
  //    name still trip on company_website (looks like a real question).
  if (body.company_website || body.honeypot || body.hp) {
    return json({ ok: true });
  }

  // 3) Server-side enrichment. The browser can't fake these.
  const headers = request.headers;
  const enriched = {
    ...body,
    submitted_at: new Date().toISOString(),
    server: {
      ip: headers.get('cf-connecting-ip') || '',
      country: headers.get('cf-ipcountry') || '',
      user_agent: headers.get('user-agent') || '',
      cf_ray: headers.get('cf-ray') || ''
    },
    tracking: {
      ...(body.tracking || {}),
      referrer: headers.get('referer') || (body.tracking && body.tracking.referrer) || ''
    }
  };

  // 4) Forward to n8n
  const webhook = env.N8N_LEAD_WEBHOOK;
  if (!webhook) {
    // Misconfigured deploy — let the user see something so they can call us
    return json({ ok: false, error: 'webhook_not_configured' }, 500);
  }

  try {
    const upstream = await fetch(webhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(enriched)
    });
    if (!upstream.ok) {
      // n8n returned non-2xx — log via response body for debugging in CF logs
      console.log('n8n upstream error', upstream.status, await upstream.text().catch(() => ''));
      return json({ ok: false, error: 'upstream_error' }, 502);
    }
  } catch (err) {
    console.log('n8n upstream unreachable', String(err));
    return json({ ok: false, error: 'upstream_unreachable' }, 502);
  }

  return json({ ok: true });
}

// (No onRequest export — when only onRequestPost is exported, Cloudflare
//  Pages automatically returns 405 Method Not Allowed for any other HTTP
//  method. Exporting both caused onRequest to intercept POSTs and return
//  undefined, which Pages handled as 405. Don't add onRequest back unless
//  you call next() for the methods you want to fall through.)
