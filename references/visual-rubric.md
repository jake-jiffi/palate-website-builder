# The visual rubric (fixed) - what the verifier scores the RENDER against

This is the single fixed source the visual loop scores against, so the rubric does
not drift build to build. It judges the RENDERED page (the PNGs from
`scripts/reference-capture/screenshot-build.mjs`), not the code or the agent's
memory. The deterministic floors (`scripts/ux-lint.sh`,
`references/brand/perceptual-floors.md`, the console-error count, the uniqueness
gate) catch the mechanical failures; this rubric catches the craft failures a VLM
is better at seeing. Both arms must pass.

The screenshot driver is the real script (it targets localhost, captures retina
full-page + per-section PNGs, and records console errors):

```
bash scripts/serve-preview.sh <project-dir>          # prints SERVE_URL=...
node scripts/reference-capture/screenshot-build.mjs \
  --url <SERVE_URL> --out .palate-shots --label <variant-or-index> --sections
```

## The six axes (fixed)

Score the screenshot on six axes, 1 to 5 each. These are the exact axes from
`references/critique-discipline.md` section 2; do not improvise new ones.

| Axis | What 5 looks like |
|------|-------------------|
| Philosophy | The page has a clear, defensible thesis about what it values (speed, depth, irreverence, restraint) and every choice supports it. |
| Hierarchy | The visual / reading order makes the most important thing land first; the second-most second; nothing competes. |
| Execution | Spacing, type pairing, alignment, transitions are deliberate. No "close enough" defaults. |
| Specificity | Copy and imagery name the actual product / user / situation. No generic stock phrases or stock images. |
| Restraint | Everything earns its place; nothing is decorative-by-default. The page would be worse if you added more. |
| Variety | The composition reproduces a named, located signature move from the lead reference (re-skinned), and does not fall back to the standard hero+three-cards+CTA shape unless that shape is itself the deliberate, reproduced move. |

**The bar: every axis >=4, no axis below 3.** Anything at 3 or below on any axis
means revise the named section, re-render, and re-score.

## The defect checklist (fixed, name-and-locate)

Walk this closed list for EVERY section shot. Each is a yes/no. When the answer is
"yes", a location string is REQUIRED (e.g. `v3-hero mobile`, `pricing desktop`) -
a defect named without a location does not count and the section is not cleared.

1. **Overflow** - text or an element bleeds past its container or the viewport edge.
2. **Overlap** - two elements collide (a z-index / positioning bug).
3. **Contrast** - body text sits below the perceptual-floor contrast on its surface
   (cross-ref `references/brand/perceptual-floors.md`; small labels on tinted, dark
   or photo bands are the usual offenders).
4. **Missing OR fabricated imagery** - an empty or placeholder frame, a broken image,
   or a wireframe-grey box (automatic fail on a launch-bar site). ALSO a glossy,
   fabricated product mockup standing in for real product UI: a rendered "dashboard"
   the product does not actually show, an invented device-frame screen. A fake passes
   the empty-frame test (it is not blank), so judge it: if the UI is too clean, the data
   too tidy, and it does not match the real product, it is a fake mockup, name it and the
   section (`references/ai-slop-tells.md`, "fake glossy mockups vs real screenshots").
5. **Mobile hero legibility** - the hero headline / subhead is unreadable at 390px
   (truncation, overlap on the photo, or below the contrast floor where the mobile
   stack pushed the text onto the brightest part of the image).
6. **Default / genre-cliche accent in the render** - the accent reads as a raw framework
   default (the Tailwind indigo / "that one shade of purple", cyan-on-dark, the emerald
   SaaS green, the friendly beige + teal) or the category cliche, even when the hex was
   not caught by the lint. Name the surface where it shows. This is the render-side
   complement to the `accent-*` lint rules.
