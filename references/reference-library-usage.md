# Using the reference library

The library is deep design intelligence - structure, tokens, motion, component
behaviour and an Astro translation for 260+ top-tier sites - to inform a build:
reproduce a reference's craft faithfully, re-skin it with the client's brand,
and never copy its identity. It is served by the **`palate` MCP connector**, which
is the read path for a build. The catalog repo is now private; the MCP is how a
build reaches it. To add or refresh sites see `reference-library-curation.md`
(CURATE still writes to the repo); for the entry shape see
`reference-library/_meta/schema.md`.

## The MCP is the read path (use this, not the old sync)

The `palate` MCP exposes every entry as read-only `refs_*` tools,
decomposed into orthogonal layers (tokens, typography, motion, layout,
structure, components, voice, signals, cluster) plus `referenceItFor` (what to
borrow) and `doNotCopy` (what is brand-coded, leave alone). The layers being
separable is the whole point: you take structure from one site and motion or
type from another.

The tool-chain, in the order a build uses it:

1. **`refs_match_brief { brief }`** - seed the build. Returns the dominant
   `style` / `mode` / `cluster`, three anchor references, and a playbook
   extract. Always start here.
2. **`refs_search { vertical?, subtype?, style?, mode?, tier?, cluster?,
   canvasFamily?, accentCount?, serifPresent?, hasWebgl?, register?, device?,
   intensity?, pageType?, uxPattern?, uiElement?, conversionPrimitive?, query?,
   limit, page, format, responseFormat }`** - faceted + natural-language
   discovery. This is how you find cross-vertical donors (a motion language from
   a creative studio, a type voice from a fashion house) AND, now, donors by what
   is literally on the page: `pageType` (pricing, menu, booking, contact, faq),
   `uxPattern`, `uiElement`, `conversionPrimitive` (bookable, order-online,
   service-area, reviews-integration). `format:"detailed"` adds tokens, sections
   and borrow guidance; `responseFormat:"md"` returns a token-lean list; `page`
   paginates the faceted path.
3. **`refs_list_verticals {}`** - the taxonomy with counts and example slugs.
4. **`refs_insights { topic: "trends" | "clusters" | "playbook" }`** -
   corpus-level patterns. Use `clusters` to pick a visual signature that is
   deliberately rare in the brief's vertical.
