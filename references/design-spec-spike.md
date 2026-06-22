# SPIKE: a durable DESIGN.md as the build's design source of truth

Status: SPIKE (sec-gj4.11 / source-triage item 5). NOT wired into the live gate.
This file is the experiment design plus the artefact format; graduate it to a gate
ONLY if the A/B below clears the kill criteria.

## The gap this tests

A build's design decisions live in two places the section-build recipe does not
read as one spec:

- the brand package (the locked tokens), and
- `manifest.commission` (concept, vision, chosen mechanisms), a nullable,
  fail-open block buried in `build-manifest.json` telemetry.

There is no project-root, human-readable spec of the per-page VISUAL constraints,
and no COMPUTED consistency measure (`gate-uniqueness.mjs` measures the inverse,
near-duplication across Explore variants; the Philosophy axis is an interpretive
VLM read). The failure this targets is already named in the corpus: anti-patterns.md
"inconsistent visual language across sections" (the scale, spacing unit, radius,
border weight, accent usage shifting band to band because the page was generated
piecemeal and never reconciled).

Note this is NOT "there is no consistency check": interpretive doctrine exists
(anti-patterns.md + `audit-dimensions.md` dims 1, 2, 8). What is missing is a
durable written spec and a computed number.

## The intervention (the durable artefact)

A project-root `DESIGN.md`, modelled on the existing `MOTION_BUDGET.md` pattern (a
spec that ships with the code so the rule travels with it). At Compose, AFTER
divergence (so it never narrows Explore), promote the commission's design decisions
into a written constraint set the section-build recipe re-reads before each section:

```md
# Design constraints (this build)

- **Type scale**: the locked steps in px (e.g. 14 / 18 / 24 / 40 / 64), and which
  level each role uses. No size off this scale.
- **Spacing unit**: the base rhythm (e.g. 8px) and the section padding (e.g. 96px
  desktop / 56 mobile). Every band uses it.
- **Radius**: the one (or two) corner radii. No third.
- **Border weight**: the one hairline / weight. No mix.
- **Accent placement**: the single accent and WHERE it is allowed (CTAs, links,
  one highlight), and where it is NOT (not every card edge).
- **Density**: the rule for how much breathes vs how much packs.
- **Do / Don't for THIS site**: the 3-5 lines that keep section N looking like
  section 1.
```

This must ADD the explicit per-page constraint set (the list above), not restate
the commission's concept/vision or the brand tokens, or it is just a rename. It must
preserve commission's fail-open contract: its absence never blocks a build.

## The measurement (the FLOOR, not a maximand)

`scripts/reference-capture/measure-drift.mjs` (built for this spike) loads a built
page and reports the distinct values each section uses for the constraint set, plus
a transparent `driftScore` (lower = one system held across sections):

```
node scripts/reference-capture/measure-drift.mjs --url http://localhost:PORT
```

Validated on fixtures: a coherent page (one scale, one radius, one accent) scored
`driftScore 6`; a piecemeal page (many sizes, radii, accents, uneven rhythm) scored
`18.25`. It is REPORT-ONLY.

CRITICAL: low drift is necessary-but-NOT-sufficient. A page of generic defaults
(one Tailwind scale, one radius, one accent) is maximally consistent AND maximally
slop. So drift is a FLOOR read ALONGSIDE the Variety / Philosophy axes, never a
quality target to minimise. Minimising drift alone manufactures the very sameness
Palate exists to fight (source 1's explicit warning).

## The A/B (run before graduating)

1. Pick 3-5 matched briefs. Build each TWICE: once with the DESIGN.md write+read
   step, once without (the commission + brand-tokens baseline).
2. Score both: `measure-drift.mjs` driftScore, the visual-rubric Philosophy axis
   (consistent visual language across sections), and the Variety axis.
3. WIN = lower drift AND higher Philosophy with NO loss on Variety.

## Kill criteria (any one => drop it; the commission stays)

- No measurable Philosophy or drift gain over the commission+brand baseline.
- The Variety axis drops (it is manufacturing sameness).
- It just restates the commission + brand tokens with no new constraint delta.

Timebox to a handful of builds. Roll back = delete the write step (and, if desired,
`measure-drift.mjs`); nothing in the live build flow depends on either today.

## Dependencies

Soft dependency on the WebGL-capture fix (sec-gj4.7) for fairly scoring WebGL-hero
builds (you cannot judge consistency on a hero QA renders blank). The A/B can start
on DOM / CSS builds immediately.