7. **Decorative tell shape in the render** - any of these visible in the pixels, each
   needs a location:
   - **Eyebrow / status pill above the hero heading** - a small label, in a rounded
     pill (often with a status dot), sitting above the hero `<h1>` (`Now in beta`,
     `Backed by ...`, `WHAT WE DO`). On the HERO this is an automatic fail: it must not
     appear at all (Jake's directive). Name the location and fail. Lower-down kicker
     labels are the milder tell; the hero pill is the worst-placed one. (The
     deterministic complement is the `hero-status-pill` lint check.)
   - **Two-tone OR gradient hero heading** - a hero `<h1>` whose words use two distinct
     solid colours, OR gradient-clipped text, to fake hierarchy. Either is a fail; name
     the heading. Hierarchy is carried by weight / size / composition, not a recolour.
     (The deterministic complements are `two-tone-heading` and `gradient-text-clip`.)
   - **The recurring default face (MODE-AWARE)** - read `.palate-skill-state.json`
     `brandMode` first. In **brand-creation** mode (no brand was provided, the skill chose
     the identity) the display face being a known reflex default with no brand rationale is
     a tell: this skill's own Bricolage Grotesque + Hanken Grotesk pairing, or Instrument
     Serif / Geist / Space Grotesk / Inter reached for out of habit. If the face reads as
     the unconsidered default and the build has no stated brand reason for it, that is a
     Variety / Philosophy fail, name the face and the surface. In **brand-provided** mode
     the face IS the brand's deliberate choice, so do NOT flag it for being a default (the
     pill-above-hero and two-tone/gradient-heading tells still fail in both modes; only the
     face is mode-gated). (The deterministic complements are the `banned-display-*` /
     `banned-body-hanken` lint rules and the cross-build type-face-recurrence check in
     `scripts/gate-novelty.mjs`.)
   - **Glassmorphism as decoration** - frosted-blur panels on nav / cards / modals used
     for look, not for a real overlay, and especially where it drops body text below the
     contrast floor.
   - **Bento grid as decoration** - mixed-size tiles where the sizes do NOT encode real
     priority (equal-weight content dressed as a bento); it is a plain card grid wearing
     a trendy name.
   - **The universal feature-card shape** - a row of cards each with a small rounded-square
     icon tile above a heading, three across, symmetric; the template SaaS component.
   - **Decorative motion** - cursor-followers, hover that hides the button it decorates,
     scroll-jacking, parallax that fights reading; motion the page would be better without
     (the motion budget catches cost, this catches the taste failure).
   - **Inconsistent visual language across sections** - the type scale, spacing, radius,
     border weight or accent usage shifts band to band, so sections read as different
     sites (cross-ref `audit-dimensions.md` dims 1, 2, 8; `critique-discipline.md` habit 7).

A non-zero `console_errors` count in `.palate-shots/errors.json` is an automatic
`visual: fail` regardless of the axis scores - a thrown build cannot pass.

## The AI-slop Quick QA pass (run before emit, augments the axes + defect checklist)

Walk the Quick QA list at the foot of `references/ai-slop-tells.md` over the render. It
overlaps the axes and the defects on purpose, it is the field guide's own fast check.
**Tick more than two and the build has regressed to the AI default**: name the failing
items, revise the named sections, re-render. The list covers gradient-text headlines,
untuned / genre accents, Instrument-Serif-or-serif-italic-by-reflex, the untouched
eyebrow-pill centred-hero formula, rounded-icon-tile cards / side-border cards, feature
pill rows, bento / glassmorphism as decoration, sections that look like different sites,
the stock pricing / tapestry / contrast-framing copy, the trust-chrome stickers (cookie
banner on a new microsite, Product Hunt badge, dual free-call CTA), glossy mockups where
real screenshots belong, and the AI-washing test.

<!-- ux-lint-disable ai-washing-copy the AI-washing phrase is named here to define the render-side test, quoted not used -->
The **remove-the-word-"AI" test** is part of this pass: read any "AI-powered" / "powered
by AI" claim in the render, remove the word "AI", and re-read the sentence. If the
product is unchanged, the AI is decoration, that is a Specificity / Substance fail, name
it. (The `ai-washing-copy` lint flags the phrase; this is the render-side judgement that
the claim is earned.)

## The commission check (augments the axes + defect checklist, does not replace them)

