// update-main-pages.js
// Updates services.html, about.html, and book.html with:
// 1. SEO meta tags (title, description, canonical, OG)
// 2. Full 55-suburb footer
// 3. Blog link in main nav
// 4. Improved image alt text (services.html)
// 5. Heading hierarchy (services.html SEO-friendly H2s)
// 6. LocalBusiness JSON-LD schema (services.html, about.html)

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

// ----- Suburb list (alphabetical) -----
const SUBURBS = [
    ['albany-creek', 'Albany Creek'],
    ['arana-hills', 'Arana Hills'],
    ['ascot', 'Ascot'],
    ['ashgrove', 'Ashgrove'],
    ['aspley', 'Aspley'],
    ['banyo', 'Banyo'],
    ['bardon', 'Bardon'],
    ['boondall', 'Boondall'],
    ['bracken-ridge', 'Bracken Ridge'],
    ['brendale', 'Brendale'],
    ['bridgeman-downs', 'Bridgeman Downs'],
    ['brighton', 'Brighton'],
    ['carseldine', 'Carseldine'],
    ['cashmere', 'Cashmere'],
    ['chermside', 'Chermside'],
    ['chermside-west', 'Chermside West'],
    ['clayfield', 'Clayfield'],
    ['clontarf', 'Clontarf'],
    ['dakabin', 'Dakabin'],
    ['deagon', 'Deagon'],
    ['eatons-hill', 'Eatons Hill'],
    ['ferny-grove', 'Ferny Grove'],
    ['fitzgibbon', 'Fitzgibbon'],
    ['geebung', 'Geebung'],
    ['grange', 'Grange'],
    ['griffin', 'Griffin'],
    ['hamilton', 'Hamilton'],
    ['hendra', 'Hendra'],
    ['joyner', 'Joyner'],
    ['kallangur', 'Kallangur'],
    ['kedron', 'Kedron'],
    ['kelvin-grove', 'Kelvin Grove'],
    ['mango-hill', 'Mango Hill'],
    ['mcdowall', 'McDowall'],
    ['nudgee', 'Nudgee'],
    ['nundah', 'Nundah'],
    ['northgate', 'Northgate'],
    ['north-lakes', 'North Lakes'],
    ['paddington', 'Paddington'],
    ['petrie', 'Petrie'],
    ['redcliffe', 'Redcliffe'],
    ['rothwell', 'Rothwell'],
    ['samford', 'Samford'],
    ['sandgate', 'Sandgate'],
    ['scarborough', 'Scarborough'],
    ['stafford-heights', 'Stafford Heights'],
    ['strathpine', 'Strathpine'],
    ['taigum', 'Taigum'],
    ['the-gap', 'The Gap'],
    ['toombul', 'Toombul'],
    ['virginia', 'Virginia'],
    ['warner', 'Warner'],
    ['wavell-heights', 'Wavell Heights'],
    ['wooloowin', 'Wooloowin'],
    ['zillmere', 'Zillmere'],
];

// Build footer suburb HTML block (same format as area pages)
function buildFooterSuburbs() {
    const lines = SUBURBS
        .map(([slug, name]) => `                    <a href="${slug}.html">${name}</a>`)
        .join('\n');
    return `                <div class="footer-suburbs">\n${lines}\n                </div>`;
}

