---
# ============================================================
# Brisbane TVs — Blog Post Briefing & Template
# ============================================================
# This file serves three purposes at once:
#   1. The schema reference for the blog content collection.
#   2. The system prompt for any agent (Claude, etc.) tasked with
#      drafting a post — read the whole file before writing.
#   3. A worked example, shown at the bottom, that a valid post
#      can be copy-pasted from.
#
# Every section in the WRITING BRIEF below is load-bearing — if
# an agent ignores a rule here, the post gets rejected by either
# Zod validation, the CMS, or (worse) Google.
# ============================================================
#
# ──────────────────────────────────────────────────────────
# WRITING BRIEF — read this before drafting
# ──────────────────────────────────────────────────────────
#
# ## Who this is for
# Brisbane TVs is a Brisbane-based TV installation service covering 109
# suburbs. The primary reader is a homeowner researching a specific install
# problem (cable concealment, heritage walls, big-screen fitment, outdoor
# TVs) or a suburb (people Googling "TV mounting Paddington"). Secondary
# readers are renters, real-estate stylists, and AV retailers.
#
# Serve the reader first, Google second. The best-ranking Brisbane TVs
# posts answer a concrete install question with a specific number, a
# specific method, and a specific price floor. Fluff gets cut.
#
# ## Title rules (frontmatter: title)
# - 8–120 characters. Zod will reject outside this range.
# - Must contain the primary keyword, front-loaded.
# - Location posts: suburb FIRST ("TV Mounting in Paddington: A Field
#   Guide to Heritage Queenslanders"), not last.
# - Service posts: outcome FIRST ("Hide TV Cables Inside the Wall: A
#   Brisbane Homeowner's Guide"), method second.
# - No clickbait ("You Won't Believe…"), no list-count padding
#   ("Top 10 Amazing…"), no em-dash-cluster headings.
#
# ## Description rules (frontmatter: description)
# - 40–200 characters. Zod will reject outside this range.
# - This is the meta description — it's the click-through pitch on
#   Google search results and the link-preview copy on social.
# - Lead with the reader's problem or payoff, not our brand.
# - Include a concrete specificity: a price, a timeframe, a method, or
#   a risk. Example: "Same-day install from $179, Brisbane-wide."
# - Never repeat the title verbatim.
#
# ## H2 structure (body)
# - 4–7 H2 headings in the body. Each H2 maps to a real sub-question
#   the reader has, written in plain-English question form where natural.
# - Order matters. A strong pattern is:
#     H2 #1 — "What you're actually asking about" (reframe the problem)
#     H2 #2 — "Why this is harder than it looks" (expertise signal)
#     H2 #3 — "How we do it" (method, numbered steps where useful)
#     H2 #4 — "What it costs in Brisbane" (local pricing, concrete floor)
#     H2 #5 — "What can go wrong" or "When NOT to do this" (honesty)
#     H2 #6 — "Frequently asked" (FAQ block — Google surfaces FAQ rich
#             results for these)
# - At least one H2 must carry a local angle ("Why Queenslanders make
#   this harder", "How Brisbane humidity affects outdoor TVs", etc.)
#   because local specificity is our competitive moat.
# - H3s are fine for sub-structure inside an H2; they don't appear in
#   the on-page table of contents, so don't rely on them for navigation.
#
# ## Paragraph + sentence discipline
# - Paragraphs: max ~120 words. Break the moment the reader is waiting.
# - Sentences: max ~25 words, most should be shorter.
# - Opening paragraph hooks with the reader's concrete situation, not
#   with a dictionary-style definition. The first paragraph also gets
#   an automatic drop-cap on the custom layout if it's ≥40 chars, so
#   make it count.
# - Second paragraph sets up what the post will give them ("here's
#   what we actually do, what it costs, and where it goes wrong").
# - Use concrete numbers wherever possible: wall thickness in mm,
#   stud spacing, TV weight, suburb names, year figures, price floors.
#
# ## Keyword discipline
# - Primary keyword in: title, slug (= filename), H1 (= title), first
#   paragraph, at least one H2. That's the full extent. Do NOT stuff.
# - Weave 2–4 related keywords ("related terms" from a SERP scan)
#   naturally through the body. If it feels forced, it is — rewrite.
# - Internal keyword cannibalisation is a bigger risk than missing a
#   keyword. Before drafting, confirm no existing post already targets
#   the same primary phrase.
#
# ## Internal linking (mandatory)
# Every post must include:
#   - At least 2 links to relevant /services/ or /locations/ pages.
#   - 1 link to a relevant prior blog post if one exists.
#   - A tel: link to 1300 312 271 somewhere in the body.
#   - A link to /book/ as the primary CTA.
# Anchor text must be natural — never "click here".
#
# ## Trust markers (weave in, don't list)
# - 5-year warranty on every install.
# - 109 Brisbane suburbs covered.
# - Brisbane-only — not a franchise, not a national chain.
# - Installers answer the phone on 1300 312 271.
# Mention at least two of these in every post, in context, not as a
# boilerplate paragraph.
#
# ## Length + readTime
# - Sweet spot: 1,200–1,800 words for most service guides, 800–1,200
#   for quick-answer posts, 2,000+ only when the topic genuinely
#   demands it (comprehensive suburb guides, comparison posts).
# - Set readTime to ceil(word_count / 220). Round UP to whole minutes.
#
# ──────────────────────────────────────────────────────────
# IMAGE PLACEMENT PLAYBOOK
# ──────────────────────────────────────────────────────────
#
# Posts with real job photos out-rank posts with stock imagery by a
# wide margin in our category. The standard layout is:
#
#   - HERO (required, slot name: hero)
#     Wide landscape, 16:9 or wider, ≥1600px on the long edge.
#     The finished install in context — TV on, room lit, no visible
#     cables, whole wall or room visible (not a close-up).
#     This is above the fold. It carries the most SEO weight.
#
#   - INLINE-1 (required)
#     Placed after the opening 2–3 paragraphs.
#     Usually a "before" or "setup" shot. For service guides this is
#     the wall opened up, the old install being removed, or the raw
#     room before intervention.
#
#   - INLINE-2 (required)
#     Placed mid-article, usually under the "How we do it" H2.
#     A process or detail shot — cable run, mount detail, close-up
#     of the tricky bit. Something that shows expertise.
#
#   - INLINE-3 (recommended for posts ≥1,200 words)
#     Placed near the final H2 or above the FAQ.
#     A second "finished" shot from a different angle, or a
#     before/after side-by-side, or a happy-customer context shot.
#
# RULES THAT APPLY TO EVERY IMAGE
# - Alt text is literal FIRST (describe what's actually in the frame),
#   keyword-natural SECOND. Blind users should know what they'd see.
# - Captions (the quoted string in the markdown ![]()) are optional
#   but high-impact — captions are read by more people than body copy,
#   so put a concrete detail or outcome there, not a description.
# - Never use stock photos. If you don't have a real photo, leave the
#   slot empty in imageBriefs and flag it in your Images-needed list.
# - Before/after pairs roughly triple time-on-page for service posts.
#   Use them whenever genuinely relevant.
#
# ──────────────────────────────────────────────────────────
# IMAGE PLACEHOLDER CONVENTION (read carefully)
# ──────────────────────────────────────────────────────────
#
# Agents do NOT write image file paths. Agents declare what images are
# needed; the human uploader provides the actual files via the bulk
# upload UI, which rewrites the placeholders on save.
#
# The contract:
#
#   1. In the frontmatter, set:
#        heroImage: "IMAGE:hero"
#      and fill heroAlt with a real, literal alt-text sentence.
#
#   2. In the body, any inline image is written as:
#        ![alt text](IMAGE:inline-1 "optional caption")
#      Use slot names inline-1, inline-2, inline-3… in order.
#
#   3. In the frontmatter imageBriefs block (below), add one entry per
#      placeholder you used, with a description (what the photo must
#      show) and the same alt text you used in the body. The uploader
#      displays the description next to the file picker so the human
#      knows which photo to grab.
#
#   4. At the END of your chat reply (not in the file), output a
#      human-readable checklist titled "Images needed for this post"
#      — one line per placeholder, with a short instruction to the
#      photographer/user. Example:
#
#        Images needed for this post:
#        1. hero — Wide landscape of finished install, TV on, warm lighting
#        2. inline-1 — Wall cut open showing lath-and-plaster, tape for scale
#        3. inline-2 — Cable run through old chimney flue, close-up
#        4. inline-3 — Finished install viewed from adjoining dining room
#
# On save, the bulk uploader:
#   - Reads imageBriefs + scans for IMAGE:<slot> tokens.
#   - Asks the user to pick a file for each slot (required-field UX).
#   - Copies each file to public/media/ as <slug>-<slot>.<ext>.
#   - Rewrites every IMAGE:<slot> in the .md to the real /media/ path.
#   - Strips the imageBriefs block from the final file.
#
# ============================================================
# FRONTMATTER — every CMS field, in CMS order
# ============================================================

