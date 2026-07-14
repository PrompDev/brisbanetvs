import { json, requireOperationsAccess } from "../_lib/auth.js";

const APK_OBJECT_KEY = "app-releases/Brisbane-Calls-v0.1.0.apk";

export async function onRequestGet({ request, env }) {
  const access = await requireOperationsAccess(request, env);
  if (access.response) return access.response;
  if (!env?.CALL_RECORDINGS?.get) return json({ ok: false, error: "app_download_unavailable" }, 503);

  try {
    const object = await env.CALL_RECORDINGS.get(APK_OBJECT_KEY);
    if (!object || !("body" in object)) return json({ ok: false, error: "app_download_unavailable" }, 404);
    return new Response(object.body, {
      headers: {
        "cache-control": "private, no-store",
        "content-disposition": "attachment; filename=\"Brisbane-Calls-v0.1.0.apk\"",
        "content-length": String(object.size),
        "content-type": "application/vnd.android.package-archive",
        "referrer-policy": "no-referrer",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: "operations_android_app_download_failed",
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    }));
    return json({ ok: false, error: "app_download_unavailable" }, 503);
  }
}
