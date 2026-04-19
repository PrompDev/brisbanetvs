# Brisbane TVs — Astro (blog + CMS)

This folder is the **blog engine** for brisbanetvs.com. The marketing
homepage (`/index.html` in the repo root) is still hand-written HTML and
is **not** managed by Astro. Astro here is used to:

1. Publish Markdown blog posts under `/blog/*`.
2. Host the Decap CMS admin at `/admin/*` so you can write posts in a
   browser instead of editing files by hand.
3. Generate `sitemap.xml` automatically at build time.

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