# Title — REQUIRED. 8–120 characters.
title: "Your Post Title Goes Here"

# Description — REQUIRED. 40–200 characters. Meta description / preview.
description: "One- or two-sentence pitch that sets up the reader's problem and promises the payoff. Specific beats clever — include a number, price, or method."

# Hero image — REQUIRED. Use IMAGE:hero placeholder; the uploader
# rewrites this to a real /media/ path on save.
heroImage: "IMAGE:hero"

# Hero alt — REQUIRED. Min 8 chars. Literal first, keyword-natural second.
heroAlt: "Describe what is literally in the hero image, in one sentence"

# Publish date — REQUIRED. ISO datetime with timezone (CMS format) or
# plain YYYY-MM-DD. Drives sort order on /blog/.
publishDate: 2026-04-19T09:00:00.000+10:00

# Updated date — OPTIONAL. Set when you meaningfully revise the post.
updatedDate: 2026-04-19T09:00:00.000+10:00

# Author — OPTIONAL. Defaults to "Brisbane TVs Team".
author: "Brisbane TVs Team"

# Style — REQUIRED. Layout selector. Must be EXACTLY one of:
#   custom        — magazine-style long-read (default, recommended)
#   standard      — plain article layout
#   service-guide — how-to / step-by-step
#   location      — suburb / area-specific landing
# NOTE: key is `style`, NOT `layout` (Astro treats `layout:` as a
# magic import path and breaks the build).
style: "custom"

