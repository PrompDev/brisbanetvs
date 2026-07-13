import { createRemoteJWKSet, jwtVerify } from "jose";

const JSON_HEADERS = {
  "cache-control": "private, no-store",
  "content-type": "application/json; charset=utf-8",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
};

const ACCESS_HEADER = "cf-access-jwt-assertion";
const PLATFORM_LABELS = new Set(["Facebook", "Instagram", "Website", "Other"]);
const TV_SIZE_LABELS = new Set(["Under 55\"", "55-64\"", "65-74\"", "75\"+", "Unknown"]);
const RECENCY_LABELS = new Set(["today", "yesterday", "older", "none", "unknown"]);
const HEALTH_LABELS = new Set(["healthy", "attention", "never", "unknown"]);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function configuredTeamDomain(value) {
  const raw = nonEmptyString(value);
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".cloudflareaccess.com")) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function configuredScriptUrl(value) {
  const raw = nonEmptyString(value);
  if (!raw) return null;

  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function portalConfig(env) {
  const teamDomain = configuredTeamDomain(env.PORTAL_ACCESS_TEAM_DOMAIN);
  const audience = nonEmptyString(env.PORTAL_ACCESS_AUD);
  const appScriptUrl = configuredScriptUrl(env.PORTAL_APPS_SCRIPT_URL);
  const readSecret = nonEmptyString(env.PORTAL_READ_SECRET);

  return teamDomain && audience && appScriptUrl && readSecret
    ? { teamDomain, audience, appScriptUrl, readSecret }
    : null;
}

async function hasValidAccessJwt(request, config) {
  const token = request.headers.get(ACCESS_HEADER);
  if (!token) return false;

  try {
    const jwks = createRemoteJWKSet(new URL("/cdn-cgi/access/certs", config.teamDomain));
    await jwtVerify(token, jwks, {
      audience: config.audience,
      issuer: config.teamDomain,
    });
    return true;
  } catch {
    return false;
  }
}

function count(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function buckets(value, allowedLabels, maximum) {
  if (!Array.isArray(value)) return [];

  return value.slice(0, maximum).flatMap((item) => {
    if (!item || typeof item !== "object" || !allowedLabels.has(item.label)) return [];
    return [{ label: item.label, count: count(item.count) }];
  });
}

/**
 * Treat the Apps Script response as untrusted. This whitelist is a second
 * privacy boundary: contact details, raw form answers, IDs, timestamps and
 * arbitrary labels cannot reach the browser even if the sheet script changes.
 */
function safeSummary(payload) {
  if (!payload || typeof payload !== "object" || payload.ok !== true) return null;

  return {
    totalLeads: count(payload.totalLeads),
    leadsToday: count(payload.leadsToday),
    leadsLast7Days: count(payload.leadsLast7Days),
    latestLeadRecency: RECENCY_LABELS.has(payload.latestLeadRecency)
      ? payload.latestLeadRecency
      : "unknown",
    syncHealth: HEALTH_LABELS.has(payload.syncHealth) ? payload.syncHealth : "unknown",
    lastRunRecency: RECENCY_LABELS.has(payload.lastRunRecency)
      ? payload.lastRunRecency
      : "unknown",
    byPlatform: buckets(payload.byPlatform, PLATFORM_LABELS, 4),
    byTvSize: buckets(payload.byTvSize, TV_SIZE_LABELS, 5),
  };
}

export async function onRequestGet({ request, env }) {
  const config = portalConfig(env);
  if (!config) {
    console.error(JSON.stringify({ event: "operations_summary_not_configured" }));
    return json({ ok: false, error: "portal_unavailable" }, 503);
  }

  if (!(await hasValidAccessJwt(request, config))) {
    return json({ ok: false, error: "access_denied" }, 403);
  }

  try {
    const upstream = await fetch(config.appScriptUrl, {
      method: "POST",
      headers: { "content-type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ type: "portal_summary", secret: config.readSecret }),
    });

    if (!upstream.ok) {
      console.error(JSON.stringify({
        event: "operations_summary_upstream_failed",
        upstreamStatus: upstream.status,
      }));
      return json({ ok: false, error: "summary_unavailable" }, 503);
    }

    // The connected Apps Script is purpose-built to return a tiny aggregate.
    // We still narrow it with safeSummary() before returning anything.
    const summary = safeSummary(await upstream.json());
    if (!summary) {
      console.error(JSON.stringify({ event: "operations_summary_invalid_payload" }));
      return json({ ok: false, error: "summary_unavailable" }, 503);
    }

    return json({ ok: true, summary });
  } catch {
    console.error(JSON.stringify({ event: "operations_summary_request_failed" }));
    return json({ ok: false, error: "summary_unavailable" }, 503);
  }
}
