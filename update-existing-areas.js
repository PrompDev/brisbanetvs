// ──────────────────────────────────────────────────────────────────────
// update-existing-areas.js
//
// Retrofits the 20 EXISTING suburb pages to match the SEO template used
// by the 35 newly generated pages. Preserves all unique suburb content
// (housing descriptions, tips, experience paragraphs) while updating:
//   1. <title>                → "TV Wall Mounting [Suburb] | From $275 | Brisbane TVs"
//   2. <meta name="description"> targeting both "tv wall mounting X" and "tv mounting X"
//   3. <link rel="canonical">
//   4. LocalBusiness JSON-LD schema with aggregateRating + 3 reviews
//   5. <h1>                   → "TV Wall Mounting [Suburb] — Professional Installation From $275"
//   6. Customer reviews section (3 Google reviews as cards)
//   7. Full 55-suburb footer list
//   8. Image alt text that includes the suburb name + is descriptive
// ──────────────────────────────────────────────────────────────────────

const fs   = require('fs');
const path = require('path');

const ROOT = __dirname;

// ── The 20 existing pages + their postcodes ─────────────────────────
const existingAreas = [
  { name: 'Banyo',           slug: 'banyo',           postcode: '4014' },
  { name: 'Nudgee',          slug: 'nudgee',          postcode: '4014' },
  { name: 'Virginia',        slug: 'virginia',        postcode: '4014' },
  { name: 'Northgate',       slug: 'northgate',       postcode: '4013' },
  { name: 'Nundah',          slug: 'nundah',          postcode: '4012' },
  { name: 'Toombul',         slug: 'toombul',         postcode: '4012' },
  { name: 'Wavell Heights',  slug: 'wavell-heights',  postcode: '4012' },
  { name: 'Chermside',       slug: 'chermside',       postcode: '4032' },
  { name: 'Chermside West',  slug: 'chermside-west',  postcode: '4032' },
  { name: 'Kedron',          slug: 'kedron',          postcode: '4031' },
  { name: 'Geebung',         slug: 'geebung',         postcode: '4034' },
  { name: 'Zillmere',        slug: 'zillmere',        postcode: '4034' },
  { name: 'Boondall',        slug: 'boondall',        postcode: '4034' },
  { name: 'Taigum',          slug: 'taigum',          postcode: '4018' },
  { name: 'Fitzgibbon',      slug: 'fitzgibbon',      postcode: '4018' },
  { name: 'Carseldine',      slug: 'carseldine',      postcode: '4034' },
  { name: 'Aspley',          slug: 'aspley',          postcode: '4034' },
  { name: 'Hendra',          slug: 'hendra',          postcode: '4011' },
  { name: 'Clayfield',       slug: 'clayfield',       postcode: '4011' },
  { name: 'Wooloowin',       slug: 'wooloowin',       postcode: '4030' },
];