# Suburb — OPTIONAL. Required feel for style: location posts.
suburb: ""

# Service — OPTIONAL. Required feel for style: service-guide posts.
service: ""

# Tags — OPTIONAL. String array for filtering on /blog/. Leave as []
# for none — do NOT delete the field.
tags: []

# Draft — OPTIONAL. true keeps the post OUT of the live build.
draft: false

# Read time — OPTIONAL. Whole minutes only. Shown in the byline.
readTime: 7

# Image briefs — OPTIONAL but REQUIRED IF you use IMAGE:<slot> placeholders.
# Array of { slot, description, alt } entries. Slot strings must match the
# IMAGE:<slot> tokens you used (e.g. slot "hero" → IMAGE:hero). The uploader
# strips this block on save.
imageBriefs:
  - slot: "hero"
    description: "Wide landscape of the finished install, TV on, warm lighting, no visible cables, full wall or room in frame"
    alt: "Describe what is literally in the hero image, in one sentence"
  - slot: "inline-1"
    description: "Before-shot or setup-shot — what the space looked like before we intervened, or the problem being opened up"
    alt: "Literal alt for the before/setup shot"
  - slot: "inline-2"
    description: "Process or detail shot — cable run, mount detail, close-up of the tricky bit that shows expertise"
    alt: "Literal alt for the process/detail shot"
  - slot: "inline-3"
    description: "Second finished shot from a different angle, or a before/after side-by-side"
    alt: "Literal alt for the second finished shot"
---

## Use this section as the draft body

