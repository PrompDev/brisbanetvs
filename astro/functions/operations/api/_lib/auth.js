import { createRemoteJWKSet, jwtVerify } from "jose";

export const PRIVATE_JSON_HEADERS = {
  "cache-control": "private, no-store",
  "content-type": "application/json; charset=utf-8",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
};

const ACCESS_HEADER = "cf-access-jwt-assertion";
const jwksByTeamDomain = new Map();

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

function accessConfig(env) {
  const teamDomain = configuredTeamDomain(env.PORTAL_ACCESS_TEAM_DOMAIN);
  const audience = nonEmptyString(env.PORTAL_ACCESS_AUD);
  return teamDomain && audience ? { teamDomain, audience } : null;
}

function getJwks(teamDomain) {
  let jwks = jwksByTeamDomain.get(teamDomain);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL("/cdn-cgi/access/certs", teamDomain));
    jwksByTeamDomain.set(teamDomain, jwks);
  }
  return jwks;
}

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: PRIVATE_JSON_HEADERS });
}

/**
 * Cloudflare Access enforces the path rule at the edge. Every endpoint that
 * returns staff or customer data also verifies the signed assertion so a
 * request to a Pages preview hostname cannot bypass the portal boundary.
 */
export async function requireOperationsAccess(request, env) {
  const config = accessConfig(env);
  if (!config) {
    console.error(JSON.stringify({ event: "operations_access_not_configured" }));
    return { response: json({ ok: false, error: "portal_unavailable" }, 503) };
  }

  const token = request.headers.get(ACCESS_HEADER);
  if (!token) return { response: json({ ok: false, error: "access_denied" }, 403) };

  try {
    const { payload } = await jwtVerify(token, getJwks(config.teamDomain), {
      audience: config.audience,
      issuer: config.teamDomain,
    });

    return {
      identity: {
        email: typeof payload.email === "string" ? payload.email.toLowerCase() : null,
        subject: typeof payload.sub === "string" ? payload.sub : null,
      },
    };
  } catch {
    return { response: json({ ok: false, error: "access_denied" }, 403) };
  }
}

export function hasOperationsDatabase(env) {
  return Boolean(env && env.OPERATIONS_DB && typeof env.OPERATIONS_DB.prepare === "function");
}