// ── All 55 suburbs for the canonical footer ─────────────────────────
const allSuburbs = [
  { name: 'Albany Creek',     slug: 'albany-creek' },
  { name: 'Arana Hills',      slug: 'arana-hills' },
  { name: 'Ascot',            slug: 'ascot' },
  { name: 'Ashgrove',         slug: 'ashgrove' },
  { name: 'Aspley',           slug: 'aspley' },
  { name: 'Banyo',            slug: 'banyo' },
  { name: 'Bardon',           slug: 'bardon' },
  { name: 'Boondall',         slug: 'boondall' },
  { name: 'Bracken Ridge',    slug: 'bracken-ridge' },
  { name: 'Brendale',         slug: 'brendale' },
  { name: 'Bridgeman Downs',  slug: 'bridgeman-downs' },
  { name: 'Brighton',         slug: 'brighton' },
  { name: 'Carseldine',       slug: 'carseldine' },
  { name: 'Cashmere',         slug: 'cashmere' },
  { name: 'Chermside',        slug: 'chermside' },
  { name: 'Chermside West',   slug: 'chermside-west' },
  { name: 'Clayfield',        slug: 'clayfield' },
  { name: 'Clontarf',         slug: 'clontarf' },
  { name: 'Dakabin',          slug: 'dakabin' },
  { name: 'Deagon',           slug: 'deagon' },
  { name: 'Eatons Hill',      slug: 'eatons-hill' },
  { name: 'Ferny Grove',      slug: 'ferny-grove' },
  { name: 'Fitzgibbon',       slug: 'fitzgibbon' },
  { name: 'Geebung',          slug: 'geebung' },
  { name: 'Grange',           slug: 'grange' },
  { name: 'Griffin',          slug: 'griffin' },
  { name: 'Hamilton',         slug: 'hamilton' },
  { name: 'Hendra',           slug: 'hendra' },
  { name: 'Joyner',           slug: 'joyner' },
  { name: 'Kallangur',        slug: 'kallangur' },
  { name: 'Kedron',           slug: 'kedron' },
  { name: 'Kelvin Grove',     slug: 'kelvin-grove' },
  { name: 'Mango Hill',       slug: 'mango-hill' },
  { name: 'McDowall',         slug: 'mcdowall' },
  { name: 'Nudgee',           slug: 'nudgee' },
  { name: 'Nundah',           slug: 'nundah' },
  { name: 'Northgate',        slug: 'northgate' },
  { name: 'North Lakes',      slug: 'north-lakes' },
  { name: 'Paddington',       slug: 'paddington' },
  { name: 'Petrie',           slug: 'petrie' },
  { name: 'Redcliffe',        slug: 'redcliffe' },
  { name: 'Rothwell',         slug: 'rothwell' },
  { name: 'Samford',          slug: 'samford' },
  { name: 'Sandgate',         slug: 'sandgate' },
  { name: 'Scarborough',      slug: 'scarborough' },
  { name: 'Stafford Heights', slug: 'stafford-heights' },
  { name: 'Strathpine',       slug: 'strathpine' },
  { name: 'Taigum',           slug: 'taigum' },
  { name: 'The Gap',          slug: 'the-gap' },
  { name: 'Toombul',          slug: 'toombul' },
  { name: 'Virginia',         slug: 'virginia' },
  { name: 'Warner',           slug: 'warner' },
  { name: 'Wavell Heights',   slug: 'wavell-heights' },
  { name: 'Wooloowin',        slug: 'wooloowin' },
  { name: 'Zillmere',         slug: 'zillmere' },
];

// ── Reusable block builders ─────────────────────────────────────────

function buildJsonLd(name, slug, postcode) {
  return `    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "name": "Brisbane TVs",
      "description": "Professional TV wall mounting and installation service in ${name}",
      "url": "https://brisbanetvs.com/${slug}.html",
      "telephone": "1300312271",
      "email": "hello@brisbanetvs.com",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "North Brisbane",
        "addressRegion": "QLD",
        "postalCode": "4000",
        "addressCountry": "AU"
      },
      "areaServed": {
        "@type": "Place",
        "name": "${name}",
        "address": {
          "@type": "PostalAddress",
          "addressLocality": "${name}",
          "addressRegion": "QLD",
          "postalCode": "${postcode}",
          "addressCountry": "AU"
        }
      },
      "hasOfferCatalog": {
        "@type": "OfferCatalog",
        "name": "TV Mounting Services",
        "itemListElement": [
          {
            "@type": "Offer",
            "itemOffered": {
              "@type": "Service",
              "name": "TV Wall Mounting - Bedroom Package",
              "description": "Flat or tilt bracket supplied and installed for screens 32 to 55 inches"
            },
            "price": "275.00",
            "priceCurrency": "AUD"
          },
          {
            "@type": "Offer",
            "itemOffered": {
              "@type": "Service",
              "name": "TV Wall Mounting - Living Room Package",
              "description": "Heavy-duty bracket for screens 56 to 75 inches with two-technician lift"
            },
            "price": "385.00",
            "priceCurrency": "AUD"
          },
          {
            "@type": "Offer",
            "itemOffered": {
              "@type": "Service",
              "name": "TV Wall Mounting - Cinema Package",
              "description": "Extra-heavy bracket with reinforced anchoring for screens 76 to 85 inches"
            },
            "price": "550.00",
            "priceCurrency": "AUD"
          }
        ]
      },
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "5",
        "reviewCount": "3"
      },
      "review": [
        {
          "@type": "Review",
          "reviewRating": { "@type": "Rating", "ratingValue": "5" },
          "author": { "@type": "Person", "name": "Matt Gilroy" },
          "reviewBody": "Amazing service from Tom — came out same day to mount our 65\\" TV and was done within an hour. Professional job, no fuss, at a great price."
        },
        {
          "@type": "Review",
          "reviewRating": { "@type": "Rating", "ratingValue": "5" },
          "author": { "@type": "Person", "name": "Amanda Sciortino" },
          "reviewBody": "Tom from Rentek did an amazing job mounting our new tv on the wall and concealing the cables. So happy and would certainly recommend him for his prompt, professional service at a very reasonable price!"
        },
        {
          "@type": "Review",
          "reviewRating": { "@type": "Rating", "ratingValue": "5" },
          "author": { "@type": "Person", "name": "Scott Adams" },
          "reviewBody": "A zero fuss, professional service. Quoted, arrived, and installed within a couple of hours. Found him to be a friendly and outgoing guy and recommend him to anyone. Top shelf."
        }
      ]
    }
    </script>`;
}