5. **`refs_get { slug | slugs[], sections?, format }`** - the full record plus
   note bodies. `sections` is any of `overview, structure, visualSystem,
   components, motion, typography, layout, voice, astroRebuild, tokens` PLUS the
   taste-teaching layer: `doDont` (the explicit do/don't rules that keep a build
   faithful to this reference) and `componentPrompts` (paste-ready per-component
   build prompts in the reference's own tokens). Pass `slugs[]` to read a whole
   donor set (spine + grafts) in one call. The detailed record now also carries
   `sections[]` - the homepage section sequence, each tagged with its uiElements,
   uxPatterns, conversionPrimitives and (where present) the named signatureMove.
6. **`refs_get_tokens { slug }`** - palette, type scale, radii, easings.
   Reproduce the scale, radii and easings; substitute the client's hues into the
   same roles. Re-skin the palette, never lift it.
7. **`refs_get_astro_recipe { slug }`** - the `astro-rebuild` recipe (islands,
   motion-on-Astro, packages, pitfalls). This is the file that makes a donor
   actionable on the Jiffi stack.
8. **`refs_get_screenshot { slug, viewport }`** - VIEW the lead reference's
   actual screenshot and design from the pixels, not only the prose notes. Match
   the real composition (where the weight sits, the asymmetry, the negative
   space, the signature move), then re-skin it. Required for the lead donor
   before you compose.

9. **`refs_similar { slug, sameVertical?, limit }`** - expand from one strong
   donor to its nearest neighbours by meaning. Use it when a search or
   `refs_for_business` hands you one donor you like and you want more of the same
   feel to compare. Leave `sameVertical` off for cross-vertical cousins (often the
   better grafts).

## The section-build recipe (MANDATORY for every conversion section)

A homepage is not the whole job, and a whole-site donor is the wrong grain for a
specific section. For each conversion-critical SECTION you build (pricing, booking,
menu, services, contact, FAQ, the hero), do NOT design from memory or from the
spine alone. Run this recipe, grounding the section in real exemplars. This is the
default for both Explore (each variant's lead donor) and Compose (each canonical
section), not an optional extra.

1. **Find 2-3 donors for THIS section by facet** (not by whole-site vibe):
   `refs_search { pageType:"pricing" }`, `{ conversionPrimitive:"bookable" }`,
   `{ conversionPrimitive:"menu", vertical:"hospitality" }`, `{ uiElement:"switch-toggle" }`,
   `{ pageType:"booking", conversionPrimitive:"bookable" }`. Widen a promising set
   with `refs_similar { slug }`.
2. **View the donor's INNER page, not only its home**:
   `refs_get_screenshot { slug, page:"pricing" }` (or menu / booking / services / ...).
   This is the depth the library now carries: study how the best sites actually
   build THAT page, at the pixel, before you compose it.
3. **Read its anatomy + discipline**:
   `refs_get { slug, sections:["doDont","componentPrompts"] }`, plus the donor's
   `sections[]` (the homepage section breakdown) and `pages[]` (its inner-page
   sections, each with type + the named signatureMove).
4. **Build the section** by reproducing the strongest donor's structure for that
   section, re-skinned to the client brand: start each component from its
   `componentPrompts`, keep its `sections[]`/`pages[]` rhythm, reproduce its named
   signatureMove (named and located in the code).
5. **Check against `doDont` BEFORE emit**: the composed section must honour the
   donor's Do rules and break none of its Don'ts. Hard pre-emit gate, not advice.
   Audit dimension 11 re-checks it against the structured `doDont`.

The point of the upgraded library is that you build a great pricing / booking /
menu / services page from how the best sites build THAT page, not from a generic
skeleton plus the client's colours. If a build only calls `refs_for_business` +
`refs_get_screenshot` (home) + `refs_get_tokens`, it is leaving the section-level
depth, the inner pages and the taste layer (`doDont` / `componentPrompts`) unused.

Offline / CURATE fallback only: `eval "$(scripts/sync-reference-library.sh)"`
clones the (now private) repo - it needs the token in `library-source.json` -
and `select-references.sh` reads that local clone. Use this only when the MCP is
unreachable or when CURATE is writing entries. For a normal build, the MCP is
the default and nothing is cloned.

## The organ-transplant method (structure wholesale, then graft two organs)

A site reads as generic two ways: when one reference supplies every layer (no
range), OR when three references are averaged into a blur (the craft cancels
out). Avoid both. This is a transplant, not a blend:

- **Take the lead reference's structure WHOLESALE** - section rhythm, grid,
  hierarchy, conversion spine - and re-skin it with the client's brand. This is
  the body. Do not water it down.
- **Graft ONE signature interaction** from a second donor (a motion language, a
  scroll choreography) - intact, re-skinned. One organ.
- **Graft ONE type treatment** from a third donor (a bespoke-serif voice, an
  oversized-display system) - intact, re-skinned. One organ.

Three intact, identifiable contributions - never a 3-way average where each is
sanded down to fit. The spine usually comes from the brief's own vertical (it
carries the conversion pattern); the two grafts come from donors that share an
emotional register but not the category, which is where the distinctiveness
comes from.

| Layer | Where it comes from | How to fetch it |
|-------|---------------------|-----------------|
| **Spine** - structure, section rhythm, conversion | a flagship in the brief's own vertical | `refs_match_brief` -> `refs_get sections:[structure,components]` on the top anchor |
| **Motion language** - the "full motion" feel | a donor from a motion-rich cluster the vertical rarely uses (creative-studio, agency) | `refs_search { hasWebgl:true }` or `{ cluster:... }` -> `refs_get_astro_recipe` |
| **Typographic voice** - designed, not catalogued | a bespoke-type flagship (fashion / editorial) | `refs_search { serifPresent:true }` or `{ cluster:"bespoke-variable-font-flagship" }` -> `refs_get_tokens` |
| **Canvas / colour** - stand out on the shelf | a `canvasFamily` that is rare in the brief's vertical | `refs_search { vertical:..., canvasFamily:... }` to confirm rarity |
| **Component patterns** | only patterns that actually exist across the refs | `refs_get sections:[components]` on two or three donors |

Rules for the transplant:

- **Always cross at least the spine / motion / type boundary.** If the same
  slug supplies structure and motion and type, you have not transplanted - you
  have cloned one site. Range across builds comes from varying the donors.
