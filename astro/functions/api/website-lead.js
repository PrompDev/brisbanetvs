/**
 * Pages fallback for the canonical website lead and photo-upload intake.
 * The production custom-domain route is normally handled by the standalone
 * Worker; preview deployments call the same shared implementation here.
 */
import {
  onRequestOptions as handleOptions,
  onRequestPost as handlePost,
} from "../../../functions/api/website-lead.js";

export async function onRequestPost(context) {
  const ctx = typeof context.waitUntil === "function"
    ? { waitUntil: context.waitUntil.bind(context) }
    : undefined;
  return handlePost({ ...context, ctx });
}

export async function onRequestOptions(context) {
  return handleOptions(context);
}