function buildReviewsSection(name) {
  return `<!-- Google Reviews -->
<section>
    <div class="container" style="text-align:center;">
        <p class="section-label">Customer Reviews</p>
        <h2>What ${name} Residents Say About Us</h2>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:2rem;margin-top:2rem;text-align:left;">
            <div style="background:#fff;border-radius:12px;padding:2rem;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
                <div style="color:#f59e0b;font-size:1.25rem;margin-bottom:0.75rem;">&starf;&starf;&starf;&starf;&starf;</div>
                <p style="font-style:italic;color:#475569;line-height:1.7;">&ldquo;Amazing service from Tom &mdash; came out same day to mount our 65&quot; TV and was done within an hour. Professional job, no fuss, at a great price.&rdquo;</p>
                <p style="font-weight:600;margin-top:1rem;color:#1e293b;">&mdash; Matt Gilroy</p>
            </div>
            <div style="background:#fff;border-radius:12px;padding:2rem;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
                <div style="color:#f59e0b;font-size:1.25rem;margin-bottom:0.75rem;">&starf;&starf;&starf;&starf;&starf;</div>
                <p style="font-style:italic;color:#475569;line-height:1.7;">&ldquo;Tom from Rentek did an amazing job mounting our new tv on the wall and concealing the cables. So happy and would certainly recommend him for his prompt, professional service at a very reasonable price!&rdquo;</p>
                <p style="font-weight:600;margin-top:1rem;color:#1e293b;">&mdash; Amanda Sciortino</p>
            </div>
            <div style="background:#fff;border-radius:12px;padding:2rem;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
                <div style="color:#f59e0b;font-size:1.25rem;margin-bottom:0.75rem;">&starf;&starf;&starf;&starf;&starf;</div>
                <p style="font-style:italic;color:#475569;line-height:1.7;">&ldquo;A zero fuss, professional service. Quoted, arrived, and installed within a couple of hours. Found him to be a friendly and outgoing guy and recommend him to anyone. Top shelf.&rdquo;</p>
                <p style="font-weight:600;margin-top:1rem;color:#1e293b;">&mdash; Scott Adams</p>
            </div>
        </div>
    </div>
</section>`;
}

function buildFooterSuburbLinks() {
  return allSuburbs
    .map(s => `                    <a href="${s.slug}.html">${s.name}</a>`)
    .join('\n');
}

// ── Per-file update logic ───────────────────────────────────────────

