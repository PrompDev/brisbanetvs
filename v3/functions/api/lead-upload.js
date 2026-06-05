function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

export async function onRequestGet({ request, env }) {
  if (!env.LEAD_UPLOADS) {
    return jsonResponse({ error: "LEAD_UPLOADS R2 binding is not configured" }, 500);
  }

  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key || !key.startsWith("website-leads/")) {
    return jsonResponse({ error: "Missing or invalid upload key" }, 400);
  }

  const object = await env.LEAD_UPLOADS.get(key);
  if (!object) return jsonResponse({ error: "Upload not found" }, 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "private, max-age=86400");

  return new Response(object.body, { headers });
}
