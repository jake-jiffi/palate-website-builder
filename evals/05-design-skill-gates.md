# Evals 05 to 10 - design-skill gates and disciplines

Six evals covering the design-skill round of additions (ux-lint, critique
discipline, perceptual floors, project-level hook, reviewer pass, brand
normalisation). Each section is an independent brief - run them individually
or as a regression sweep after any change to those subsystems.

The file format compresses six evals into one to stay under the 200-file
skill cap; each section keeps the brief / expected behaviour / checklist /
regression signals structure used elsewhere in `evals/`.

---

## Eval 05 - ux-lint catches every Critical rule it ships

### Brief (verbatim)

> Run `scripts/ux-lint.sh` against a known-bad project I have prepared at
> `/tmp/eval-uxlint-bad`. Confirm each Critical rule fires.

### Setup (the eval owner creates this fixture once)

```
/tmp/eval-uxlint-bad/src/copy.md        contains "leverage", "synergy",
                                        "game-changer", "let's dive in",
                                        "in today's fast-paced", an em dash —,
                                        "revolutionise"
/tmp/eval-uxlint-bad/src/styles.css     contains:
                                          font-family: 'Inter', sans-serif;
                                          background: linear-gradient(to right, purple, pink);
                                          transition: all 200ms;
/tmp/eval-uxlint-bad/src/page.astro     contains <input> without autocomplete
                                          and without name; <button> without type;
                                          a centred stock-hero stack
```

### Expected behaviour

The lint exits non-zero (1 on default `--fail-on=High`, 1 on `--fail-on=Critical`).
Every Critical rule that ships in `references/anti-patterns.md` produces at
least one finding against this fixture.

### Checklist (every box must tick)

- [ ] `no-em-dash` finding on `src/copy.md`.
- [ ] `banned-display-inter` finding on `src/styles.css`.
- [ ] `gradient-purple-to-pink` finding on `src/styles.css`.
- [ ] `transition-all` finding on `src/styles.css`.
- [ ] `input-missing-autocomplete` finding on `src/page.astro`.
- [ ] `input-missing-name` finding on `src/page.astro`.
- [ ] `ai-tell-leverage` finding on `src/copy.md`.
- [ ] `ai-tell-fast-paced` finding on `src/copy.md`.
- [ ] `ai-tell-let-dive` finding on `src/copy.md`.
- [ ] `ai-tell-game-changer` finding on `src/copy.md`.
- [ ] `ai-tell-synergy` finding on `src/copy.md`.
- [ ] `ai-tell-revolutionise` finding on `src/copy.md`.
- [ ] Exit code 1 (Critical / High findings present, default fail-on).
- [ ] `--ci` flag emits TSV (file, line, severity, rule, text).
- [ ] `--disable no-em-dash,ai-tell-synergy` suppresses those two and ONLY those two.
- [ ] Adding a `// ux-lint-disable banned-display-inter` comment on the offending
      line suppresses that finding only.
- [ ] On a clean fixture (no violations), the lint exits 0.

### Regression signals

A Critical rule that does not fire on its known-bad pattern means the
linter is broken or the rule's regex no longer matches. A finding that
fires on a CLEAN file means the regex is too loose; tighten it.

---

## Eval 06 - the four critique habits are visibly applied

### Brief (verbatim)

> Build a preview of a website for Tarn Architecture, a Hobart studio that
> does heritage restoration and contemporary additions. Strong, considered,
> not loud.

### Expected behaviour

A standard Explore-first preview build. The eval is whether the four
critique-discipline habits show up in the transcript and the artefacts.

### Checklist

- [ ] Every generated variant (v1..vN) has a stated **Design Read** in the
      build transcript or as a comment in the variant `.astro` file's
      frontmatter, in the exact form: "Reading this as: a {page kind} for
      {audience}, with a {vibe} language, leaning toward {design direction}."
      A generic Design Read ("a modern marketing site for users") fails.
- [ ] At Phase A.3 (Compose), the transcript shows a **6-axis pre-emit
      critique** scoring Philosophy / Hierarchy / Execution / Specificity /
      Restraint / Variety, 1 to 5 each. Any axis below 3 must have triggered
      a revision pass before emit.
- [ ] At Compose, the transcript shows the **Conceptual Grounding Test**
      applied to every section, with one sentence per section completing
      "This exists because {a specific reason}." A section that cannot pass
      the test is removed.
- [ ] In Claude's own narration of the build (the variant write-ups, the
      Compose summary, the handover note), **none of these words appear** as
      descriptors of the design: `clean`, `nice`, `modern`, `sleek`,
      `beautiful`, `stunning`, `minimal`, `bold`, `elegant`, `polished`,
      `striking`. Where one appears in a client brief or brand voice doc it
      may be quoted; Claude's own assessment must use specific observations.
- [ ] `scripts/ux-lint.sh` passes on the final preview.

### Regression signals

A generic Design Read, a missing critique score, a section that fails the
grounding test still shipping, or any vague-word descriptor in Claude's own
narration. Any of these indicates the discipline has drifted to ceremony.

---

## Eval 07 - perceptual floors are enforced in the brand package

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

---

## Eval 08 - the project-level anti-slop hook fires on Edit

### Brief (verbatim)

> Scaffold a project from the astro-project template. Then, in a fresh
> Claude Code session inside that project, try to write a banned pattern
> to `src/lib/content.ts` and confirm the hook blocks it.

