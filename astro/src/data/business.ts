/**
 * Single source of truth for Brisbane TVs business facts.
 *
 * Extracted from the owner (Tom) on 2026-04-19:
 *   - Phone:  0432 145 101
 *   - Email:  admin@brisbanetvs.com
 *   - Package pricing + size tiers (see `packages` below)
 *
 * Import this anywhere you'd otherwise hard-code a phone number, email,
 * price, or size range so we don't drift again. If Tom updates anything,
 * we change it here once and the whole site follows.
 */

export const BUSINESS = {
  name: "Brisbane TVs",
  phoneDisplay: "0432 145 101",
  phoneTel: "tel:0432145101", // href-safe form (no spaces)
  email: "admin@brisbanetvs.com",
  mailto: "mailto:admin@brisbanetvs.com",
  abn: "12 345 678 901",
  hoursDisplay: "7 days · 7 AM–7 PM",
  /**
   * n8n webhook endpoints. All form types currently funnel through the
   * single /api/n8n/lead Cloudflare Pages Function, which proxies to the
   * "Brisbane TVs — Lead Webhook" n8n workflow. The flow's Code node
   * branches on the `source` field in the JSON payload (set by each form)
   * to differentiate "subscriber" vs "quote" vs "callback" etc.
   *
   * If individual flows are ever split out later, replace the relevant
   * URL here — every form imports BUSINESS.webhooks.* so the routing
   * change is a one-file edit.
   */
  webhooks: {
    quickQuote: "/api/n8n/lead",
    photoQuote: "/api/n8n/lead",
    callBack: "/api/n8n/lead",
    emailSignup: "/api/n8n/lead",
    bookingRequest: "/api/n8n/lead",
  },
} as const;

/**
 * Package pricing — canonical list powering /pricing/ and /quote/ pages.
 * priceAud === null means "submit info for a custom quote" (oversize TVs
 * or the 60–70" tier which Tom still needs to finalise).
 */
export type Package = {
  id: string;
  name: string;
  tagline: string;
  sizeMin: number;
  sizeMax: number | null; // null = unbounded (e.g. 100+)
  sizeLabel: string;
  priceAud: number | null;
  priceLabel: string;
  highlights: string[];
  ctaLabel: string;
};

export const PACKAGES: Package[] = [
  {
    id: "basic",
    name: "Basic TV Mount Package",
    tagline: "Small living rooms, bedrooms, office TVs.",
    sizeMin: 40,
    sizeMax: 55,
    sizeLabel: "40–55 inch",
    priceAud: 289,
    priceLabel: "From $289",
    highlights: [
      "Wall-mount supplied + fitted",
      "Stud-mounted onto any timber/steel frame",
      "Cables tidied with raceway",
      "2-hour window, usually done in 60 min",
    ],
    ctaLabel: "Book the Basic package",
  },
  {
    id: "living-room",
    name: "Living Room Package",
    tagline: "The standard family TV size — flush mount or tilt.",
    sizeMin: 60,
    sizeMax: 70,
    sizeLabel: "60–70 inch",
    // Tom hasn't finalised this price yet (2026-04-19: "now just need prices")
    priceAud: null,
    priceLabel: "Get a quote",
    highlights: [
      "Heavy-duty tilt or fixed mount included",
      "Stud-mounted + levelled",
      "In-wall cable concealment available as an add-on",
      "Typically a 2–3 hour booking",
    ],
    ctaLabel: "Request a Living Room quote",
  },
  {
    id: "xl-living-room",
    name: "XL Living Room Package",
    tagline: "Big family TVs where bracket + stud spec matters.",
    sizeMin: 75,
    sizeMax: 85,
    sizeLabel: "75–85 inch",
    priceAud: 385,
    priceLabel: "From $385",
    highlights: [
      "Heavy-load-rated bracket supplied + fitted",
      "Double-stud anchoring",
      "Pre-install levelling + eye-line check",
      "In-wall cable conceal available",
    ],
    ctaLabel: "Book the XL Living Room package",
  },
  {
    id: "cinema",
    name: "Cinema Package",
    tagline: "Home-cinema-size TVs — the one the neighbours ask about.",
    sizeMin: 87,
    sizeMax: 100,
    sizeLabel: "87–100 inch",
    priceAud: 450,
    priceLabel: "From $450",
    highlights: [
      "Cinema-rated full-motion or fixed bracket",
      "Multi-stud or brick/concrete anchor work",
      "2-installer booking for safe lift + align",
      "Optional soundbar mount + power relocation",
    ],
    ctaLabel: "Book the Cinema package",
  },
  {
    id: "xl-cinema",
    name: "XL Cinema Package",
    tagline: "Oversize TVs — every install is bespoke.",
    sizeMin: 100,
    sizeMax: null,
    sizeLabel: "100 inch +",
    priceAud: null,
    priceLabel: "Custom quote",
    highlights: [
      "Site check before booking (wall + access)",
      "Engineered bracket + anchor spec",
      "2–3 installer crew depending on size/weight",
      "Photo of your wall helps us quote faster",
    ],
    ctaLabel: "Submit info for a custom quote",
  },
];

/**
 * Helper: given a TV size in inches, return the matching package.
 * Falls back to the XL Cinema package for anything below 40" or above
 * the range (oversize handled by custom quote).
 */
export function packageForSize(inches: number): Package {
  const p = PACKAGES.find(
    (pkg) => inches >= pkg.sizeMin && (pkg.sizeMax === null || inches <= pkg.sizeMax),
  );
  return p ?? PACKAGES[PACKAGES.length - 1]; // XL Cinema as fallback
}
