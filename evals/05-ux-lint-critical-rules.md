# Eval 05 - ux-lint catches every Critical rule it ships

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
