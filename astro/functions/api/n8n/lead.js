/**
 * Pages fallback for POST /api/n8n/lead.
 *
 * The production custom-domain route is handled by the standalone lead
 * Worker. Preview deployments use this file, so both surfaces deliberately
 * call the same canonical D1 + private Google Sheet intake implementation.
 */
import {
  onN8nLeadPost,
  onRequestOptions as handleOptions,
} from "../../../../functions/api/website-lead.js";

export async function onRequestPost(context) {
  const ctx = typeof context.waitUntil === "function"
    ? { waitUntil: context.waitUntil.bind(context) }
    : undefined;
  return onN8nLeadPost({ ...context, ctx });
}

export async function onRequestOptions(context) {
  return handleOptions(context);
}
