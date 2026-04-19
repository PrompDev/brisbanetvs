# 04 · Blog post lifecycle: keyboard → live site

This is the end-to-end path a blog post takes, whether you write it in
the CMS or by hand in your editor.

## Path A: publishing via the CMS

```
[ You click Publish in /admin/ ]
            │
            ▼
[ Decap CMS uses the GitHub API to commit a new .md file to main ]
            │
            ▼
[ GitHub fires a webhook at Cloudflare Pages ]
            │
            ▼
[ Cloudflare Pages pulls the repo, runs `npm install` then `npm run build` ]
            │
            ▼
[ Astro reads src/content/blog/*.md and generates dist/blog/<slug>/index.html ]
            │
            ▼
[ Pages uploads dist/ to its edge network ]
            │
            ▼
[ brisbanetvs.com/blog/<slug>/ is live worldwide, ~60 seconds end-to-end ]
```

### What happens at each step, explained

1. **Publish button.** Decap's editor app (running in your browser)
   packages up the form fields you filled in + the Markdown body into
   a single `.md` file with YAML frontmatter. It uses the GitHub REST
   API to commit that file directly to `src/content/blog/`, using your
   GitHub login as the author.

2. **Webhook fires.** Cloudflare Pages is subscribed to the repo's
   `push` events. When the new commit lands, it queues a build.

3. **Build runs.** A fresh Linux container is spun up, `npm install`
   fetches all dependencies, `npm run build` runs.

4. **Astro validates + renders.** Astro reads the new Markdown, checks
   its frontmatter against the Zod schema in
   `src/content/config.ts`, and generates one HTML file per post, one
   index page, plus a refreshed `sitemap.xml`.

5. **Deploy.** The built `dist/` folder gets uploaded to Cloudflare's
   edge cache. The old version stays live until the new one is fully
   uploaded, so there's no downtime.

6. **Live.** Cloudflare DNS routes visitors to the closest edge node.
   Typical total time from click to live: 40-90 seconds.

## Path B: writing a post by hand

```
[ You open astro/src/content/blog/new-post.md in your editor ]
            │
            ▼
[ You write frontmatter + body, save ]
            │
            ▼
[ Optional: run start-astro-dev.bat and preview at http://localhost:4321 ]
            │
            ▼
[ Run git.tools/update-main.bat ]
            │
            ▼
[ Same path from Cloudflare Pages onwards as Path A ]
```

### Preview locally first

`start-astro-dev.bat` launches `npm run dev`, which gives you a hot-
reloading preview of the blog. Every save of a `.md` or `.astro` file
refreshes the browser automatically. Use this to catch typos and
layout issues BEFORE you push.

## What can fail, and where it fails

| Stage | Common failures | Where it shows up |
|---|---|---|
| CMS publish | GitHub OAuth expired; Worker down | `/admin/` login hangs or errors |
| Webhook | None typical — Cloudflare is reliable here | — |
| `npm install` | Dep version conflict, stale lockfile | Pages build log |
| `npm run build` | Frontmatter violates Zod schema; missing hero image; typo in layout name | Pages build log |
| Deploy | Rare, usually Cloudflare status | Pages dashboard shows red |

Whenever a build fails, Pages shows a red ✗ next to the commit in the
dashboard. Click through for the full log — the error line usually
mentions the exact file.

## Rolling back a bad post

Three options, in order of preference:

1. **Edit and fix.** Open the post in `/admin/` or your editor, fix
   the issue, publish again. Total downtime: zero (the last good
   build stays live until the new one succeeds).
2. **Revert the commit.** In the GitHub UI, find the commit, click
   Revert, merge the revert PR. Pages rebuilds from the previous
   state.
3. **Roll back in Pages.** Cloudflare Pages keeps every past
   deployment. You can click "Rollback" on any previous deployment
   and have it live in under 10 seconds.
