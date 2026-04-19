---
# ====== LOCATION PAGE TEMPLATE ======
# Drop into bulk uploader for the `locations` collection.
# Final output lives at /src/content/locations/<suburb-slug>.md and
# renders at /locations/<suburb-slug>/ using LocationPage.astro.
# Emits schema.org/LocalBusiness with geo coords + BreadcrumbList JSON-LD.

title: "TV Installation in [Suburb], Brisbane: REPLACE tagline"
description: "REPLACE: Suburb-specific value prop — name the housing type(s), the postcode, and what you do there. 140–180 chars."
heroImage: "IMAGE:hero"
heroAlt: "REPLACE: Describe hero photo — what installer doing what, what kind of property, mention suburb by name"
publishDate: 2026-04-19T09:00:00.000+10:00
updatedDate: 2026-04-19T09:00:00.000+10:00

# --- Core location identity ---
suburb: "REPLACE-Suburb-Name"
postcode: "4000"
region: "Brisbane City"

# --- Geo coords (drive LocalBusiness JSON-LD for Google Maps ranking) ---
# Get these from Google Maps: right-click the suburb centre > copy coords.
# MUST be Numbers (not strings) or Google silently drops the JSON-LD block.
latitude: -27.4677
longitude: 153.0507
travelTimeFromCbd: "8 minutes"

# --- Common wall types we see in this suburb (visible chip list) ---
commonHousingStock:
  - "Queenslander (timber frame, VJ walls)"
  - "REPLACE: Most common local housing type"
  - "REPLACE: Second most common"

# --- Nearby suburbs (internal-link skeleton, maps to /locations/<slug>/) ---
nearbySuburbs:
  - "teneriffe"
  - "fortitude-valley"
  - "bowen-hills"

# --- Services we deliver here (maps to /services/<slug>/) ---
servicesOffered:
  - "tv-wall-mounting"
  - "cable-concealment"
  - "soundbar-installation"

# --- Social proof number — keep truthful and current ---
jobCount: 340

faq:
  - q: "Can you mount a TV on [most common local wall type in this suburb]?"
    a: "REPLACE: Specific yes with technique details."
  - q: "Do you handle [edge-case property type common here]?"
    a: "REPLACE: Answer."
  - q: "How quickly can you come out to [Suburb]?"
    a: "REPLACE: Typical lead time, any same-day options."
  - q: "Do you charge extra for [postcode] / inner-city jobs?"
    a: "REPLACE: Price-parity statement (usually 'no, flat rate applies')."

tags:
  - "REPLACE-SUBURB-SLUG"
  - "REPLACE-POSTCODE"
  - "brisbane-inner-city"   # or brisbane-north / brisbane-south etc
draft: true

imageBriefs:
  - slot: "hero"
    description: "Hero — installer on a property unmistakably in this suburb. Include suburb-characteristic feature (queenslander verandah, warehouse brick, etc)."
    alt: "REPLACE: Match the image — suburb, property type, what's happening"
---

## Brisbane TVs in [Suburb]: every week, every wall type

REPLACE: 2–3 paragraphs making the case you're a genuine local to this suburb. Name specific streets, neighbourhoods, landmarks. Mention at least one concrete suburb-specific install story or number. This is where Google figures out if you're a local authority or a carpet-bomber.

## Access notes for [Suburb] bookings

REPLACE: Anything specific about working in this suburb — parking, lift bookings, heritage-listing issues, strata approvals, typical access times. Genuinely useful info, not filler.

## What [Suburb] customers book most

REPLACE: Quick percentage breakdown of your mix in this suburb (wall-mount vs cable concealment vs other). Helps the reader self-identify their job type.

- [Most booked service] — approx X%
- [Second] — approx X%
- [Third] — approx X%

Whatever wall you've got and whatever size TV is sitting in its box in the hallway, we'll be in and out in a single afternoon.
