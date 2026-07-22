# Brisbane TVs Analytics Design Certificate

Status: binding for `/operations/analytics/`

## The marriage

This page joins three kinds of evidence into one improvement loop:

1. **Google Search Console** — whether Brisbane customers can find a Brisbane TVs page.
2. **Consented GA4** — what people who allow analytics do after opening the site.
3. **Saved enquiries** — whether visits become real enquiries, independent of analytics consent.

The page exists to help one person answer: **What should I improve next, and what evidence says it matters?**

If a piece of content does not help answer one of the questions below, it does not belong on this page:

- Are people finding us?
- Are they opening the result?
- Which pages hold attention?
- Are they moving toward an enquiry?
- What is the next page-level action?

## Required reading order

Every viewport must preserve this order:

1. **Site pulse** — Find → Visit → Engage → Enquire.
2. **Do next** — a short, ranked page-improvement queue.
3. **Attention** — popular landing pages, time engaged and browsing depth.
4. **Acquisition** — search and channel evidence that explains how people arrived.
5. **Collection health** — enough diagnostics to trust the report, visually secondary.
6. **Definitions and privacy** — plain-language meaning and limitations.

Health checks never outrank customer or improvement information when reporting is healthy.

## Component contract

- One page title and one short purpose sentence.
- One reporting-state line and one refresh action.
- Four primary outcome cards at most: Find, Visit, Engage and Enquire.
- A ranked action card must contain: page, reason, one recommended action, evidence, and no more than three top queries by default.
- Supporting lists use a shared row pattern: label on the left; one primary value and one optional explanation on the right.
- Definitions live beside their first use or in the final glossary. The same definition is not repeated in several panels.
- Advanced diagnostics use disclosure or a clearly secondary region.
- Empty and unavailable states explain the difference between zero data, no consent and a broken connection.

## Definitions that must not drift

| Label | Required meaning |
| --- | --- |
| Search impression | A Brisbane TVs result appeared in Google. It is not a website visit. |
| Search click | A person opened Brisbane TVs from a Google result. |
| Click-through rate | Search clicks divided by search impressions. |
| Average position | The average Google result position across impressions. A smaller number is better. |
| Session | A consented GA4 visit. It excludes visitors who decline analytics. |
| Engaged session | GA4's engaged-session count for consented visits. |
| Engagement rate | Engaged sessions divided by sessions. |
| Average engaged time | User-engagement seconds divided by sessions for a landing page. It is not literal total time with a tab open. |
| Views per session | Page views divided by consented sessions; a browsing-depth signal. |
| Saved enquiry | An accepted enquiry stored in Operations, regardless of analytics consent. |
| GA lead event | A consented `generate_lead` event. It is a collection check, not the authoritative lead total. |

The interface must never claim to know *why* a person left. It may show observable drop-off signals — short engaged time, low engagement, or shallow browsing — and label them as signals requiring a page review.

## Visual law

- Use one UI sans-serif stack throughout the analytics page. Data is not editorial content and does not use a decorative serif.
- Default body copy is at least 14 px; explanatory copy is at least 13 px; compact labels are at least 11 px.
- Use an 8 px spacing rhythm. Cards use 16–24 px internal spacing.
- Content width is bounded; text does not stretch across the full monitor.
- Values, labels and comparisons align consistently. No metric is presented as loose text.
- Colour communicates state only and is always paired with text.
- Dark and light themes keep the same hierarchy and meet readable contrast.
- At 390 px, cards become one column, filters remain reachable, and the page has no horizontal scroll.
- Dynamically-created elements must receive the same styles as server-rendered elements. Astro-scoped selectors alone are not sufficient for runtime cards.

## Content admission test

Before adding or retaining anything, answer all five:

1. Which required question does it answer?
2. What decision can DeAndre make from it?
3. Is the label defined in ordinary language?
4. Is the data authoritative for the claim being made?
5. Does it still work in dark mode, light mode and at 390 px?

If any answer is missing, revise the content or remove it.

## Acceptance certificate

The page is ready only when:

- the first screen communicates Find → Visit → Engage → Enquire;
- the highest-priority improvement and its evidence are visible without decoding a table;
- popular pages show sessions, engaged time and depth in human units;
- drop-off language is honest about what the data can and cannot prove;
- every visible metric has one stable definition;
- runtime-created opportunity cards are fully styled;
- keyboard controls, focus states and semantic headings work;
- there are no console errors or horizontal overflow at desktop, tablet or 390 px;
- tests and the production build pass.