// Build LocalBusiness JSON-LD schema for services / about pages
function buildLocalBusinessSchema(url) {
    return `    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "name": "Brisbane TVs",
      "description": "Professional TV wall mounting, cable concealment, Starlink installation, and home audio services across North Brisbane.",
      "url": "${url}",
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
        "name": "North Brisbane"
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

// Build the <head> block for a page
function buildHead({ title, description, canonical, includeSchema }) {
    const schemaBlock = includeSchema ? '\n' + buildLocalBusinessSchema(canonical) : '';
    return `<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <meta name="description" content="${description}">
    <link rel="canonical" href="${canonical}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${canonical}">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:site_name" content="Brisbane TVs">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Open+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="css/style.css">${schemaBlock}
</head>`;
}

// Build nav block with Blog link
const NAV_BLOCK = `        <nav>
            <ul>
                <li><a href="index.html">Home</a></li>
                <li><a href="services.html">Services &amp; FAQ</a></li>
                <li><a href="about.html">About Us</a></li>
                <li><a href="blog.html">Blog</a></li>
                <li><a href="book.html">Book Online</a></li>
            </ul>
        </nav>`;

// Replace <head>...</head>
function replaceHead(html, newHead) {
    return html.replace(/<head>[\s\S]*?<\/head>/, newHead);
}

// Replace <nav>...</nav> with new nav
function replaceNav(html) {
    return html.replace(/<nav>[\s\S]*?<\/nav>/, NAV_BLOCK);
}

// Replace the Service Areas footer block (the column containing <h4>Service Areas</h4>)
function replaceFooterSuburbs(html) {
    const newSuburbsBlock = buildFooterSuburbs();
    // Replace the entire existing <div class="footer-suburbs">...</div>
    const suburbsDivRegex = /<div class="footer-suburbs">[\s\S]*?<\/div>/;
    if (!suburbsDivRegex.test(html)) {
        console.warn('  footer-suburbs div not found');
        return html;
    }
    return html.replace(suburbsDivRegex, newSuburbsBlock.trimStart());
}

// ----- services.html ONLY -----
function updateServicesContent(html) {
    // Change H2 headings on the 3 service-detail sections
    html = html.replace(
        /<h2>TV Wall Mounting<\/h2>/,
        '<h2>Professional TV Wall Mounting in Brisbane</h2>'
    );
    html = html.replace(
        /<h2>Starlink Internet Installation<\/h2>/,
        '<h2>Starlink Internet Installation Brisbane</h2>'
    );
    html = html.replace(
        /<h2>Home Audio &amp; Soundbars<\/h2>/,
        '<h2>Home Audio &amp; Soundbar Wall Mounting</h2>'
    );
    return html;
}

// ----- Process a page -----
function processPage(filename, headOpts, { servicesContent = false } = {}) {
    const filepath = path.join(ROOT, filename);
    let html = fs.readFileSync(filepath, 'utf8');

    const newHead = buildHead(headOpts);
    html = replaceHead(html, newHead);
    html = replaceNav(html);
    html = replaceFooterSuburbs(html);

    if (servicesContent) {
        html = updateServicesContent(html);
    }

    fs.writeFileSync(filepath, html, 'utf8');
    console.log(`Updated: ${filename}`);
}

// ----- Run -----
processPage('services.html', {
    title: 'TV Wall Mounting Services Brisbane | TV Installation, Cable Concealment & Starlink | Brisbane TVs',
    description: 'Professional TV wall mounting services across Brisbane. Fixed-price packages from $275. Cable concealment, Starlink installation, soundbar mounting. 5-year warranty. Book online.',
    canonical: 'https://brisbanetvs.com/services.html',
    includeSchema: true,
}, { servicesContent: true });

processPage('about.html', {
    title: "About Brisbane TVs | Brisbane's TV Wall Mounting Specialists | Operated by Rentek",
    description: 'Brisbane TVs is operated by Rentek, providing professional TV wall mounting and AV installation across North Brisbane. Fully insured, police-checked technicians. 5-year warranty.',
    canonical: 'https://brisbanetvs.com/about.html',
    includeSchema: true,
});

processPage('book.html', {
    title: 'Book TV Wall Mounting Brisbane | Get a Fixed-Price Quote | Brisbane TVs',
    description: 'Book your TV wall mounting in Brisbane online. Fixed-price quotes within 60 minutes via SMS. Same-day availability. From $275 with bracket included.',
    canonical: 'https://brisbanetvs.com/book.html',
    includeSchema: false,
});

console.log('Done.');
