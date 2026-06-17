# Explore stage - commit to a direction before scaffolding

Every site or landing-page build starts here. The point: stop guessing at the
right direction, generate 8-10 genuinely different versions on the brief, let
the client point at sections and say "that hero, that CTA, that motion," then
build the canonical pages from those picks. One project the whole way through -
the variant routes evolve into the final pages, nothing is rebuilt.

## The flow

1. **Plan checkpoint (Explore)** - confirm brief, brand source, references,
   variant count and whether to include landing-page variants. Then ask:
   "Proceed?"
2. **Generate variants** - 8-10 home-page variants as routes `/v1`..`/vN`.
   **Eight is the floor, not a suggestion.** The whole point of Explore is to put
   many genuinely different ideas in front of the client, so always ship at least
   8 directions in the preview; fewer is a failed Explore, redo it. Each variant
   is a complete, finished page (nav, the concept, the full menu/proof/visit/
   footer), never a hero floating in white space, and each reproduces a named
   reference donor's craft from the MCP (see `reference-library-usage.md`).
   plus 1-3 landing-page variants as `/lp1`..`/lpN` if the brief warrants. Each
   is a real `.astro` page composed of section components, with section labels
   visible in Explore mode. The bottom-right `<ExploreSwitcher />` picker lists
   them by id + name (give each variant an evocative `name` in
   `src/lib/variants.ts`).
   Before generating each variant, state a **Design Read** out loud (see
   `references/critique-discipline.md`): "Reading this as: a {page kind} for
   {audience}, with a {vibe} language, leaning toward {design direction}." A
   variant whose Design Read is generic or missing is rejected and regenerated.
   Read `~/.config/palate/builds.log.json` (see `references/build-memory.md`)
   and exclude any hero pattern used in the last 3 Jiffi builds and any
   macrostructure used in the last 5 - the variant set actively diversifies
   away from recent work. **Match implementation complexity to the
   aesthetic vision**: a maximalist variant uses elaborate code; a minimalist
   one practises restraint.
3. **Pause - pick** - deploy a shareable Vercel preview with
   `scripts/deploy-preview.sh <project-dir> <slug> --explore` and send the
   client the `SHAREABLE_URL` (a live `*.vercel.app` link with the bottom-right
   direction picker + Vercel Toolbar Comments for feedback). The client says
   what they want; mix-and-match is the default ("v3 hero, v7 features, v5
   CTA"), whole-variant or by-name shortcuts are fine ("go with Deep Trawl").
   (`--local-preview` swaps this for a local dev-server link.)
4. **Compose** - Claude builds the canonical pages (`src/pages/index.astro`,
   etc.) from the picked sections, adopting the design tokens of the variant
   that set the dominant tone (usually whichever supplied the hero). First
   **VIEW the lead reference's screenshot** (`refs_get_screenshot` on the spine
   donor) and design from the pixels - match its actual composition (weight,
   asymmetry, negative space, signature move), then re-skin with the brand. This
   is a required step, not optional: composing from prose alone regresses to
   generic priors. Then pull `refs_get { slug, format:"design" }` for the spine
   donor to lift its exact type scale, spacing and easings as structured YAML
   (with the WHY of each token) and map them onto the brand's range, reproducing
   the rationale, not just the values. Before emit, score the proposed composition
   on the **6-axis
   pre-emit critique**
   (Philosophy / Hierarchy / Execution / Specificity / Restraint / Variety, 1
   to 5 each; revise if any axis is below 3); apply the **Conceptual Grounding
   Test** to every section - delete anything that cannot finish "This exists
   because {a specific reason}". Variant routes move to `_explore-archive/`
   (gitignored) or are removed. Append a new entry to
   `~/.config/palate/builds.log.json` (macrostructure, mode, hero pattern,
   dominant tokens, explore picks) so the next Jiffi build diversifies away
   from this one.
5. **Pause - confirm** - re-deploy the shareable Vercel preview without
   `--explore` (`scripts/deploy-preview.sh <project-dir> <slug>`, picker off) so
   the client reviews the composed direction on a clean shareable link and
   confirms before deep scaffold continues.
6. **Continue Phase A** - fill `src/lib/content.ts` with real copy, finish the
   rest of the pages in the chosen direction, run `verify-is-real-astro.sh`,
   and hand over the final shareable Vercel preview link. From here the flow is
   identical to today.

The two new pause points (pick, confirm) sit alongside the existing checkpoint
before production. Four total decision moments, all at meaningful forks.

## When to skip Explore

Same scoping as the plan checkpoint: skip for tiny / reversible work. The
defaults:

