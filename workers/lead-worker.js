import {
  onLeadSyncPost,
  onN8nLeadPost,
  onRequestOptions,
  onRequestPost,
  processPendingWebsiteSheetDeliveries,
} from "../functions/api/website-lead.js";
import { receiveInboundMail } from "./mail-ingest.js";

function notFound() {
  return new Response("Not found", { status: 404 });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/website-lead") {
      if (request.method === "OPTIONS") return onRequestOptions({ request, env, ctx });
      if (request.method === "POST") return onRequestPost({ request, env, ctx });
      return new Response("Method Not Allowed", { status: 405 });
    }

    if (url.pathname === "/api/n8n/lead") {
      if (request.method === "OPTIONS") return onRequestOptions({ request, env, ctx });
      if (request.method === "POST") return onN8nLeadPost({ request, env, ctx });
      return new Response("Method Not Allowed", { status: 405 });
    }

    if (url.pathname === "/api/lead-sync") {
      if (request.method === "POST") return onLeadSyncPost({ request, env, ctx });
      return new Response("Method Not Allowed", { status: 405 });
    }

    return notFound();
  },
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(processPendingWebsiteSheetDeliveries(env));
  },
  email: receiveInboundMail,
};
