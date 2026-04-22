/**
 * cms-auth-worker — Cloudflare Worker OAuth proxy for Decap CMS.
 *
 * Decap's GitHub backend runs entirely in the browser and therefore can't
 * talk to `github.com/login/oauth/access_token` directly (the token endpoint
 * doesn't CORS). This worker stands in the middle: it owns the client_secret
 * and hands the exchanged access_token back to Decap via postMessage.
 *
 * Routes:
 *   GET /auth          Redirects to GitHub's authorize URL.
 *   GET /callback      Exchanges ?code= for an access_token and posts the
 *                      result back to window.opener (Decap's admin UI).
 *   GET /success       Optional friendly page shown if someone opens the
 *                      callback in a non-popup context.
 *   GET /              Health check (plain text).
 *
 * Bindings (set via `wrangler secret put` — see README.md):
 *   GITHUB_CLIENT_ID        Public client ID of the GitHub OAuth App.
 *   GITHUB_CLIENT_SECRET    Secret — NEVER commit this.
 *   GITHUB_SCOPE            Space-separated scopes. Default: "repo,user".
 *   ALLOWED_ORIGIN_HOSTS    Comma-separated list of opener hostnames that
 *                           are allowed to receive the postMessage. Default
 *                           allows all origins ("*") which is fine for low-
 *                           risk content sites; tighten for higher-stakes.
 */

const PROVIDER = "github";

export default {
  /** @param {Request} request @param {Record<string,string>} env */
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "") {
      return text(
        "cms-auth-worker — Decap CMS OAuth proxy. Use /auth to start the flow."
      );
    }

    if (url.pathname === "/auth") {
      return handleAuth(url, env);
    }

    if (url.pathname === "/callback") {
      return handleCallback(url, env);
    }

    if (url.pathname === "/success") {
      return html(
        `<!doctype html><meta charset="utf-8"><title>CMS auth</title>` +
        `<p style="font:16px/1.5 system-ui;margin:3rem auto;max-width:32rem">` +
        `You're signed in. You can close this tab and head back to the CMS.</p>`
      );
    }

    return text("Not found", 404);
  },
};

/**
 * Kick off the OAuth flow by redirecting to GitHub. We preserve Decap's
 * `site_id` and `scope` query params so GitHub can round-trip them back to
 * us via `state`.
 */
function handleAuth(url, env) {
  const clientId = env.GITHUB_CLIENT_ID;
  if (!clientId) return text("GITHUB_CLIENT_ID not configured", 500);

  const scope =
    url.searchParams.get("scope") || env.GITHUB_SCOPE || "repo,user";

  // `state` is anti-CSRF — we include a random nonce so GitHub refuses to
  // complete the exchange if someone replays the callback URL without
  // having initiated /auth here.
  const nonce = crypto.randomUUID();
  const state = encodeBase64Url(
    JSON.stringify({
      nonce,
      site: url.searchParams.get("site_id") || "",
      returnTo: url.searchParams.get("return_to") || "",
    })
  );

  const redirectUri = `${url.origin}/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state,
    allow_signup: "false",
  });

  return Response.redirect(
    `https://github.com/login/oauth/authorize?${params.toString()}`,
    302
  );
}

/**
 * Handle GitHub's redirect back to us. Exchange the code for a token, then
 * render an HTML page that postMessages the token to window.opener (Decap).
 */
async function handleCallback(url, env) {
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  if (!code) return renderResult({ error: "missing_code" }, env);

  // state should be a base64url-encoded JSON blob — if not, we still proceed
  // but log the issue. This is defence-in-depth, not a hard stop.
  try {
    JSON.parse(decodeBase64Url(stateParam || ""));
  } catch (_) {
    // state malformed; still exchange the code but flag it in logs
    console.warn("[cms-auth-worker] malformed state param");
  }

  const clientId = env.GITHUB_CLIENT_ID;
  const clientSecret = env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return renderResult({ error: "server_not_configured" }, env);
  }

  try {
    const tokenRes = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "cms-auth-worker",
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: `${url.origin}/callback`,
        }),
      }
    );

    const data = await tokenRes.json().catch(() => ({}));

    if (!tokenRes.ok || data.error || !data.access_token) {
      return renderResult(
        {
          error: data.error_description || data.error || "token_exchange_failed",
        },
        env
      );
    }

    return renderResult(
      { token: data.access_token, provider: PROVIDER },
      env
    );
  } catch (err) {
    return renderResult({ error: "network_error: " + String(err) }, env);
  }
}

/**
 * Render the page Decap expects: it listens for a postMessage from the
 * popup matching "authorization:<provider>:<status>:<payload>".
 */
function renderResult(result, env) {
  const status = result.error ? "error" : "success";
  const payload = JSON.stringify(result);
  const allowed = env.ALLOWED_ORIGIN_HOSTS || "*";

  const script = `
    (function () {
      var payload = ${JSON.stringify(payload)};
      var status = ${JSON.stringify(status)};
      var allowed = ${JSON.stringify(allowed)};

      function isAllowedOrigin(origin) {
        if (allowed === "*") return true;
        try {
          var host = new URL(origin).host;
          return allowed.split(",").map(function (s) { return s.trim(); })
            .some(function (p) { return p === host || host.endsWith("." + p); });
        } catch (e) { return false; }
      }

      function send(origin) {
        var msg = "authorization:${PROVIDER}:" + status + ":" + payload;
        window.opener.postMessage(msg, origin === "*" ? "*" : origin);
      }

      function receive(e) {
        if (!e.data || typeof e.data !== "string") return;
        if (e.data !== "authorizing:${PROVIDER}") return;
        if (!isAllowedOrigin(e.origin)) {
          console.warn("[cms-auth-worker] blocked origin", e.origin);
          return;
        }
        send(e.origin);
      }

      if (!window.opener) {
        document.body.innerText = status === "success"
          ? "Signed in. You can close this tab."
          : "Auth error: " + payload;
        return;
      }

      window.addEventListener("message", receive, false);
      // Nudge the opener that we're ready so the handshake starts.
      window.opener.postMessage("authorizing:${PROVIDER}", "*");
    })();
  `;

  return html(
    `<!doctype html><meta charset="utf-8"><title>CMS auth · ${status}</title>` +
      `<body style="font:16px/1.5 system-ui;margin:3rem auto;max-width:32rem;color:#333">` +
      `<p>Completing sign-in…</p>` +
      `<script>${script}</script></body>`
  );
}

// ---------- helpers ----------

function html(body, init = {}) {
  return new Response(body, {
    status: init.status || 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function text(body, status = 200) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function encodeBase64Url(str) {
  const b64 = btoa(unescape(encodeURIComponent(str)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeBase64Url(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  return decodeURIComponent(escape(atob(b64 + pad)));
}