| Brief shape | Explore? |
|-------------|---------:|
| New site or landing page (preview or production) | YES (default) |
| "Build it like the {client} site we did last week" / direction already set | NO |
| `--skip-explore` in the brief | NO |
| Editing an existing scaffolded project (add a section, fix copy) | NO |

If you skip Explore, jump straight to Phase A as before.

## Variant scope - home page + design system

Each variant varies BOTH the home-page structure (hero pattern, section
sequence, CTA placement, motion intensity) AND the underlying design tokens
within the client's brand (type scale, density, accent colour treatment, motion
strength). When the client picks a hero, they're also picking a design
direction - the rest of the site inherits those tokens at Compose time.

Other pages (about, services, contact) are NOT generated per variant - they're
built once at Compose time in the chosen direction. Variants only multiply
where direction-setting happens.

## Generating distinct variants - concept-led, not skin-deep

Eight variants that all feel like a slightly-reskinned Linear is failure, and so
is eight aesthetic skins of the same idea. **Each variant carries a distinct
DEMONSTRATIVE CONCEPT from the Story Engine** (`story-engine.md`): a mechanic that
makes the visitor feel the transformation, a 3-beat arc, one named feeling. Run
the Story Engine first (research -> the one true thing -> concepts). Ground each
concept in the MCP concept layer (`refs_insights { topic: "mechanics" }` /
`{ topic: "emotion" }`, `refs_search { register, device, intensity }`), then
execute its craft via the organ-transplant method (`reference-library-usage.md`).
Every variant's lead donor MUST be studied through the **section-build recipe**
(`reference-library-usage.md`): pull the donor by pattern (`refs_search { pageType,
uiElement, conversionPrimitive }`), VIEW its inner page (`refs_get_screenshot
{ slug, page:"pricing" }` etc., not only its home), read its
`refs_get { slug, layer:"do_dont" }` + `refs_get { slug, layer:"component_prompts" }`
+ `sections[]`/`pages[]`, then build from those. For the spine donor, also pull
`refs_get { slug, layer:"signature_moves" }` and `refs_get { slug, layer:"concept" }`
so the mechanic is named and re-skinned. Do not stop at the homepage screenshot and
tokens; that leaves the section depth, inner pages and taste layer unused.
When you reach for donors, a `refs_search` query may mix facets with exact lexical
terms because retrieval is hybrid (dense + lexical, RRF-fused), quality-ranked and
diversity-re-ranked: name the literal font, library, mechanic or business category
in `query` alongside the facets and it retrieves sites that use precisely that, with
the best craft first and cross-vertical range across the spread. For example:
`refs_search { vertical:"hospitality", query:"split-flap menu board" }`,
`refs_search { intensity:"high", query:"GSAP Lenis pinned hero" }`,
`refs_search { serifPresent:true, query:"Fraunces editorial optometry" }`.
For a set of eight, spread across the **concept-ambition spectrum**:

- **~3 safe-warm concepts** - a clear, human demonstrative idea, low-risk to
  build and convert. Executed with a faithful vertical-spine transplant plus one
  borrowed organ. Still a real idea, never a brochure.
- **~3 bold concepts** - a strong demonstrative mechanic (a reveal, a
  before/after flip, a carried timeline, crowd-as-proof), executed with
  cross-vertical motion and type transplants.
- **~2 one-of-a-kind concepts** - a genuinely surprising mechanic (a Sift-style
  flood-then-resolve, an absence-as-argument, an input-then-personalise), the
  kind that makes a client go "I have never seen that". At least one in every
  set. Ambition scales to the business: whisper-quiet for an anxious category
  (a conveyancer), spectacle for a launch.

Each variant's Design Read names its **concept** (the transformation, the
mechanic, the named feeling) AND its craft (the donor spine + grafted organs +
the reproduced signature move): "One-of-a-kind, feeling = relief: the visitor
types their worry and watches it answered (input-then-personalise); a
clinic-flagship spine + a calm dawn motion organ; signature move = the carried
timeline." A variant that cannot name its concept and its craft is rejected and
regenerated. Every variant must pass the feel gate (`critique-discipline.md`).
- **No two variants share the same hero pattern.** No two share the same
  section sequence. No two share the same density level (compact / regular /
  spacious / immersive).
- **Vary motion intensity across the set**: a few near-static, a few with
  scroll-driven choreography, one or two with hero-stage WebGL or canvas.
- **Vary design tokens within the brand**: type scale 1.2 vs 1.333 vs 1.5,
  border-radius 0 vs 8 vs 16, accent weight (subtle vs loud), font-weight
  emphasis. Stay inside the brand's permitted range; do not invent off-brand
  colours.
- **Landing-page variants** (when included) are single-page, conversion-shaped:
  hero + value props + social proof + CTA + FAQ + footer. The full-site
  variants are home pages that hint at site depth.

