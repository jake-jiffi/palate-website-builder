# Testing and verification

## The eval suite (run on every skill change AND every model upgrade)

The skill ships an eval pyramid. Run it whenever the skill changes, and again on every
model upgrade: a model swap shifts the VLM's taste and the sampling behaviour the
divergent spine (Move 1) and the visual loop (Move 3) depend on, so a suite that was
green on one model is not assumed green on the next.

**1. The deterministic gate tests (fast, no model in the loop) - the floor.** Run them
all; every one must be green:

```
for t in scripts/test/*.test.sh; do bash "$t"; done
```

These cover the gates the build leans on: `gate-mcp-depth` (the depth floor, fail-open
contract), `gate-uniqueness` (within-build distinctness), `gate-novelty` (the CONVERGE
concept pre-check + cross-build / type-face recurrence), `gate-done` (the visual +
verifier + novelty "done" gate, fail-open ladder), `ux-lint-eyebrow` (the kicker tell),
and `self-review-fired` (the keystone: a seeded visual defect BLOCKS "done", a clean
build is ALLOWED - `evals/12-self-review-fired.md`).

**2. The two-plane eval over a finished build.** `scripts/eval-runner.mjs` scores one
build on the PROCESS plane (did it draw on the library with depth, AND did DIVERGE
sample wide + CONVERGE score two axes) and the OUTPUT plane (uniqueness + slop + the
cross-build novelty gate):

```
node scripts/eval-runner.mjs --manifest <build>/build-manifest.json --variants <build>/*.html
```

**3. The golden + audacious sets (on-demand, one build per brief).** A full skill build
per brief is heavy, so these run out-of-band: build each brief once into
`<results>/<brief-id>/` (manifest + rendered variant HTML), then aggregate:

```
node scripts/eval-suite.mjs --briefs evals/golden-briefs.json    --results <results>
node scripts/eval-suite.mjs --briefs evals/audacious-briefs.json --results <results>
```

`evals/golden-briefs.json` over-represents the thin everyday verticals (the moat vs
generic slop); `evals/audacious-briefs.json` proves the other failure mode - that the
skill samples wide, advances from the low-typicality tail, decomposes ambition into
buildable mechanics, and still clears the visual loop + every gate
(`evals/11-novelty.md`). `eval-suite` reports a pass-rate and exits 0 only when every
PRESENT build passes (a not-yet-built brief is reported "missing", not failed; add
`--strict` to require every brief built for a CI gate). Run `>= 3` trials per brief and
end-state; every new failure becomes a new case.

## Per-phase verify scripts
Each phase has a verify-{phase}.sh that must pass before the phase is marked complete. See pipeline.md.

## Build-time checks (in CI)
- astro check (typecheck)
- npm run build (must succeed; a logic error here halts, never deploys broken)

## What is actually measured, and on how much of the site

Nothing in this plugin runs Lighthouse. The doctrine used to say "Lighthouse CI, baseline
100s", which promised a gate that does not exist and a number nothing produced.

- **Performance** is a local lab run of Core Web Vitals (`scripts/reference-capture/vitals.mjs`)
  under PageSpeed's own mobile emulation, slow 4G with 4x CPU throttling. It runs on the HOME
  route only, and it is a lab proxy rather than field data: TBT is not INP and is labelled TBT.
  Unthrottled numbers are worthless here, 7.9x apart from the throttled ones on our own site,
  which is why the emulation is not optional.
- **Accessibility** is a SUBSET of axe, described in `references/audit-dimensions.md`, run at
  three viewports. Clearing it is not a WCAG 2.2 AA pass.
- **Coverage.** `verify-rendered.sh` renders the first **14 routes** by default and says how
  many it dropped. On a bigger site raise it with `--max-routes <n>`, or pass `--routes` to
  name the ones that matter. A 3,400-page site is measured on 14 pages unless you say
  otherwise, and the summary prints exactly that.
- **Re-running after a fix.** `--changed <file,...>` renders only the routes those files can
  reach, and a file the index has never heard of falls wide and says which one. A route whose
  sources have not changed since it last passed is skipped and printed "unchanged, skipped";
  the record lives in `.palate-shots/manifest.json` as `{ sourcesHash, renderedHash,
  passed_at }` per route. Measured on a thirty-route fixture: 25s against a 187s sweep. Run
  the lanes cheap first, ux-lint before rendered, rendered before vitals.
- **The sweep before hand-over is `--full`**, which ignores every unchanged-route record. The
  hash covers a route's own source and its import closure and nothing else,
  so a config or dependency change is invisible to it.
  Converge incrementally, certify on a full sweep.

## Post-deploy smoke checks
- workers.dev returns 200
- robots.txt, sitemap, llms.txt return 200
- the contact form, BY HAND, once. Nothing posts it automatically yet; see the section below.

## The form round-trip test

**Not implemented. Implemented by E5**, which submits the form against the preview and the
deployed URL. Nothing today fills or posts the contact form, so a broken endpoint, a wrong
Turnstile key or a bad Resend token ships silently. Until then, submit the form by hand once
after a deploy and watch for the mail.
