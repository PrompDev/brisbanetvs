/**
 * /sitemap.xml — hand-rolled sitemap generator.
 *
 * Replaces @astrojs/sitemap, which was throwing `Cannot read properties of
 * undefined (reading 'reduce')` on our admin-nav routes and blocking the
 * Cloudflare Pages build. A 30-line static endpoint is easier to reason
 * about anyway, and it gives us total control over:
 *
 *   1. WHICH pages ship (admin UI excluded, drafts filtered out)
 *   2. `lastmod` tags pulled from frontmatter (updatedDate ?? publishDate)
 *   3. `priority` and `changefreq` tuned per section (home > hubs > entries)
 *
 * Runs at build time because this is a static Astro site — the exported
 * GET handler is invoked once during `astro build` and the result is
 * written to dist/sitemap.xml verbatim.
 */
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

const SITE = "https://brisbanetvs.com";

/** Format a Date for sitemap <lastmod> (W3C datetime — yyyy-mm-dd). */
function lastmod(d?: Date): string {
  if (!(d instanceof Date) || isNaN(d.valueOf())) return "";
  return d.toISOString().slice(0, 10);
}

/** XML-escape a URL/string. Sitemaps are strict about ampersands. */
function xml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

interface Url {
  loc: string;
  lastmod?: string;
  changefreq?: "daily" | "weekly" | "monthly" | "yearly";
  priority?: number;
}

export const GET: APIRoute = async () => {
  const urls: Url[] = [];

  // ---- Static top-level pages ----
  urls.push(
    { loc: "/",         changefreq: "weekly",  priority: 1.0 },
    { loc: "/pricing/", changefreq: "monthly", priority: 0.9 },
    { loc: "/quote/",   changefreq: "monthly", priority: 0.9 },
  );

  // ---- Collection hubs ----
  urls.push(
    { loc: "/blog/",      changefreq: "weekly",  priority: 0.9 },
    { loc: "/services/",  changefreq: "monthly", priority: 0.9 },
    { loc: "/locations/", changefreq: "monthly", priority: 0.9 },
    { loc: "/products/",  changefreq: "weekly",  priority: 0.8 },
    { loc: "/mounts/",    changefreq: "weekly",  priority: 0.8 },
  );

  // ---- Collection entries (drafts excluded) ----
  const [blog, services, locations, products, mounts] = await Promise.all([
    getCollection("blog",      ({ data }) => !data.draft),
    getCollection("services",  ({ data }) => !data.draft),
    getCollection("locations", ({ data }) => !data.draft),
    getCollection("products",  ({ data }) => !data.draft),
    getCollection("mounts",    ({ data }) => !data.draft),
  ]);

  for (const p of blog) {
    urls.push({
      loc: `/blog/${p.slug}/`,
      lastmod: lastmod(p.data.updatedDate ?? p.data.publishDate),
      changefreq: "monthly",
      priority: 0.7,
    });
  }
  for (const s of services) {
    urls.push({
      loc: `/services/${s.slug}/`,
      lastmod: lastmod(s.data.updatedDate ?? s.data.publishDate),
      changefreq: "monthly",
      priority: 0.8,
    });
  }
  for (const l of locations) {
    urls.push({
      loc: `/locations/${l.slug}/`,
      lastmod: lastmod(l.data.updatedDate ?? l.data.publishDate),
      changefreq: "monthly",
      priority: 0.8,
    });
  }
  for (const p of products) {
    urls.push({
      loc: `/products/${p.slug}/`,
      lastmod: lastmod(p.data.updatedDate ?? p.data.publishDate),
      changefreq: "weekly",
      priority: 0.6,
    });
  }
  for (const m of mounts) {
    urls.push({
      loc: `/mounts/${m.slug}/`,
      lastmod: lastmod(m.data.updatedDate ?? m.data.publishDate),
      changefreq: "weekly",
      priority: 0.6,
    });
  }

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map((u) => {
        const parts = [`  <url>`, `    <loc>${xml(SITE + u.loc)}</loc>`];
        if (u.lastmod) parts.push(`    <lastmod>${u.lastmod}</lastmod>`);
        if (u.changefreq) parts.push(`    <changefreq>${u.changefreq}</changefreq>`);
        if (typeof u.priority === "number") parts.push(`    <priority>${u.priority.toFixed(1)}</priority>`);
        parts.push(`  </url>`);
        return parts.join("\n");
      })
      .join("\n") +
    `\n</urlset>\n`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
