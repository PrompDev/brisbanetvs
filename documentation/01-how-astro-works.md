# 01 · How Astro works (in plain English)

## The 30-second version

Astro is a tool that **turns folders of files into a website**. You
write Markdown files (blog posts) and component files (layouts,
headers, footers), and Astro bundles them into plain HTML/CSS/JS that
any browser can load — no server needed.

You only use it when you work on the **blog** portion of the site.
The marketing homepage is still a normal hand-written `index.html` at
the repo root and doesn't go through Astro.

## Why we're using it

Two reasons:

1. **Blog posts shouldn't live in HTML.** Writing a blog post in
   `index.html` means you're one typo away from breaking the whole
   page. Astro lets posts live as Markdown — the same format you'd use
   in a Google Doc — and it handles the HTML scaffolding for you.
2. **The CMS at `/admin/`** (Decap CMS) only works if there's a
   Markdown-to-HTML pipeline. Astro is that pipeline.

## What it does and doesn't do

**It DOES:**

- Read every `.md` file in `astro/src/content/blog/` and generate a
  matching `/blog/<slug>/index.html` page.
- Read `.astro` files (a hybrid of HTML + JavaScript) and let you
  compose pages from smaller pieces like `<Header />` and `<Footer />`.
- Generate a `sitemap.xml` automatically.
- Produce **static** files — no live server runtime on production.
  Everything is plain HTML after the build.

**It DOESN'T:**

- Replace the main marketing homepage. `index.html` at the repo root
  is still the source of truth for the home page.
- Run server-side code in production. There's no PHP, no Node server,
  no database.
- Handle traffic. That's Cloudflare Pages' job.

## The three states a file can be in

```
[  Source  ]    →    [ Dev server ]    →    [  Built dist/  ]

 .md + .astro         npm run dev            npm run build
 (you edit)           (hot-reloads)          (static HTML)
```

- **Source files** live in `astro/src/` and `astro/public/`. You edit
  these.
- **Dev server** is what you get when you run `start-astro-dev.bat`.
  It watches your files and reloads the browser on every save. Nothing
  is actually saved as HTML on disk.
- **Built dist/** is what Cloudflare Pages produces from your source.
  It's pure HTML/CSS/JS, and what visitors download when they hit the
  site. You never edit these files by hand.

## Components, explained once

A `.astro` file looks like this:

```astro
---
// anything between the --- is TypeScript that runs at BUILD time.
const year = new Date().getFullYear();
---
<footer>
  <p>Copyright {year} Brisbane TVs.</p>
</footer>
```

When Astro builds, it runs the TypeScript up top, then stamps the
resulting HTML into whichever page imported this component. At
runtime in the browser, it's just a plain `<footer>` — no framework
weight. That's Astro's whole pitch: **zero JavaScript ships unless you
explicitly ask for it.**

## Content collections, explained once

Astro calls the `src/content/blog/` folder a **content collection**.
The rules for every post in that collection live in
`src/content/config.ts` — it's a small file that declares, for
example, "every post must have a `title` that's between 8 and 120
characters" and "the `layout` can only be one of standard /
service-guide / location".

If you write a post that violates the rules, `npm run build` will
fail and tell you which field and which file are wrong. This is a
safety net — you'll never ship a blog post with a missing hero image
or a malformed date.

## Path aliases

Throughout the Astro code you'll see imports like this:

```ts
import BaseLayout from "~/layouts/BaseLayout.astro";
```

The `~/` means "from `astro/src/`". It's configured once in
`tsconfig.json` and saves you from writing `../../layouts/...`
everywhere. If you ever move files around, the aliases keep the
imports readable.

## Further reading

- Astro's own docs: <https://docs.astro.build/>
- Markdown cheatsheet: <https://www.markdownguide.org/cheat-sheet/>
- Decap CMS docs: <https://decapcms.org/docs/>
