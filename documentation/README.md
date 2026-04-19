# Brisbane TVs — Documentation

Plain-English docs for everything living in this folder. Start here if
you're not sure how a piece of the site works.

## Read in order

1. [**How Astro works**](./01-how-astro-works.md) — what Astro is, why
   it's in the project, what it does and what it doesn't do.
2. [**Folder tour**](./02-folder-tour.md) — every top-level folder in
   "Brisbane TVs" and what lives inside it.
3. [**External services**](./03-external-services.md) — GitHub,
   Cloudflare Pages, Decap CMS, Google Fonts, the image CDN — who does
   what and where each one is configured.
4. [**Blog post lifecycle**](./04-blog-post-lifecycle.md) — from
   keyboard to live site, step by step.
5. [**Git tools**](./05-git-tools.md) — what every `.bat` file in
   `git.tools/` does and when to run it.
6. [**Glossary**](./06-glossary.md) — one-sentence definitions of every
   piece of jargon you'll see.

## If something breaks

- Blog won't build → check `astro/README.md` → Troubleshooting.
- Main site looks wrong → edit `index.html` directly; it's not managed
  by Astro.
- Git tool shows a red error → screenshot the error + paste it to
  Claude; most of them are "run Sync From Main first".
