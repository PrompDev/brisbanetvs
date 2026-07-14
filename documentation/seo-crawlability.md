# SEO crawlability and indexing

## Current rendering model

The production site is static HTML. Astro builds each public route into an
`index.html` file before Cloudflare deploys it. JavaScript enhances navigation,
forms and analytics; it does not create the title, H1, canonical tag or main
page copy.

Do not create separate crawler-only copies. They would duplicate the same
content across competing URLs and split canonical and backlink signals.

## Crawl controls

- `astro/public/robots.txt` allows the public site, blocks private shells and
  advertises `https://brisbanetvs.com/sitemap.xml`.
- `astro/src/pages/sitemap.xml.ts` emits absolute canonical URLs and truthful
  `lastmod` values. It excludes admin and Operations routes.
- `astro/public/_headers` marks Cloudflare `pages.dev` deployment hostnames as
  `noindex`, leaving the custom domain as the indexed copy.
- `npm run build` runs `scripts/verify-seo-output.mjs` and
  `scripts/audit-links.mjs`. The deployment fails if a sitemap page is missing
  static content or if an internal link breaks.

## Verified baseline — 14 July 2026

- 382 Astro routes build successfully.
- The XML sitemap contains 365 canonical public URLs.
- Every sitemap URL has a physical HTML file, one title, one description, one
  H1, one matching self-canonical and substantial text before JavaScript runs.
- The built site has no broken static internal links.
- Live Googlebot, smartphone Googlebot and browser requests receive the same
  primary content.

## Location-page quality plan

The technical crawl path is healthy. The remaining risk is that most of the
341 suburb pages are highly repetitive and were published together on 29–30
June 2026. Google has had roughly two weeks, not several months, to assess most
of that set.

Improve a first group of 10–20 suburbs using evidence from real completed jobs,
website leads and Search Console demand. Each priority page should use a real
local photo and an anonymised job example with the actual TV size, wall type,
bracket or cable solution, and only confirmed price, warranty and job-count
claims.

Before narrowing the sitemap, confirm the genuine service footprint. Sixteen
current pages target the Gold Coast or Sunshine Coast while the site-wide
business data lists Greater Brisbane, Moreton Bay, Logan and Ipswich. Do not
remove or retain those pages based on guesswork.

## Business identity

Use `Brisbane TVs` as the public trading name. Tom is a sole trader, but an
incomplete personal name should not be published as `legalName`, and the site
must not invent a company suffix. No Google Business Profile is part of this
organic-search plan.