### Setup

A scaffolded Jiffi project at, say, `~/work/scaffold-test-site/`, generated
by the standard Phase A.1 (template copy + `_claude/` -> `.claude/` merge).

### Expected behaviour

The project ships with `.claude/hooks/anti-slop-check.js` and
`.claude/settings.local.json` (merged from the template's `_claude/`).
PostToolUse on Edit / Write / MultiEdit invokes the hook. Critical-severity
violations exit 2 and surface a clear message Claude can act on.

### Checklist

- [ ] `~/work/scaffold-test-site/.claude/hooks/anti-slop-check.js` exists
      and is valid ESM (the host package.json has `"type": "module"`).
- [ ] `.claude/settings.local.json` registers the hook on
      `Edit|Write|MultiEdit`.
- [ ] Editing `src/lib/content.ts` to add `"leverages synergy"` triggers the
      hook with exit code 2; the message names both `ai-tell-leverage` and
      `ai-tell-synergy`, line numbers, and the Fix paragraphs.
- [ ] Adding `font-family: 'Inter', sans-serif;` to `src/styles/globals.css`
      triggers `banned-display-inter`.
- [ ] Adding a `—` (em dash) to any covered file type triggers `no-em-dash`.
- [ ] A `// ux-lint-disable ai-tell-leverage` comment on the offending line
      suppresses ONLY that finding; another Critical violation on a
      different line still blocks.
- [ ] A clean Edit (no banned patterns) exits 0; the hook does NOT block
      legitimate edits.
- [ ] The hook does NOT trigger on Edit / Write outside the project (e.g.
      against `~/Downloads/something.md`).

### Regression signals

Hook missing after scaffold (the `_claude/` merge did not happen); hook
present but not blocking on Critical (a regex broke); hook blocking on
clean files (regex too loose); hook firing on files in `node_modules/` or
`.git/` (the skip list is wrong).

---

## Eval 09 - the reviewer pass catches an intentional weakness

### Brief (verbatim)

> Build a preview of a website for Marrickville Trades, a small electrical
> business. The blog index is intentionally rendered with no zero-items
> state - I want to see whether the reviewer pass catches it.

### Expected behaviour

At Phase A.4, after the canonical pages are composed and `content.ts` is
filled, Claude takes the reviewer stance and walks the pages against
`references/audit-dimensions.md`. The empty-state oversight on the blog
index is named in the findings list (Vercel format: `file:line: finding`).
The build does not advance until the finding is fixed.

### Checklist

- [ ] Reviewer-pass output exists in the build transcript or as
      `audit-findings.md` in the project root.
- [ ] Output format is `file:line  [severity / dimension] finding`, grouped
      by file, no preamble, no padding. `pass` is allowed on files with no
      Critical or High findings.
- [ ] The finding on `src/pages/blog/index.astro` (or whichever path the
      collection lives at) is recorded at Severity High under the
      `empty-state` dimension, with a concrete fix suggested.
- [ ] Before fix, the build is halted (does not hand over the preview).
- [ ] After fix, the reviewer pass re-runs and reports no Critical or High
      findings on the affected file (`pass` is acceptable).
- [ ] `scripts/ux-lint.sh` is also re-run after fix and is clean.
- [ ] The preview is handed over only after both the reviewer pass and
      `ux-lint.sh` come back clean.

### Regression signals

The reviewer pass not running (no `audit-findings.md` and no findings in
the transcript); the empty-state hole NOT named in the findings (the audit
dimension is wired but the reviewer is rubber-stamping); the build handed
over before findings are fixed; output in prose rather than `file:line`
format (the discipline has drifted).

---

## Eval 10 - brand normalisation rules upgrade raw input to a usable package

### Brief (verbatim)

> Build the brand package for Coastal Legal, a Newcastle law firm. The
> raw inputs deliberately violate the normalisation rules: body text at
> 15px, four candidate primary colours, a body family with seven weights,
> a button radius of 32px, transition durations of 80ms and 600ms, only
> palette-primitive tokens with no semantic aliases.

### Expected behaviour

BUILD BRAND runs the normalisation pass from
`references/brand/normalisation-rules.md` between raw extraction and
token emission. The emitted brand package conforms to every rule; each
override is named in the README's "Decisions made on your behalf" section.

### Checklist

- [ ] Body text size in the emitted tokens is `16px` (the 15px spec was
      bumped).
- [ ] Of the four candidate primaries, one is selected based on highest
      interactive usage; the others become secondary or tertiary. The
      decision is documented.
- [ ] Body family weight count is collapsed to three (the most-used three);
      the README names the dropped weights.
- [ ] Button border-radius is capped at 24px (down from 32px), unless the
      brand README declares a pill style with rationale.
- [ ] Transition durations are clamped to the 150 to 300ms band: 80ms is
      bumped to 150ms; 600ms is capped at 300ms. The README names the
      overrides.
- [ ] The emitted token set includes semantic aliases (`colour-action`,
      `colour-link`, `space-1`, `space-2`, etc.) over the palette primitives.
- [ ] Every fired rule produces a one-liner in `brand/README.md` under
      "Decisions made on your behalf".

### Regression signals

A normalisation rule that silently does not apply (the raw 15px ships as
body text); an override that fires but is NOT named in the README (the
client cannot see what the skill changed); a "primary" colour picked
arbitrarily rather than by the documented rule.
