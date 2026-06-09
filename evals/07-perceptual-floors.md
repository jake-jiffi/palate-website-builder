# Eval 07 - perceptual floors are enforced in the brand package

### Brief (verbatim)

> Build the brand package for Salt Acoustic, a small audio studio. Their
> raw assets include a brand PDF that specifies body text at 14px, white
> body text on a dark hero, disabled buttons at 50% opacity, and a
> 6-stop type scale.

### Expected behaviour

BUILD BRAND ingests the raw assets, applies the rules in
`references/brand/normalisation-rules.md`, and emits a brand package that
meets every perceptual floor in `references/brand/perceptual-floors.md`.
The README documents every override.

### Checklist

- [ ] Body text size in the emitted tokens is `>= 16px` (the 14px spec was
      upgraded). The README's "Decisions made on your behalf" section names
      the override and cites the WCAG SC.
- [ ] Body text colour on dark surfaces is `#E2E8F0` or lighter, NEVER pure
      `#FFFFFF`. The README names the override.
- [ ] Disabled-state opacity is `0.4`, not `0.5`. The README names the
      override.
- [ ] Type scale is snapped to a documented ratio (1.125 / 1.2 / 1.25 /
      1.333 / 1.414 / 1.5); the 6-stop free-floating scale was not preserved.
- [ ] Focus ring is present at >= 2px and meets >= 3:1 contrast against both
      light and dark backgrounds.
- [ ] Min tap-target size in interactive component specs is 44x44px.
- [ ] Body line-height is between 1.5 and 1.7.
- [ ] `scripts/ux-lint.sh` against the emitted brand CSS reports zero
      perceptual-floor violations.

### Regression signals

A floor honoured by silent guess rather than a documented override; a CSS
value that violates a floor with no `ux-lint-disable` explanation; a README
that does not list the overrides.
