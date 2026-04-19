---
# ====== PRODUCT PAGE TEMPLATE ======
# Drop into bulk uploader for the `products` collection (TVs, soundbars,
# media boxes, cables, accessories).
# Final output lives at /src/content/products/<slug>.md and renders at
# /products/<slug>/ using ProductPage.astro.
# Emits schema.org/Product + Offer + AggregateRating + BreadcrumbList JSON-LD.

title: "REPLACE: Brand Model Size Type (e.g. 'Samsung S95D 65\" QD-OLED TV')"
description: "REPLACE: One-sentence value prop including the KEY spec and why Brisbane buyers care. 140–180 chars."
heroImage: "IMAGE:hero"
heroAlt: "REPLACE: Describe the product photo — the product, its context, what it's doing"
publishDate: 2026-04-19T09:00:00.000+10:00
updatedDate: 2026-04-19T09:00:00.000+10:00

# --- Identity ---
brand: "Samsung"
model: "QA65S95DAWXXY"
sku: "S95D-65-AU"          # omit if you don't carry an SKU
category: "tv"              # tv | soundbar | media-box | cable | accessory

# --- Pricing (drives Offer JSON-LD) ---
priceAud: 4299
priceWas: 5499              # omit if no discount
availability: "InStock"     # InStock | OutOfStock | PreOrder

# --- Specs (drive the visible table AND additionalProperty JSON-LD) ---
# Leave any field blank/remove if not applicable to this product category.
screenSizeInches: 65
resolution: "3840 × 2160 (4K UHD)"
panelType: "QD-OLED"
refreshRateHz: 144
hdrSupport:
  - "HDR10+"
  - "HLG"
vesa: "300 × 300"
weightKg: 21.3

# --- Installer verdict (populates Pros/Cons + shapes the review copy) ---
pros:
  - "REPLACE: Strongest feature"
  - "REPLACE: Second strongest"
  - "REPLACE: Third"
cons:
  - "REPLACE: Honest limitation"
  - "REPLACE: Second one"

# --- Rating (only fill in if truly based on reviews — otherwise omit both) ---
rating: 4.8
reviewCount: 214

# --- External affiliate link (flagged rel=sponsored when emitted) ---
affiliateUrl: "https://www.samsung.com/au/tvs/oled-tv/s95d-..."

# --- Cross-link to bracket recommendations (maps to /mounts/<slug>/) ---
recommendedMounts:
  - "sanus-vmpl50a-b1"
  - "vogels-tvm-7675-full-motion"

tags:
  - "REPLACE-BRAND-SLUG"
  - "REPLACE-CATEGORY"
  - "REPLACE-SIZE-SLUG"
draft: true

imageBriefs:
  - slot: "hero"
    description: "Product hero — product in a real Brisbane living-room context (not a clinical studio shot). Square 1:1 crop works best."
    alt: "REPLACE: Describe the product in the image and its setting"
---

## Why we recommend this product for Brisbane buyers

REPLACE: 2–3 paragraphs. Lead with the *Brisbane context* — sunny living rooms, humidity, apartment-vs-queenslander considerations, whatever applies. Make it obvious you actually install the product, not just list it.

## Installation notes

REPLACE: Product-specific install tips. Weight, VESA, cable arrangement, any quirks. This section is why installers will read (and link to) your page.

- Weight considerations
- VESA compatibility
- Any cable/port considerations
- Recommended placement

## Bottom line

REPLACE: One-paragraph verdict. Make the buy/skip call clear.
