# 03 · External services

Brisbane TVs doesn't run on a single machine. A handful of outside
services work together to build, host, and serve the site. Here's
who's who.

## The full picture

```
┌───────────────────┐     push     ┌──────────┐   build+deploy   ┌──────────────────┐
│  Your PC / Cowork │ ───────────▶ │ GitHub   │ ───────────────▶ │ Cloudflare Pages │
│                   │              │ (main)   │                  │  brisbanetvs.com │
└───────────────────┘              └──────────┘                  └──────────────────┘
                                         ▲
                                         │ commits posts
                                         │
                                   ┌─────────────┐
                                   │  Decap CMS  │  (runs in browser at /admin)
                                   └─────────────┘
                                         │
                                         │ OAuth handshake
                                         ▼
                                 ┌───────────────────┐
                                 │ Cloudflare Worker │  cms-auth.brisbanetvs.com
                                 │   (api/ folder)   │
                                 └───────────────────┘
```

Plus two passive sidecars that the browser downloads directly:

- **Google Fonts** — Inter + Noto Serif, loaded from
  `fonts.googleapis.com` via `<link>` in `BaseLayout.astro`.
- **`cdn.brisbanetvs.com`** — Cloudflare CDN endpoint used by image
  `<picture>` tags for optimised delivery.

## Service by service

### GitHub (`main` branch)

- **Where:** `github.com/<your-user>/brisbane-tvs`
- **What it does:** The one source of truth. Every blog post, every
  image, every line of CSS is a file in this repo.
- **Who writes to it:**
  - You, via `git.tools/update-main.bat`.
  - Decap CMS, when you publish a post from `/admin/`.
- **Who reads from it:** Cloudflare Pages, on every push.

### Cloudflare Pages

- **Where:** `dash.cloudflare.com` → Workers & Pages → brisbane-tvs.
- **What it does:** Runs `npm run build` inside `astro/`, then serves
  the generated `dist/` files on `brisbanetvs.com` behind Cloudflare's
  CDN.
- **How to configure:**
  - Build command: `npm run build`
  - Output directory: `dist`
  - Root directory: `astro`
  - Env var: `NODE_VERSION=20`
- **How to trigger:** Push to `main`. Pages auto-deploys within
  ~60 seconds.

### Decap CMS

- **Where:** The Decap JavaScript bundle is loaded from
  `unpkg.com/decap-cms` by `astro/public/admin/index.html`. There's
  no server component — it runs entirely in your browser.
- **What it does:** Gives you a rich-text editor for blog posts. When
  you click **Publish**, it uses GitHub's API to commit a new
  Markdown file to your repo.
- **Authentication:** Uses GitHub OAuth via the Cloudflare Worker
  (below). Without the Worker, the login button just hangs.
- **Config:** `astro/public/admin/config.yml` — this file declares
  the fields in every post, the folder to write them into, and the
  GitHub repo to commit to.

### Cloudflare Worker (`cms-auth.brisbanetvs.com`)

- **Where:** Source in `api/` folder; deployed separately via
  `wrangler deploy` or the Cloudflare dashboard.
- **What it does:** Brokers GitHub OAuth for Decap. When you click
  "Log in with GitHub" inside `/admin/`, your browser is bounced to
  this Worker, which redirects to GitHub, catches the callback,
  exchanges the code for a token, and hands the token back to Decap.
  This is all standard OAuth boilerplate.
- **Needs these secrets** (set via `wrangler secret put` or the
  dashboard):
  - `OAUTH_CLIENT_ID` — from GitHub OAuth App settings.
  - `OAUTH_CLIENT_SECRET` — same place.

### Google Fonts

- **Where:** Requested from `fonts.googleapis.com` and
  `fonts.gstatic.com`.
- **What it does:** Ships Inter (sans) + Noto Serif (serif) to every
  visitor. Loaded via a `<link rel="stylesheet">` in
  `BaseLayout.astro`.
- **Why not self-host?** Cloudflare's CDN caches Google Fonts
  aggressively and the variable-weight Inter file is big; self-hosting
  would make first paint slower, not faster.

### `cdn.brisbanetvs.com` (image CDN)

- **Where:** A custom Cloudflare domain pointing at your image origin
  (typically Cloudflare Images or R2).
- **What it does:** Serves resized/optimised images. The marketing
  homepage uses `srcset` to pull the right size for each viewport.
- **Gotcha:** If you reference an image as `/img/foo.jpg` in a blog
  post, Astro serves it from `astro/public/img/`. If you reference it
  as `https://cdn.brisbanetvs.com/foo.jpg`, it's served from the CDN.
  Pick one and be consistent per image.

## Cost summary

| Service | Plan | Monthly |
|---|---|---|
| GitHub | Free (public repo) | $0 |
| Cloudflare Pages | Free | $0 (500 builds/month included) |
| Cloudflare Workers | Free | $0 (100K requests/day) |
| Decap CMS | Open source | $0 |
| Google Fonts | Free | $0 |
| Cloudflare Images | Paid by usage | ~$5/mo for typical small-business use |

Everything except Cloudflare Images is free at current traffic levels.