The two-layer doctrine from `reference-library-usage.md` applies: reference-led
variants FAITHFULLY reproduce the donor's craft layer (structure, rhythm, type
system, motion choreography and its signature compositional move), re-skinned
with the client's brand; only the identity layer (palette hexes, wordmark, font
files, photos, copy) is off-limits. "Loosely inspired" is not the bar - the
donor's signature move should be visible in the variant, re-skinned. The variant
set is the proof that the recipe was followed.

## Section identifiers - so the client can point

Every section in every variant wraps with `<SectionMark id="vN-hero" />` (or
`vN-features`, `vN-cta`, etc.). In Explore mode (`PUBLIC_EXPLORE_MODE=true`)
the label appears as a small top-corner badge. In production it does not
render. The IDs follow a fixed convention so the picking conversation is
unambiguous:

- `v1-hero`, `v1-features`, `v1-cta`, `v1-social-proof`, `v1-faq`, `v1-footer`
- `lp1-hero`, `lp1-value-props`, `lp1-form`, etc.

This works alongside Vercel Toolbar Comments on Vercel preview deployments -
the labels give the client structured pointing ("v3 hero"), Comments give them
free-form notes on the same page. The two compose.

## The direction picker (`ExploreSwitcher.astro`)

A floating pill in the **bottom-right corner** - never a top bar, so it stays
clear of the site's own navigation (a top-bar switcher is hard to work with and
collides with the real header). The collapsed pill shows a status dot and the
current direction (`v1 Deep Trawl`). Clicking it expands UPWARD into a panel
headed `PREVIEW · PICK A DIRECTION` that lists every variant by id + name
(`v1 Deep Trawl`, `v2 Morning Paper`, ...) with the active one highlighted in
mint. Built on a native `<details>` (zero JS).

Each variant gets a short, evocative **name** (not just `v1`) so the pick
conversation is human: the client can say "go with Deep Trawl" or "v2 hero".
Claude sets `{ id, name, href }` for each variant in `src/lib/variants.ts` as
they are generated; the picker reads that registry, renders only when
`PUBLIC_EXPLORE_MODE=true` and at least one variant exists, and always reflects
what actually exists. It is mounted once in `BaseLayout.astro`.

## Compose - turning picks into the canonical pages

The mechanic when the client says "v3 hero + v7 features + v5 cta":

1. Read each picked variant file (`src/pages/v3.astro` etc.), extract the
   section that carries the matching `SectionMark id`.
2. Write a new `src/pages/index.astro` that composes the extracted sections in
   the obvious order (hero -> body sections -> CTA), now without `SectionMark`
   wrappers and using the canonical `loadPage(query, params, fallback)` pattern.
3. **Adopt the design tokens of the dominant variant** - by default, whichever
   supplied the hero (the hero sets the tone). Confirm with the client if it
   is ambiguous. Token overrides live in `src/styles/globals.css` (or the
   brand-package overrides layer) - keep them inside the brand's range.
4. Build the rest of the site's pages (`about`, `services`, etc.) in the same
   direction. They get the chosen tokens automatically via the brand layer.
   For every conversion section (pricing, booking, menu, services, contact) and
   every conversion-critical inner page, run the **section-build recipe**
   (`reference-library-usage.md`): facet-search 2-3 donors for THAT section, view
   their inner-page screenshots, build each component from
   `refs_get { slug, layer:"component_prompts" }`, and check the result against
   `refs_get { slug, layer:"do_dont" }` before emit. The composed section is grounded
   in how the best sites build that page, not assembled from memory.
5. **Archive the variant routes**. Move `src/pages/v*.astro` and
   `src/pages/lp*.astro` into `_explore-archive/` (project-level, gitignored)
   or remove them. Clear `src/lib/variants.ts`. The project shape returns to a
   normal Astro site - the routes that exist are the routes that ship.

After Compose: `PUBLIC_EXPLORE_MODE` flips to `false` for the rest of the
preview/production flow.

## Visual editing co-existence

`PUBLIC_EXPLORE_MODE` (the switcher + section labels) and
`PUBLIC_SANITY_VISUAL_EDITING_ENABLED` (Sanity overlay) are independent. During
Explore the visual-editing flag is normally OFF - we're picking structure, not
editing content. It flips ON for the preview deployment after Compose, once
the canonical pages exist. Same pattern as today.

## Where this lives in the codebase

Same Astro project from start to finish. During Explore the project has
`src/pages/v1.astro`..`/vN.astro` and (optionally) `lp1..lpN.astro`. After
Compose those routes are gone and `src/pages/index.astro` plus the rest of the
canonical site lives in their place. No rebuild, no fork, no second project -
the variants ARE the project, just at an earlier shape.