Write the opening hook here in the first paragraph — lead with the reader's
concrete situation (the room, the wall, the TV size, the problem). Keep it
under 120 words. On the custom layout this paragraph gets an automatic
drop-cap if it's at least 40 characters long, which most will be.

Second paragraph: set up what the post delivers. "Here's exactly how we
handle this in Brisbane, what it costs, and where it goes wrong."

![Literal description of the before or setup image, keyword-natural](IMAGE:inline-1 "A short caption — concrete detail or outcome, not a description.")

## H2 #1 — Reframe the actual question

Answer in 2–4 paragraphs. Include at least one internal link to a
relevant [service page](/services/) or [suburb page](/locations/).

## H2 #2 — Why this is harder than it looks

Show expertise. Numbers, materials, edge cases. This is where posts
earn their ranking — most competitors skip this section, which is why
they lose.

## H2 #3 — How we actually do it

Step-by-step if useful. Each step is one short paragraph, not a
sub-heading. Use the real method; don't generalise.

![Literal description of the process or detail image](IMAGE:inline-2)

## H2 #4 — What this costs in Brisbane

Give a concrete price floor ("from $179") and say what drives it up
(TV size, wall type, cable run length). Include a [book link](/book/)
or a tel: link to [1300 312 271](tel:1300312271) here — the reader is
at peak intent in a pricing section.

## H2 #5 — What can go wrong

Honesty signal. List 3–5 real failure modes and how we avoid each. This
is a conversion section — trust compounds in the paragraphs where
you admit what's hard.

![Literal description of the second finished shot](IMAGE:inline-3 "Optional caption adding a concrete detail the image alone doesn't convey.")

## H2 #6 — Frequently asked

**Does cable concealment require council approval in a heritage suburb?**
Answer in 2–3 sentences.

**How long does a standard install take?**
Answer in 2–3 sentences.

**Can you do this on an apartment wall?**
Answer in 2–3 sentences.

Close with a one-paragraph conclusion that restates the reader's payoff
and links to [/book/](/book/) or references `1300 312 271` one last time.

---

# ============================================================
# WORKED EXAMPLE — reference only, do not ship as-is
# ============================================================
# Below is what the frontmatter + opening of a valid post looks like
# when fully briefed. Copy the pattern, not the literal content.
#
#   ---
#   title: "Cable Concealment in Paddington Queenslanders: What It Costs and Why"
#   description: "Paddington Queenslanders have lath-and-plaster walls and no stud backing where you want the TV. Here's exactly how Brisbane TVs handles it, from $179."
#   heroImage: "IMAGE:hero"
#   heroAlt: "Recessed 75-inch TV above a restored timber mantle in a Paddington Queenslander living room with no visible cables"
#   publishDate: 2026-04-19T09:00:00.000+10:00
#   author: "Brisbane TVs Team"
#   style: "custom"
#   suburb: "Paddington"
#   service: "cable concealment"
#   tags: ["paddington", "cable concealment", "queenslander", "heritage"]
#   draft: false
#   readTime: 8
#   imageBriefs:
#     - slot: "hero"
#       description: "Wide landscape. Finished install, TV on, warm lighting, full wall in frame, no cables"
#       alt: "Recessed 75-inch TV above a restored timber mantle in a Paddington Queenslander living room with no visible cables"
#     - slot: "inline-1"
#       description: "Before-shot. Wall cut open showing 1920s lath and horsehair plaster, tape measure for scale"
#       alt: "Opened 1920s lath-and-plaster wall in Paddington home before TV cable concealment, tape measure held against studs"
#     - slot: "inline-2"
#       description: "Process shot. HDMI and power cables fished through the original chimney flue, close-up"
#       alt: "HDMI and power cables routed through an original chimney flue behind a TV in a Paddington Queenslander"
#     - slot: "inline-3"
#       description: "Finished install viewed from the adjoining dining room, timber floors and bay window visible"
#       alt: "Finished TV install in a Paddington Queenslander viewed from the adjoining dining room with timber floors and a bay window in frame"
#   ---
#
# (Body of example post omitted — the pattern from the template body
# above applies.)
# ============================================================