function updateFile(area) {
  const filePath = path.join(ROOT, `${area.slug}.html`);
  if (!fs.existsSync(filePath)) {
    return { slug: area.slug, status: 'missing', changes: [] };
  }

  let html = fs.readFileSync(filePath, 'utf8');
  const original = html;
  const changes = [];

  // ── 1. <title> ────────────────────────────────────────────────────
  const newTitle = `<title>TV Wall Mounting ${area.name} | From $275 | Brisbane TVs</title>`;
  if (/<title>[\s\S]*?<\/title>/i.test(html)) {
    const before = html.match(/<title>[\s\S]*?<\/title>/i)[0];
    if (before !== newTitle) {
      html = html.replace(/<title>[\s\S]*?<\/title>/i, newTitle);
      changes.push('title');
    }
  } else {
    html = html.replace(/<meta name="viewport"[^>]*>/i, m => `${m}\n    ${newTitle}`);
    changes.push('title (inserted)');
  }

  // ── 2. <meta name="description"> ──────────────────────────────────
  const newDesc = `<meta name="description" content="Professional tv wall mounting in ${area.name} ${area.postcode}. Fixed-price packages from $275. Bracket included. Cable concealment available. tv mounting ${area.name} specialists. 5-year warranty. Book today.">`;
  if (/<meta\s+name=["']description["'][^>]*>/i.test(html)) {
    html = html.replace(/<meta\s+name=["']description["'][^>]*>/i, newDesc);
    changes.push('meta description');
  } else {
    html = html.replace(/<title>[\s\S]*?<\/title>/i, m => `${m}\n    ${newDesc}`);
    changes.push('meta description (inserted)');
  }

  // ── 3. <link rel="canonical"> ─────────────────────────────────────
  const canonical = `<link rel="canonical" href="https://brisbanetvs.com/${area.slug}.html">`;
  if (/<link\s+rel=["']canonical["'][^>]*>/i.test(html)) {
    html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, canonical);
    changes.push('canonical');
  } else {
    // Insert right after the description
    html = html.replace(
      /<meta\s+name=["']description["'][^>]*>/i,
      m => `${m}\n    ${canonical}`
    );
    changes.push('canonical (inserted)');
  }

  // ── 4. LocalBusiness JSON-LD schema ───────────────────────────────
  const jsonLd = buildJsonLd(area.name, area.slug, area.postcode);
  if (/<script\s+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/i.test(html)) {
    html = html.replace(
      /<script\s+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/i,
      jsonLd.trimStart()
    );
    changes.push('JSON-LD (replaced)');
  } else {
    // Insert just before </head>
    html = html.replace(/<\/head>/i, `${jsonLd}\n</head>`);
    changes.push('JSON-LD (inserted)');
  }

  // ── 5. <h1> hero ──────────────────────────────────────────────────
  const newH1 = `<h1>TV Wall Mounting ${area.name} &mdash; Professional Installation From $275</h1>`;
  if (/<h1>[\s\S]*?<\/h1>/i.test(html)) {
    const oldH1 = html.match(/<h1>[\s\S]*?<\/h1>/i)[0];
    if (oldH1 !== newH1) {
      html = html.replace(/<h1>[\s\S]*?<\/h1>/i, newH1);
      changes.push('H1');
    }
  }

  // ── 6. Customer reviews section ───────────────────────────────────
  //    The new template puts the reviews block between the area-detail
  //    section (which ends with the CTA banner) and the blog section.
  //    Skip if already present.
  const hasReviewsSection = /Customer Reviews[\s\S]{0,400}Say About Us/i.test(html);
  if (!hasReviewsSection) {
    const reviewsBlock = buildReviewsSection(area.name);
    // Insert immediately before the blog section comment/section.
    if (/<!--\s*Blog Section\s*-->/i.test(html)) {
      html = html.replace(
        /<!--\s*Blog Section\s*-->/i,
        `${reviewsBlock}\n\n<!-- Blog Section -->`
      );
      changes.push('reviews section (before blog)');
    } else if (/<section\s+class=["']blog-section["']/i.test(html)) {
      html = html.replace(
        /<section\s+class=["']blog-section["']/i,
        `${reviewsBlock}\n\n<section class="blog-section"`
      );
      changes.push('reviews section (before blog section)');
    } else {
      // Fallback: before the booking section.
      html = html.replace(
        /<!--\s*Booking Form\s*-->/i,
        `${reviewsBlock}\n\n<!-- Booking Form -->`
      );
      changes.push('reviews section (before booking)');
    }
  }

  // ── 7. Footer suburb list → full 55 ───────────────────────────────
  //    Replace everything inside the <div class="footer-suburbs"> block.
  const footerRegex = /<div class="footer-suburbs">[\s\S]*?<\/div>/i;
  if (footerRegex.test(html)) {
    const newFooterSuburbs = `<div class="footer-suburbs">\n${buildFooterSuburbLinks()}\n                </div>`;
    html = html.replace(footerRegex, newFooterSuburbs);
    changes.push('footer suburbs (55)');
  }
  // Also strip the "Don't see your suburb?" note that used to follow the
  // 20-list block — the 55-list makes it redundant.
  html = html.replace(
    /\s*<p style="font-size:0\.8rem;color:#64748b;margin-top:1rem;">Don't see your suburb\?[\s\S]*?<\/p>/i,
    ''
  );

  // ── 8. Image alt text ─────────────────────────────────────────────
  //    Normalise the five known template images so every alt includes
  //    the suburb name and is descriptive.
  const altReplacements = [
    {
      re: /(<img\s+src=["']img\/hero-banner\.jpg["'][^>]*\salt=")[^"]*(")/gi,
      alt: `Professional TV wall mounting service in ${area.name}`
    },
    {
      re: /(<img\s+src=["']img\/tv-soundbar-mount\.jpg["'][^>]*\salt=")[^"]*(")/gi,
      alt: `TV wall mounting installation in ${area.name} home`
    },
    {
      re: /(<img\s+src=["']img\/tv-above-fireplace\.jpg["'][^>]*\salt=")[^"]*(")/gi,
      alt: `Professional TV bracket and cable management in ${area.name}`
    },
    {
      re: /(<img\s+src=["']img\/living-room-mount\.jpg["'][^>]*\salt=")[^"]*(")/gi,
      alt: `Completed TV installation in ${area.name} living room`
    },
    {
      re: /(<img\s+src=["']img\/clean-wall-mount\.jpg["'][^>]*\salt=")[^"]*(")/gi,
      alt: `TV mounting height guide for ${area.name} homes`
    },
    {
      re: /(<img\s+src=["']img\/apartment-install\.jpg["'][^>]*\salt=")[^"]*(")/gi,
      alt: `Wall types guide for ${area.name} properties`
    },
    {
      re: /(<img\s+src=["']img\/tech-installing\.jpg["'][^>]*\salt=")[^"]*(")/gi,
      alt: `Starlink internet installation in ${area.name}`
    },
  ];
  let altChanged = false;
  for (const { re, alt } of altReplacements) {
    const before = html;
    html = html.replace(re, `$1${alt}$2`);
    if (html !== before) altChanged = true;
  }
  if (altChanged) changes.push('image alt text');

  // ── write if changed ──────────────────────────────────────────────
  if (html !== original) {
    fs.writeFileSync(filePath, html, 'utf8');
    return { slug: area.slug, status: 'updated', changes };
  }
  return { slug: area.slug, status: 'no-change', changes };
}

// ── main ────────────────────────────────────────────────────────────
const results = existingAreas.map(updateFile);

console.log('\n=== Brisbane TVs :: Retrofit of 20 Existing Area Pages ===\n');
for (const r of results) {
  const tag = r.status === 'updated' ? 'UPDATED'
            : r.status === 'missing' ? 'MISSING'
            : 'NO-CHANGE';
  console.log(`[${tag}] ${r.slug}.html` + (r.changes.length ? `  →  ${r.changes.join(', ')}` : ''));
}
const updated = results.filter(r => r.status === 'updated').length;
console.log(`\nDone. ${updated}/${results.length} files modified.`);
