# Brisbane TVs — Astro (blog + CMS)

This folder is the production source for brisbanetvs.com. The marketing
homepage remains hand-authored HTML at `public/index.html`; Astro copies it
into the build and pre-renders every service, location, blog, product and
legal route to static HTML. Astro also hosts the private admin and Operations
shells and generates `sitemap.xml` at build time.

The production build now verifies every sitemap URL before deployment. A
build fails if a public URL loses its HTML file, title, description, H1,
self-canonical, initial text content or internal-link integrity.

The marketing homepage and the Astro-generated blog share design tokens
(fonts, colours, spacing) through `src/styles/global.css`.

---

## Folder map

```
astro/
├─ astro.config.mjs         Site URL + integrations (sitemap)
├─ package.json             Astro + integrations deps
├─ tsconfig.json            Path alias: ~/* → src/*
├─ public/
│  └─ admin/                Decap CMS — runs in the browser at /admin
│     ├─ index.html         Loads the Decap CMS bundle
│     └─ config.yml         Declares the "blog" collection + fields
├─ src/
│  ├─ components/           Small reusable UI blocks (Header, Footer, …)
│  ├─ content/
│  │  ├─ config.ts          Zod schema for blog frontmatter
│  │  └─ blog/              Markdown files — one per blog post
│  ├─ layouts/              Page templates (Base + 3 post styles)
│  ├─ pages/
│  │  └─ blog/              /blog/ index + /blog/[slug]/ dynamic routes
│  └─ styles/
│     └─ global.css         Design tokens + prose + blog styles
```

---

## Running locally

```bash
cd astro
npm install      # first time only
npm run dev      # starts a dev server at http://localhost:4321
```

Or double-click **`git.tools/start-astro-dev.bat`** from Windows —
that wraps the same thing.

### Building for production

Use Node 20–24. Cloudflare Pages is pinned to Node 20; Node 25 is not
compatible with the Astro 4 filesystem cleanup used by this project.

```bash
npm run build    # outputs static files to astro/dist/
npm run preview  # serves the built site locally at :4321
```

---

## Writing a new blog post

### Option 1 — the CMS (easiest)

1. Go to `https://brisbanetvs.com/admin/` in your browser.
2. Log in with GitHub (the Cloudflare Worker at `cms-auth.brisbanetvs.com`
   does the OAuth dance — see `documentation/` for how it's wired).
3. Click **New Blog**, fill in the fields, upload a hero image, write
   the post, click **Publish**.
4. The CMS commits the Markdown file to GitHub on `main`.
5. Cloudflare Pages sees the push, re-builds the site, and the new post
   is live within ~60 seconds.

### Option 2 — by hand

Create a new file in `src/content/blog/` named after the URL slug you
want, e.g. `wall-mount-tvs-new-farm.md`. Use this frontmatter:

```yaml
---
title: "TV Mounting in New Farm, Brisbane: What to Expect"
description: "Short summary that shows up in Google + the blog index."
heroImage: "/media/blog/new-farm-hero.jpg"
heroAlt: "Alt text describing the hero image"
publishDate: 2026-05-01
author: "Brisbane TVs Team"
layout: "location"        # standard | service-guide | location
suburb: "New Farm"        # only used if layout=location
service: "Cable Concealment"   # only used if layout=service-guide
tags: ["new farm", "inner-brisbane"]
readTime: 5
---

Write the body here in Markdown.
```

Commit + push, and Cloudflare Pages will build and deploy.

---

## Deployment (Cloudflare Pages)

- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Root directory (advanced setting):** `astro`
- **Node version:** 20 (set `NODE_VERSION=20` env var in Pages)

Pages watches the `main` branch. Each push rebuilds and redeploys.

---

## External services this folder depends on

| Service | What it does |
|---|---|
| GitHub (`main` branch) | Source of truth for all content. |
| Cloudflare Pages       | Builds Astro on every push and serves the site. |
| Cloudflare Worker (`cms-auth.brisbanetvs.com`) | OAuth proxy so Decap CMS can log in with GitHub. |
| Decap CMS (CDN)        | `https://unpkg.com/decap-cms` — loaded at runtime by `/admin/index.html`. |
| Google Fonts           | Inter + Noto Serif, loaded in `<head>` of BaseLayout. |
| `cdn.brisbanetvs.com`  | Optimised image delivery for `/media/*`. |

See `/documentation/` for a plain-English walkthrough of how these fit
together.

---

## Operations analytics

The staff-only `/operations/analytics/` page reports aggregate, consent-aware
website activity. It is protected by Cloudflare Access and its Google
credential is never delivered to a staff browser or committed to the repo.
It also reports a separate GA4 Realtime last-30-minutes health signal. A zero
means the connection is healthy but no consenting visitor is currently active;
it does not mean that accepted website enquiries were lost. Actual lead counts
come from Operations D1 and include accepted submissions independently of GA4
consent.

To connect it in Cloudflare Pages, set these production environment values:

| Setting | Purpose |
|---|---|
| `GA4_PROPERTY_ID` | GA4 property number (already configured in `wrangler.toml`). |
| `GA4_SERVICE_ACCOUNT_JSON` | **Secret** containing a restricted Google service-account JSON key. Give that account GA4 Viewer access. |
| `SEARCH_CONSOLE_SITE_URL` | Optional non-secret exact Search Console property: `sc-domain:brisbanetvs.com` for a Domain property, or `https://brisbanetvs.com/` for a URL-prefix property. |

For the Google Search panel, the same service account also needs read-only
access to the verified Search Console property. Enable the Google Analytics
Data API and Google Search Console API in the service account's Google Cloud
project. Search data is deliberately isolated from the GA4 summary: if Search
Console is not configured or temporarily unavailable, page and session
reporting still works.

---

## Troubleshooting

**`npm install` fails with esbuild SIGSEGV inside Cowork's sandbox.**
That's a known sandbox limitation — run `npm install` on your own
machine (Windows cmd is fine) via `start-astro-dev.bat`.

**Blog post doesn't appear after I push.**
Check the Cloudflare Pages build log. The most common cause is a
frontmatter field failing the Zod schema in `src/content/config.ts` —
the build will print the offending file and field.

**`/admin/` opens but the login button does nothing.**
The Cloudflare Worker at `cms-auth.brisbanetvs.com` is down or the
GitHub OAuth app URL is wrong. Check the Worker dashboard and confirm
`config.yml` has the right `base_url`.
