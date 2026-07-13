const JSON_HEADERS = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
};

function json(body) {
  return new Response(JSON.stringify(body), { headers: JSON_HEADERS });
}

function measurementIdFrom(env) {
  const candidate = typeof env?.GA_MEASUREMENT_ID === "string"
    ? env.GA_MEASUREMENT_ID.trim().toUpperCase()
    : "";

  return /^G-[A-Z0-9]+$/.test(candidate) ? candidate : null;
}

/**
 * Runtime configuration keeps the GA4 measurement ID out of source and lets
 * both Astro pages and the legacy static homepage share one consent flow.
 * A GA measurement ID is public configuration, but is intentionally absent
 * until the dedicated Brisbane TVs property is ready.
 */
export function onRequestGet({ env }) {
  const measurementId = measurementIdFrom(env);
  return json(measurementId
    ? { enabled: true, measurementId }
    : { enabled: false });
}
