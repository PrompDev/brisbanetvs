import { onRequestOptions, onRequestPost } from "../functions/api/website-lead.js";
import { onRequestGet as onUploadGet } from "../functions/api/lead-upload.js";

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

    if (url.pathname === "/api/lead-upload") {
      if (request.method === "GET") return onUploadGet({ request, env, ctx });
      return new Response("Method Not Allowed", { status: 405 });
    }

    return notFound();
  },
};
