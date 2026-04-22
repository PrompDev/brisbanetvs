# cms-auth-worker

A tiny Cloudflare Worker that lets the Decap CMS (served at `/admin/`) log in
with GitHub, so editors can commit content straight from the admin UI to the
`main` branch of this repo without ever seeing a terminal.

## Why it exists

Decap's GitHub backend runs entirely in the browser. It can redirect the
user to `github.com/login/oauth/authorize` no problem, but the second half
of the OAuth flow — exchanging the `code` for an `access_token` — has to
happen on a server, because:

1. It needs the OAuth App's `client_secret`, which must never be exposed to
   the browser.
2. GitHub's token endpoint doesn't send CORS headers, so the browser can't
   call it directly.

This worker is that server. It owns the secret, does the exchange, and posts
the access token back to the Decap admin tab via `window.postMessage`.

## One-time setup

### 1. Create a GitHub OAuth App

Go to **GitHub → Settings → Developer settings → OAuth Apps → New OAuth App**.

| Field | Value |
|---|---|
| Application name | Brisbane TVs CMS |
| Homepage URL | `https://brisbanetvs.com` |
| Authorization callback URL | `https://cms-auth.brisbanetvs.com/callback` |

Click **Register application**. On the next page:

- Copy the **Client ID** (public, harmless).
- Click **Generate a new client secret** and copy it (sensitive, treat it
  like a password).

### 2. Point DNS at Cloudflare

The route in `wrangler.toml` assumes `brisbanetvs.com` is a zone on your
Cloudflare account. If it's not yet:

1. Add the domain as a zone in your Cloudflare dashboard.
2. Update the domain's nameservers at the registrar (the Cloudflare UI walks
   you through this).
3. Wait for propagation (usually minutes to an hour).

### 3. Deploy the worker

From this directory:

```bash
npm install                                # pulls wrangler
npx wrangler login                         # browser-auth once
npx wrangler secret put GITHUB_CLIENT_ID   # paste the client_id
npx wrangler secret put GITHUB_CLIENT_SECRET # paste the client_secret
npx wrangler deploy
```

The first deploy creates the Worker and binds it to
`cms-auth.brisbanetvs.com/*`. Subsequent deploys just update the code.

### 4. Tell Decap about it

Open `astro/public/admin/config.yml` and confirm:

```yaml
backend:
  name: github
  repo: <your-github-org>/<your-repo>          # ← replace placeholder
  branch: main
  base_url: https://cms-auth.brisbanetvs.com   # must match worker hostname
  auth_endpoint: /auth
```

Update `repo:` if it's still the `your-github-user/brisbane-tvs` placeholder
shipped in the config.

### 5. Test the loop

1. Commit + push the repo to GitHub.
2. Open `https://brisbanetvs.com/admin/`.
3. Click **Login with GitHub**.
4. Authorize when GitHub prompts.
5. You should land back in the Decap admin with your avatar in the top-right.
6. Edit a post, hit **Publish** — the worker commits to `main` for you.

## Local development

```bash
npx wrangler dev
```

This boots the worker on `http://localhost:8787`. Handy for iterating on the
`renderResult` HTML template. For local _CMS_ development you generally
don't need the worker at all — `local_backend: true` in `config.yml` hands
all file I/O to `npx decap-server` instead.

## Hardening checklist (optional)

- Set `ALLOWED_ORIGIN_HOSTS` in `wrangler.toml` to the public admin
  hostnames only (`brisbanetvs.com,www.brisbanetvs.com`). This stops
  third-party sites from snooping the token postMessage.
- Rotate `GITHUB_CLIENT_SECRET` via `wrangler secret put` and regenerate it
  in the GitHub OAuth App page if you think it's leaked.
- Use `wrangler tail` to stream live request logs when debugging login
  issues.

## Routes

| Path | What it does |
|---|---|
| `GET /` | Health check — plain text. |
| `GET /auth` | Kicks off OAuth by redirecting to GitHub. |
| `GET /callback` | GitHub calls this. Exchanges `code` for `access_token`, posts result to Decap. |
| `GET /success` | Friendly page if someone opens `/callback` outside a popup. |

## Files

- `src/index.js` — worker source (zero dependencies, ~200 lines).
- `wrangler.toml` — Cloudflare deploy config.
- `package.json` — pulls `wrangler` as a devDependency so you don't need it
  installed globally.
