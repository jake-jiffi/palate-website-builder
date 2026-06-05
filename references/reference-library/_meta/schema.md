# Reference library entry schema (v2)

This is the contract for what a catalog entry contains. Schema v1 was six shallow
notes files written from a `web_fetch` of raw HTML. Schema v2 is a deep,
reverse-engineered record built from a real headless-browser capture, detailed
enough that a Jiffi Astro build can borrow a top-tier site's structure, tokens,
motion and component behaviour with genuine understanding.

Every entry lives at `catalog/<slug>/` and has three layers.

## Layer 1 - authored notes (Claude writes these)

The reference material a build actually reads. Written by the curator (Claude)
from the Layer 2 capture data plus the screenshots.

| File | What it holds |
|------|---------------|
| `overview.md` | The essence. Why this site is worth referencing, the tier of craft, what to borrow, what is too brand-coded to copy. |
| `tokens.json` | The cleaned, canonical design tokens: colour palette + roles, the type scale, spacing scale, radii, shadows, container widths, breakpoints, motion easings/durations. The de-noised version of `_capture/tokens.raw.json`. |
| `typography.md` | Families and sources, the scale and its ratio, weights, tracking, line-height, fluid `clamp()` use, font-loading strategy. |
| `layout.md` | Container and grid system, breakpoints, the vertical section rhythm. |
| `motion.md` | The signature motion in prose: what defines how the site feels, the library/technique, the full interaction inventory. |
| `motion.json` | The same motion as structured data: per-interaction `{trigger, property, duration, easing, distance, stagger, astroRecipe}`. Machine-usable by a build. |
| `components.md` | Anatomy of nav, hero, buttons, cards, footer, forms: structure, variants, states, the behaviour worth borrowing. |
| `structure-notes.md` | Homepage section sequence, inner-page patterns, the rhythm to borrow, the anti-pattern to avoid. |
| `visual-system-notes.md` | Grid and composition, hierarchy, imagery and texture, depth and effects. |
| `voice-notes.md` | Abstract voice patterns. At most one quote under 15 words. |
| `astro-rebuild.md` | The translation layer. How to reproduce this site's strengths on the Jiffi stack: islands strategy, motion on Astro, token/layout mapping, recommended packages, pitfalls. |
| `principle.md` | One forced sentence: "This is a good example of {principle}." Plus up to 3 principle tags (e.g. `hierarchy-through-scale-contrast`, `restraint-via-single-accent`, `editorial-rhythm-over-grid`). Written FIRST by the curator; the rest of Layer 1 is the argument for it. Tags also live in `tags.json` so `select-references.sh --principle` can filter. |
| `depth-elevation.md` | Shadow scale, layering rules, blur usage, z-stacking conventions. The site's whole approach to depth: flat, soft-shadow, brutalist-no-shadow, blurred-stack. Worth a separate file because depth treatment is one of the strongest aesthetic signals. |
| `agent-prompt-guide.md` | A single paragraph an agent can paste into a BUILD prompt to ask for "a site that feels like {this reference}". Captures the essence in plain prose, in our voice, no jargon. Useful when a client wants to point at this reference verbally. |
| `known-gaps.md` | What could NOT be captured for this entry. E.g. "form error states not visible without a real submission", "dark mode toggle present but unstable on capture", "motion on inner pages not observed". Honesty section; a senior reader knows where to be careful using the entry. |
| `tags.json` | Metadata: `style`, `mode`, `secondary[]`, `tier`, `inspectedAt`, `schemaVersion`, **`principle[]`** (mirror of `principle.md` tags for fast lookup). |

`astro-rebuild.md` is the file that did not exist in v1 and is the point of the
whole upgrade. Every other file describes the reference site; this one says how
Jiffi rebuilds that quality on Astro + Tailwind + the client brand package.

`principle.md` is the file that gets written FIRST by the curator: if you cannot
finish "This is a good example of ___" without filler, the entry is not worth
adding. The principle tag, not the visual aesthetic, is what the entry teaches.

`tokens.json` SHOULD follow the W3C DTCG token format where practical (the
brand package already does). The capture engine emits raw values; the curator
shapes them into DTCG-shaped tokens in `tokens.json`.

## Layer 2 - raw capture (the engine writes these)

Produced by `scripts/reference-capture/capture.mjs`. Machine data, the evidence
the authored notes are built from. Kept in the entry so a refresh can diff
against it and so the notes are auditable.

```
manifest.json              capture run metadata, status, detected stack
_capture/digest.md         a compact human-readable summary - read this first
_capture/tokens.raw.json   custom properties + colour/space/radius/shadow frequency.
                           Each token entry SHOULD carry `confidence` (high|medium|low,
                           keyed to element context: logo, primary-button, generic UI)
                           and `recurrence` (count across captured pages), so the
                           curator can denoise faster and so multi-page captures lift
                           confidence on tokens that recur. The engine writes these
                           as it stabilises; the curator's tokens.json is the final
                           shape.
_capture/typography.raw.json  families, weights, the observed type scale, @font-face
_capture/motion.raw.json   animation libraries, @keyframes, every CSS transition
_capture/computed.json     computed styles of representative elements (body, h1..h4,
                           nav, button, card, footer, ...)
_capture/layout.raw.json   container widths, gaps, grid usage, page height
_capture/structure.json    the DOM section outline for the homepage + inner pages
_capture/stack.json        framework + library detection, network resource list
```

## Layer 3 - assets (the engine writes these)

```
assets/screenshots/desktop.png        full-page, 1440w
assets/screenshots/tablet.png         full-page, 834w
assets/screenshots/mobile.png         full-page, 390w
assets/screenshots/scroll-00..05.png  the desktop scroll filmstrip
assets/screenshots/inner-*.png        any captured inner pages
assets/svg/NN-*.svg                   inline SVG extracted from the page
```

Assets are stored for internal reference use - they let a future build see and,
where a client is literally rebuilding a site, reuse marks and icons. They are
internal working material, not redistributed. See `../CONTRIBUTING.md`.

## status values (manifest.json)

- `captured` - the engine ran, data is present, ready for the curator to write notes.
- `unreachable` - the URL would not resolve or load (often a non-allowlisted
  domain in the sandbox). The overnight batch skips it and moves on.
- `error` - the engine hit an exception. Inspect `manifest.notes`.
- `pending` - scaffolded, not yet captured.

A finished entry is `captured` AND has all Layer 1 notes filled past their stubs.

## Quality bar

Unchanged in spirit, raised in depth: could a designer who has never seen the
site rebuild its *feeling* - and could a developer rebuild its *behaviour on
Astro* - from this entry alone? If not, the entry is too shallow.
