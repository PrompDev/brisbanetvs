# 06 · Glossary

One-sentence definitions for every term that shows up in the other
docs.

**Astro** — A static-site generator. Turns a folder of `.md` and
`.astro` files into plain HTML/CSS/JS for the browser.

**`.astro` file** — A hybrid of HTML and JavaScript. The code between
the two `---` lines runs at build time; the HTML below is what gets
stamped into the page.

**Branch (git)** — A parallel copy of the code. This project uses one
branch, `main`.

**Cloudflare Pages** — Where the site is hosted. Builds the Astro
project on every git push and serves the result globally.

**Cloudflare Worker** — A tiny serverless function running on
Cloudflare's network. Used here for the CMS OAuth proxy.

**CMS (Content Management System)** — A browser-based editor for
non-developers. In this project it's Decap CMS at `/admin/`.

**Commit** — A single snapshot of changes, stored in git with a
message and a hash like `a1b2c3d`.

**Content collection** — Astro's name for a folder full of Markdown
files that share the same schema. The `blog` collection lives at
`astro/src/content/blog/`.

**Decap CMS** — The open-source CMS running at `/admin/`. Formerly
called Netlify CMS.

**`dist/`** — Astro's output folder. Contains the final static files
that Cloudflare Pages serves. Never edit by hand; it's regenerated on
every build.

**Editorial workflow** — A Decap CMS setting that routes posts
through draft → in-review → ready before they go live. Configured in
`config.yml` as `publish_mode: editorial_workflow`.

**Frontmatter** — The YAML block at the top of a Markdown post,
between two `---` lines. Declares fields like `title`, `publishDate`,
`tags`.

**Hot reload** — When the dev server pushes your edits into the
browser without a full page reload. Saves seconds per iteration.

**Hash (commit hash)** — A short ID like `a1b2c3d` that uniquely
identifies a commit. Used for referencing specific changes.

**Layout** — An Astro file that wraps page content with a common
shell (header, footer, `<head>` tags). This project has four:
BaseLayout, StandardPost, ServiceGuide, LocationPost.

**Main (branch)** — The canonical branch. What's on `main` is what
Cloudflare Pages builds and serves.

**Markdown** — A plain-text format for writing articles with light
formatting. `**bold**`, `_italic_`, `- lists`, etc.

**OAuth** — The login handshake used by Decap to prove you own the
GitHub account. Proxied through the Cloudflare Worker at
`cms-auth.brisbanetvs.com`.

**Path alias** — A shortcut like `~/` in imports. Configured in
`tsconfig.json`. `~/layouts/foo` really means
`astro/src/layouts/foo`.

**Pull / push** — `pull` fetches changes from GitHub into your local
copy; `push` sends your local commits back to GitHub.

**Slug** — The URL-safe version of a post title, e.g.
`how-to-hide-tv-cables-in-the-wall`. Astro uses the filename as the
slug by default.

**Static site** — A site made of plain HTML/CSS/JS files, with no
server-side code running at request time. That's what Cloudflare
Pages serves.

**Webhook** — An automated HTTP request one service sends to another
when something happens. GitHub sends one to Cloudflare Pages every
time you push.

**Zod** — The TypeScript library that enforces the blog post schema.
If a frontmatter field is missing or the wrong type, Zod makes the
build fail.
