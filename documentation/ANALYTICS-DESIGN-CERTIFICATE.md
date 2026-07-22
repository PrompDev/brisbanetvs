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
- What will the agent change, where will it start, and how will we decide whether the change won?

## Required reading order

Every viewport must preserve this order:

1. **Site pulse** — Find → Visit → Engage → Enquire.
2. **Improvement loop** — Detect → Task → Publish → Measure → Decide.
3. **Do next** — a short, ranked page-improvement queue whose cards are ready to hand to an agent.
4. **Attention** — popular landing pages, time engaged and browsing depth.
5. **Acquisition** — search and channel evidence that explains how people arrived.
6. **Collection health** — enough diagnostics to trust the report, visually secondary.
7. **Definitions and privacy** — plain-language meaning and limitations.

Health checks never outrank customer or improvement information when reporting is healthy.

## Component contract

- One page title and one short purpose sentence.
- One reporting-state line and one refresh action.
- Four primary outcome cards at most: Find, Visit, Engage and Enquire.
- A ranked action card must contain: public page, likely source file or a route-tracing instruction, reason, evidence baseline, hypothesis, one focused change, success rule, and no more than three top queries by default.
- Every ranked action card has an **Open live page** action and a **Copy agent task** action. Copying prepares a task; it never starts an autonomous edit or release.
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

The private `/operations/*` workspace is never customer evidence. Its layouts must not load the public analytics client; the client must refuse to run there if included accidentally; reporting requests and output sanitizers must exclude Operations paths. The public homepage is displayed as **Homepage (/)** rather than an unexplained slash.

## Agent task contract

Every copied SEO task must carry enough context for a fresh agent to act without guessing:

1. the public URL and likely repo source, with an instruction to verify both before editing;
2. the exact final Search Console reporting window and its baseline impressions, clicks, click-through rate and position;
3. any matching consented landing-page behaviour and saved-enquiry evidence, with missing matches described as missing rather than zero;
4. no more than three privacy-safe visible queries;
5. a clearly labelled hypothesis that the agent must verify against the live page;
6. one focused change, truthful-content constraints, the Operations analytics exclusion and required validation;
7. a release record: files changed, exact change, publication date and starting baseline;
8. a success rule and review timing: the first complete 28 post-release days, read only after Search Console finalises them;
9. a final decision: keep, iterate or undo, with the result fed into the next task.

The task must explicitly permit a **no change** result when the evidence is weak or the proposed content would be misleading. The dashboard recommends; DeAndre decides when to task an agent and when to publish.

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
- the five-step improvement loop explains how a recommendation becomes a measured decision;
- the highest-priority improvement and its evidence are visible without decoding a table;
- every priority can be copied as a complete, source-aware agent task with a baseline and success rule;
- popular pages show sessions, engaged time and depth in human units;
- drop-off language is honest about what the data can and cannot prove;
- every visible metric has one stable definition;
- private Operations activity is excluded at collection and reporting boundaries;
- runtime-created opportunity cards are fully styled;
- keyboard controls, focus states and semantic headings work;
- there are no console errors or horizontal overflow at desktop, tablet or 390 px;
- tests and the production build pass.
