# 02 · Folder tour

Every folder and top-level file at `Brisbane TVs/`, explained.

## Top level

```
Brisbane TVs/
├─ .git/                 Git's internal data. Never touch by hand.
├─ .gitignore            Files git should ignore (node_modules, .env, etc.)
├─ api/                  Cloudflare Worker source (CMS auth, etc.)
├─ astro/                Astro-powered blog + CMS engine.
├─ blank template/       Starter HTML shell you copy when spinning up a new page.
├─ css/                  Legacy shared CSS (currently just style.css — kept for backward-compat).
├─ documentation/        These docs.
├─ git.tools/            .bat scripts for git + dev workflows.
├─ image-resizer.html    Standalone utility page for bulk-resizing images.
├─ img/                  All photography used on the marketing homepage.
└─ index.html            The marketing homepage. This IS the live site's front page.
```

## `astro/` — the blog engine

```
astro/
├─ astro.config.mjs      Site URL + Astro plugins (sitemap).
├─ package.json          Deps (astro, @astrojs/sitemap, @astrojs/rss).
├─ tsconfig.json         Path alias: ~/* resolves to src/*
├─ .gitignore            Ignore node_modules, dist, .astro cache.
├─ README.md             Deployment + how-to-publish notes.
├─ public/               Files copied AS-IS into the final build.
│  └─ admin/
│     ├─ index.html      Loads the Decap CMS browser app.
│     └─ config.yml      Tells Decap what fields a blog post has.
└─ src/
   ├─ components/        Small UI pieces.
   │  ├─ Header.astro        Minimal sticky header for blog pages.
   │  ├─ Footer.astro        Simple footer (© + links).
   │  ├─ ChatWidget.astro    Floating chat badge placeholder.
   │  └─ MobileMenu.astro    Hamburger + off-canvas nav for phones.
   ├─ layouts/           Page templates.
   │  ├─ BaseLayout.astro    <html> shell used by everything.
   │  ├─ StandardPost.astro  Generic blog article layout.
   │  ├─ ServiceGuide.astro  "How we do X" service pages.
   │  └─ LocationPost.astro  "TV mounting in <suburb>" pages.
   ├─ pages/             One file per URL. Astro routes by filename.
   │  └─ blog/
   │     ├─ index.astro        → /blog/
   │     └─ [...slug].astro    → /blog/whatever-slug/
   ├─ content/
   │  ├─ config.ts       Zod schema. Declares every frontmatter field.
   │  └─ blog/           One .md file per blog post.
   └─ styles/
      └─ global.css      Design tokens + blog prose styles.
```

## `blank template/` — copy this when starting fresh

`blank template/index.html` is a trimmed copy of the marketing
homepage with all the content stripped out but the header, footer,
mega-menu, and chat widget intact. If you ever spin up a new
standalone page (e.g. `/services/cable-concealment.html`), start from
this file.

## `img/` — photography

Everything the marketing homepage embeds as `<img src="img/…">` lives
here. Keep file names lowercase and hyphen-separated — the site lazy-
loads most of them, and spaces in paths cause encoding issues in some
browsers.

If you're adding a new batch of photos, open `image-resizer.html` in
your browser first to downsize them to web-friendly dimensions
(1920 × 1080 hero shots, 800 × 600 card shots, 400 × 300 thumbs).

## `git.tools/` — daily workflow scripts

See [`05-git-tools.md`](./05-git-tools.md) for the full breakdown. In
short:

| File | What it does |
|---|---|
| `sync-from-main.bat`  | Pull latest changes from GitHub into your local copy. |
| `update-main.bat`     | Stage everything you changed, commit, push. |
| `start-dev-server.bat`| Preview the marketing homepage locally. |
| `start-astro-dev.bat` | Preview the blog + /admin locally. |
| `CHANGELOG.log`       | Auto-generated log of every `update-main.bat` push. |

## `api/` — Cloudflare Worker source

The source for the small Cloudflare Worker that proxies GitHub OAuth
for the CMS login. It lives here so it's versioned alongside the site
— but it deploys to `cms-auth.brisbanetvs.com`, not to
`brisbanetvs.com`. More detail in
[`03-external-services.md`](./03-external-services.md).

## `css/` — legacy

Contains `style.css` (20KB) from an earlier version of the site. The
current homepage has its CSS embedded in `index.html`. Kept around in
case an older linked page needs it. **Don't** add new styles here —
design tokens go in `astro/src/styles/global.css`; homepage tweaks go
straight into the `<style>` block in `index.html`.

## `image-resizer.html`

A standalone Drag & Drop image batch resizer. Pure HTML + browser
canvas; no server required. Open it by double-clicking the file.
