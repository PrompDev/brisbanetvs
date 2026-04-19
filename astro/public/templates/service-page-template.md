---
# ====== SERVICE PAGE TEMPLATE ======
# Drop this file into the bulk uploader for the `services` collection.
# Each IMAGE:xxx placeholder maps to an entry in imageBriefs below; the
# uploader rewrites them to /media/... paths when you upload real images.
# Final output lives at /src/content/services/<slug>.md and renders at
# /services/<slug>/ using src/layouts/ServicePage.astro.

title: "REPLACE: Service name (60–90 chars, include Brisbane if possible)"
description: "REPLACE: One-sentence value prop with price hook and location — 140–180 chars for perfect SERP display."
heroImage: "IMAGE:hero"
heroAlt: "REPLACE: Describe the photo including suburb + visual detail (minimum 8 chars, be specific)"
publishDate: 2026-04-19T09:00:00.000+10:00
updatedDate: 2026-04-19T09:00:00.000+10:00

# --- Pricing (drives schema.org/Service Offer JSON-LD) ---
priceFrom: 189
priceTo: 449               # omit if single price
priceCurrency: "AUD"
priceUnit: "per job (flat rate)"
duration: "60–120 minutes on-site"

# --- Why choose us (renders as visible checklist) ---
highlights:
  - "First bullet — lead with the strongest differentiator"
  - "Insurance / certification line"
  - "Materials / technical capability line"
  - "Warranty line"
  - "Add-on value (e.g. tuning, pairing included)"

# --- Where we deliver this service ---
serviceArea:
  - "New Farm"
  - "Paddington"
  - "Bulimba"
  - "Bardon"
  - "West End"

# --- Warranty (shown as a section + fed into termsOfService in Service JSON-LD) ---
warranty: "REPLACE: What's covered and for how long."

# --- Internal-link skeleton (pulls into the 'Related on Brisbane TVs' section) ---
relatedServices:
  - "cable-concealment"
  - "soundbar-installation"
relatedLocations:
  - "new-farm"
  - "paddington"

# --- FAQ (renders as accordion + FAQPage JSON-LD) ---
# 4–6 entries is the sweet spot. Lead with price / cost questions.
faq:
  - q: "How much does this service cost in Brisbane?"
    a: "REPLACE: Answer with the concrete price range and what drives it up/down."
  - q: "Can you work on [hardest wall type / edge case]?"
    a: "REPLACE: Yes/no with specifics."
  - q: "How quickly can you come out?"
    a: "REPLACE: Typical lead time + emergency slot policy."

tags:
  - "REPLACE-PRIMARY-TAG"
  - "brisbane"
  - "REPLACE-MODIFIER-TAG"
draft: true

imageBriefs:
  - slot: "hero"
    description: "Hero shot — installer on-site mid-job in a Brisbane home. Shoot landscape 4:3, natural daylight."
    alt: "REPLACE: Describe hero image — who is in it, what suburb/setting, what's happening"
---

## Why most Brisbane customers book this service

REPLACE: 1–2 paragraphs of *specific* Brisbane context — which suburbs/wall types/problems this service solves. Drop real numbers wherever you can. This is the paragraph Google uses for snippet selection, so lead with the keyword but don't repeat it.

## What the job actually looks like

**Pre-visit.** REPLACE: What we confirm before arriving.

**On the day.** REPLACE: Team size, tools, what gets done, typical duration.

**Handover.** REPLACE: Photo pack, warranty doc, follow-up contact.

## [Tailored section — wall types, use cases, room types, etc.]

REPLACE: A section the reader learns from. Could be "Wall types we install on", "Room setups we handle", "Warranties explained". Give *useful* detail, not marketing copy.

## Pricing in 2026

REPLACE: Re-state the price range with 3–4 worked-example tiers. Be specific about what's included at each tier and what's an add-on. Customers convert on this section.

- Tier 1 — $XXX
- Tier 2 — $XXX
- Tier 3 — $XXX

Add-ons quoted line-by-line.
