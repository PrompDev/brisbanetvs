---
# ====== MOUNT PAGE TEMPLATE ======
# Drop into bulk uploader for the `mounts` collection (TV wall brackets).
# Final output lives at /src/content/mounts/<slug>.md and renders at
# /mounts/<slug>/ using MountPage.astro.
# Emits schema.org/Product + Offer + additionalProperty spec list + BreadcrumbList.

title: "REPLACE: Brand Model (range) Mount Type (e.g. 'Sanus VMPL50A-B1 Full-Motion TV Mount (32\"–75\")')"
description: "REPLACE: Lead with the weight rating + size range + the one differentiator. 140–180 chars."
heroImage: "IMAGE:hero"
heroAlt: "REPLACE: Describe the bracket photo — state whether it's folded against wall or extended"
publishDate: 2026-04-19T09:00:00.000+10:00
updatedDate: 2026-04-19T09:00:00.000+10:00

# --- Identity ---
brand: "Sanus"
model: "VMPL50A-B1"
sku: "VMPL50A-B1-AU"
mountType: "full-motion"     # fixed | tilt | full-motion | ceiling | outdoor

# --- Pricing (drives Offer JSON-LD) ---
priceAud: 389
priceWas: 479                # omit if no discount
availability: "InStock"       # InStock | OutOfStock | PreOrder

# --- Compatibility (the spec customers actually buy on) ---
minScreenInches: 32
maxScreenInches: 75
maxWeightKg: 56
vesaMin: "100 × 100"
vesaMax: "600 × 400"

# --- Motion & geometry (omit fields that don't apply, e.g. tilt-only mounts) ---
tiltDegrees: 15
swivelDegrees: 90
extensionMm: 510
profileMm: 52
finish: "Matte black, powder-coated steel"

pros:
  - "REPLACE: Weight rating, honestly rated (not just advertised)"
  - "REPLACE: Visual flush-ness when folded"
  - "REPLACE: Any pro installer would appreciate this"
cons:
  - "REPLACE: Honest limitation — weight, price, install complexity"
  - "REPLACE: Second limitation"

# --- Rating (only if genuine) ---
rating: 4.9
reviewCount: 128

affiliateUrl: "https://www.sanus.com/en_AU/products/full-motion-mounts/..."

# --- Cross-link to compatible TVs in the products collection ---
compatibleTvs:
  - "samsung-s95d-65-oled"
  - "lg-c4-65-oled"

tags:
  - "REPLACE-MOUNT-TYPE"
  - "REPLACE-BRAND-SLUG"
  - "REPLACE-SIZE-CLASS"      # e.g. 'heavy-duty', 'mid-range', 'budget'
draft: true

imageBriefs:
  - slot: "hero"
    description: "Bracket hero — either folded flush against a wall or extended with a TV attached. Match the mountType — full-motion should show the articulation."
    alt: "REPLACE: Describe the bracket state in the image"
---

## Why we install this bracket in Brisbane

REPLACE: 2–3 paragraphs. Lead with the *three specs installers care about*: honest weight rating, folded profile, wall compatibility. Pull numbers directly from the manufacturer's spec sheet and compare them to the rest of the category.

## Compatibility quick-check

- **TV size:** REPLACE
- **TV weight:** up to REPLACE kg
- **VESA range:** REPLACE
- **Wall type:** REPLACE (timber stud / brick / concrete combinations; note anything it CAN'T do like hollow-wall-only)
- **Extension:** REPLACE mm at full reach

## Installation notes

REPLACE: Two-person or solo? Specific anchors we'd use on brick / stud / concrete. Any known quirks (cable channel limits, arm travel limits, required tools).

## Bottom line

REPLACE: One-paragraph buy/skip verdict with a clear recommendation tier ("premium, mid-range, budget-of-last-resort").