- **Respect every `doNotCopy`.** That is the reference's identity layer. Borrow
  the pattern, never the artefact (a signature wordmark, a brand-owned motif, a
  trademark-grade gimmick).
- **Reproduce the reference's scale, rhythm and easings; re-skin the palette.**
  Use the donor's actual type scale, spacing and motion easings in the same
  roles, then substitute the client's hues. The client's brand colours always
  win; the craft stays intact.
- **Match the brief's proof.** If the client lacks what a donor leans on (a
  slick product UI, world-class photography), substitute what they actually
  have in the same slot rather than forcing the donor's asset.

## How to read a single donor (MCP order)

For each chosen donor, call in this order and use it for its assigned layer:

1. `refs_get sections:[overview]` - decide what this donor is FOR on this build.
2. `refs_get_screenshot` - VIEW it. Design from the pixels: read the actual
   composition (weight, asymmetry, negative space, the signature move) before the
   prose. Required for the spine donor.
3. `refs_get sections:[structure,visualSystem]` - rhythm and hierarchy (spine
   donor); reproduce them, re-skinned.
4. `refs_get_tokens` - reproduce scale, type and spacing; substitute the client's
   hues into the same roles.
5. `refs_get sections:[motion]` + `refs_get_astro_recipe` - motion intensity and
   the concrete recipe for interactions you implement (motion donor); reproduce
   the easings and choreography.
6. `refs_get sections:[components]` - component anatomy and states.
7. `refs_get sections:[voice]` - calibrate tone only, never copy phrasing.
8. `refs_get sections:[doDont,componentPrompts]` (spine donor) - the do/don't
   discipline to hold the build to, and paste-ready component prompts to start
   from, both in the donor's own tokens. Re-skin, then check the composed page
   against `doDont` before emitting.

`astro-rebuild` (via `refs_get_astro_recipe`) and the motion specs are what make
a donor buildable on the Jiffi stack - use them, do not just read the prose.

## The two-layer doctrine - reproduce the craft, protect the identity (important)

A site feels designed because of its **craft layer**: the grid system, the
spacing rhythm, the type scale and pairing, the motion timing / easing /
choreography, the interaction models, and the signature compositional moves
(full-bleed, asymmetry, repeated-identical-sections, a pinned hero stage). That
layer is not owned by anyone. **Reproduce it faithfully.** When a build informs
itself with a reference, it should use the reference's actual scale, rhythm and
easings and re-skin them with the client's brand - not dilute them down to
Claude's generic priors.

What stays off-limits is the **identity layer**: the exact palette hexes, the
wordmark / logo, bespoke font files, photography, copy, and any trademark-grade
gimmick (Linear's literal dot-grid, Stripe's exact gradient). That is the
client's, or the reference's, trade dress. Borrow the pattern, never the
artefact.

So the rule is not "weaken the reference so sites do not look the same." It is:

- **Reproduce the craft layer faithfully, re-skinned.** Use the reference's exact
  type scale, spacing rhythm and motion easings; substitute the client's hues
  into the same roles (the reference's accent role takes the client's accent
  hue). The composition stays; the identity changes.
- **Protect the identity layer absolutely.** The client's brand colours, fonts,
  logo and voice always win. Respect every `doNotCopy` - that is the reference's
  identity layer, named.
- **Get variety by choosing DIFFERENT references per build**, not by diluting any
  one of them. A faithfully-reproduced restaurant site and a faithfully-
  reproduced studio site look nothing alike; two half-diluted ones both look
  like Claude. Vary which reference leads; the build memory
  (`references/build-memory.md`) actively excludes recently-used patterns.
- **Match the client's proof.** If the client lacks what a donor leans on (a
  slick product UI, world-class photography), substitute what they actually have
  in the same structural slot rather than forcing the donor's asset.

The failure mode this replaces: stripping every memorable move out of a
reference "so sites do not look the same," which lands every build back on the
generic skeleton + the client's colours = default-Claude output. Variety comes
from range across builds, not from blanding each one.

## Posture

The library is internal Jiffi intelligence. Captured screenshots and SVGs are
reference material for understanding a site, not assets to ship. Every client
deliverable is original work informed by references, never copied from them. See
`reference-library/CONTRIBUTING.md`.