When a commission was recorded (`manifest.commission`,
`references/build-commission.md`), the verifier ALSO judges the built result against
it. This is an additional arm of the judgement, not a new set of axes - the six axes
above and the defect checklist stand; the commission adds the ambition bar, the proof
contract and the restraint clause.

- **The proof contract.** The render must be captured at **both 1440 and 390**, the
  **pixels and the console** read (zero console errors), the page **mobile-friendly**
  (the 390 shot clears the defect checklist), **holds ~60fps** (no jank: one RAF loop,
  `client:visible` islands, the LCP static not a canvas - cross-ref
  `references/motion-and-3d.md`), and it **honours `prefers-reduced-motion`** (each
  Tier-1 / Tier-2 mechanism has its JS guard + static poster; the reduced-motion state
  is the finished state).
- **The ambition bar.** "Competent" is a fail. A clean-but-generic render that would
  not place in its category on Awwwards / FWA does not clear the bar even with no
  defect found; name what keeps it competent and what would lift it.
- **The restraint clause (part of the judgement, not a motion count).** Maximal motion
  is not the bar; fit is. A janky WebGL hero fails; flawless restraint matched to an
  anxious brand can win. Judge intensity against the commission's stated brand fit, not
  against the toolkit register. Do not penalise a calm commission for being calm.
- **Mechanism vs record.** Each mechanism named in `commission.chosen_mechanisms[]` is
  present in the render and built from a recorded precedent + recipe (cross-check
  `manifest.buildability`); a claimed mechanism that is absent, thrown, janky, or
  missing its reduced-motion fallback is a fail with the section named.

This check is **fail-open**: if no commission was recorded or the build cannot be
served / shot, it is skipped gracefully (`commission: skip`) - doctrine + recorded
evidence, never a hard trap.

## Loop guardrails (the anti-rubber-stamp rules)

The loop is the discipline. Follow these verbatim:

- **A revision is accepted only if the rubric score improves.** "Improves" means the
  sum of the six axes is strictly greater than the previous iteration's, OR a named
  defect from the checklist is resolved with no new defect introduced. A revision
  that does not improve the score is rejected and re-attempted - do not accept lateral
  churn as progress.
- **The critic must name a concrete defect with a location before any axis may pass
  below 5**, and must name the single weakest section even on an otherwise-passing
  render. A clean first read of a freshly generated page is statistically unlikely;
  **"looks good" / "no issues found" with no located observation is treated as
  SUSPECT** and forces one more critic pass at higher scrutiny - look again, walk the
  defect checklist section by section.
- **Cap at 2-3 iterations, then escalate** to the human with the manifest, the gate
  output, and the screenshots attached. Do not loop forever; do not lower the bar to
  pass.

## What the verifier records

Per iteration, the verifier records (and writes to `verify-report.json` so the
done-gate reads computed evidence, not narration):

- `shots` - the PNG paths captured this iteration (`desktop_full`, `mobile_full`,
  and the per-section clips when `--sections` ran).
- `axes` - the six axis scores 1..5.
- `defects[]` - each `{ type, location }` from the fixed checklist that was found.
- `score` - the iteration score (the sum of the axes), so the next iteration can be
  checked for improvement.

`verify-report.json` shape (project root):

```json
{ "verdict": "pass|fail",
  "gates": { "depth":"pass", "uniqueness":"pass", "anti_slop":"pass", "provenance":"pass", "visual":"pass", "commission":"pass|fail|skip", "real_astro":"pass" },
  "visual": { "ran": true, "pass": true, "console_errors": 0,
    "iterations": [ { "i": 1, "axes": { "philosophy": 4, "hierarchy": 4, "execution": 4, "specificity": 4, "restraint": 4, "variety": 4 },
      "defects": [ { "type": "overflow", "location": "v1-hero mobile" } ], "score": 24,
      "shots": { "desktop_full": ".palate-shots/desktop-full.png", "mobile_full": ".palate-shots/mobile-full.png" } } ] },
  "shots_dir": ".palate-shots" }
```
