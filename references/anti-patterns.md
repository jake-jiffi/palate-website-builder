# Anti-patterns - the rules `scripts/ux-lint.sh` enforces

This file is BOTH the human spec and the machine source of truth. The linter
parses every `### Rule: ...` heading below and runs its `Pattern` against the
project's files at the listed `Files` globs. Add a rule by adding a section.
Disable a single hit in code with a `ux-lint-disable <rule-id>` comment on the
same or previous line.

Severities: **Critical** halts the build. **High** halts the build by default
(`--fail-on=High`). **Medium** reports but does not halt. **Cosmetic** is
advice only.

Modes: **always** (every run), **variant-time** (per-variant during Explore),
**compose-time** (after Compose, before Finalise), **production** (Phase B
onward).

The seed below combines the named bad-actor list from Anthropic's
frontend-design skill, the curated subset of anti-slop-ui's 34 tells, the
Vercel `web-interface-guidelines/command.md` code-level rules (copied in, NOT
remote-fetched), and Jiffi's house-style (no em dashes, Australian English).

---

## House style

### Rule: no-em-dash
- Severity: Critical
- Mode: always
- Files: *.astro,*.css,*.ts,*.tsx,*.mjs,*.md,*.mdx,*.json
- Pattern: `—`
- Fix: Em dashes are not Jiffi house style. Replace with " - " (a spaced hyphen), a comma, parentheses, or a colon. Apply to copy and to inline comments.

### Rule: no-en-dash-as-em
- Severity: Medium
- Mode: always
- Files: *.astro,*.md,*.mdx
- Pattern: `–`
- Fix: En dashes are for number / date ranges (e.g. `9-5`, `2024-2025`); not a substitute for em dashes. If you meant a sentence break, use " - ".

---

## Banned display fonts (Anthropic frontend-design)

### Rule: banned-display-inter
- Severity: Critical
- Mode: always
- Files: *.css,*.ts,*.tsx,*.astro,*.mjs
- Pattern: `font-family\s*:\s*['"]?Inter`
- Fix: Inter is the AI-default display font and instantly reads as average. Use a more committed face from the brand package (a contemporary grotesque, a humanist sans, an editorial serif, a display) selected as part of the brand's voice.

### Rule: banned-display-roboto
- Severity: Critical
- Mode: always
- Files: *.css,*.ts,*.tsx,*.astro,*.mjs
- Pattern: `font-family\s*:\s*['"]?Roboto`
- Fix: Roboto is Material's default; banned as a marketing-site display family for the same reason as Inter.

### Rule: banned-display-arial
- Severity: Critical
- Mode: always
- Files: *.css,*.ts,*.tsx,*.astro,*.mjs
- Pattern: `font-family\s*:\s*['"]?Arial`
- Fix: Arial as a primary display family signals "no design opinion". Pick from the brand package.

### Rule: banned-display-space-grotesk
- Severity: Critical
- Mode: always
- Files: *.css,*.ts,*.tsx,*.astro,*.mjs
- Pattern: `font-family\s*:\s*['"]?Space Grotesk`
- Fix: Space Grotesk is the 2023-2024 startup default; overuse has made it generic. Use a face the brand actually chose.

### Rule: banned-display-system-ui
- Severity: High
- Mode: always
- Files: *.css,*.ts,*.tsx,*.astro,*.mjs
- Pattern: `font-family\s*:\s*['"]?system-ui['"]?\s*[,;]`
- Fix: `system-ui` as the FIRST family in a display stack means the page renders different fonts on different OSes; do not use as primary. Acceptable only at the tail of a stack as a safety net.

---

## Banned visual defaults

### Rule: gradient-purple-to-pink
- Severity: Critical
- Mode: always
- Files: *.css,*.ts,*.tsx,*.astro
- Pattern: `(?i)(linear|radial)-gradient\([^)]*purple[^)]*pink`
- Fix: Purple-to-pink linear gradients are the AI hero default and an instant tell. Pick a single brand colour and use weight, contrast and composition for emphasis.

### Rule: gradient-pink-to-purple
- Severity: Critical
- Mode: always
- Files: *.css,*.ts,*.tsx,*.astro
- Pattern: `(?i)(linear|radial)-gradient\([^)]*pink[^)]*purple`
- Fix: Same as the reverse direction; this is the same gradient.

### Rule: neon-text-glow
- Severity: High
- Mode: always
- Files: *.css,*.ts,*.tsx,*.astro
- Pattern: `text-shadow\s*:\s*[^;]*0\s+0\s+\d+`
- Fix: Big-blur neon text glows on body type are decorative slop. If glow is a brand decision, it lives in the brand package as a documented effect, not inline.

### Rule: many-stop-gradient
- Severity: High
- Mode: always
- Files: *.css,*.ts,*.tsx,*.astro
- Pattern: `gradient\((?:[^,()]|\([^)]*\))*,(?:[^,()]|\([^)]*\))*,(?:[^,()]|\([^)]*\))*,(?:[^,()]|\([^)]*\))*,`
- Fix: A gradient with four or more colour stops reads as a sticker. Two stops at most for marketing surfaces; three only if the brand documents it. (Pattern counts only top-level commas, so an `rgba()`/`hsl()`/`calc()` colour's internal commas do not falsely trip a 2-stop scrim or vignette.)

---

## AI-tell phrases (anti-slop-ui curated subset)

The lint rules below are the mechanical floor: a fixed list of the highest-signal
tells, caught deterministically so they never ship. They are not the full copy
pass. For that, run the `humanizer` skill over the copy: it sweeps 40+ patterns
(rhythm, hedging, structure, the puffery the regex cannot see) that no fixed
pattern list catches. Lint first to clear the obvious tells, then humanise for the
full sweep.

### Rule: ai-tell-leverage
- Severity: Critical
- Mode: always
- Files: *.md,*.mdx,*.astro,*.ts,*.tsx
- Pattern: `\bleverage\b`
- Fix: "Leverage" is the highest-frequency AI tell in marketing copy. Say "use", "apply", or just name the action.

### Rule: ai-tell-fast-paced
- Severity: Critical
- Mode: always
- Files: *.md,*.mdx,*.astro,*.ts,*.tsx
- Pattern: `(?i)in today's fast-?paced`
- Fix: Pure boilerplate. Open with a specific observation about the reader's actual situation; never with a sentence the reader has read 100 times.

### Rule: ai-tell-let-dive
- Severity: Critical
- Mode: always
- Files: *.md,*.mdx,*.astro,*.ts,*.tsx
- Pattern: `(?i)let'?s dive (in|into)`
- Fix: Tutorial-template language. Replace with the actual first step, named directly.

### Rule: ai-tell-game-changer
- Severity: Critical
- Mode: always
- Files: *.md,*.mdx,*.astro,*.ts,*.tsx
- Pattern: `(?i)game[- ]chang(er|ing)`
- Fix: Empty intensifier. Either delete it or replace with the concrete change.

### Rule: ai-tell-synergy
- Severity: Critical
- Mode: always
- Files: *.md,*.mdx,*.astro,*.ts,*.tsx
- Pattern: `(?i)synerg(y|ies|istic)`
- Fix: Corporate filler. Say what two things actually do together.

### Rule: ai-tell-unleash
- Severity: Critical
- Mode: always
- Files: *.md,*.mdx,*.astro,*.ts,*.tsx
- Pattern: `(?i)\bunleash(ing|es)?\b`
- Fix: Marketing cliche. Say "let people do X" or just describe the action. (Matches the verb forms unleash/unleashing/unleashes, not the proper noun "Unleashed" - the real inventory product some ops businesses partner with.)

### Rule: ai-tell-seamless
- Severity: High
- Mode: always
- Files: *.md,*.mdx,*.astro,*.ts,*.tsx
- Pattern: `(?i)\bseamless(ly)?\b`
- Fix: "Seamless" describes everything and nothing. Specify what was previously friction-full and is now smooth, with a number or example.

### Rule: ai-tell-crafted-with-care
- Severity: High
- Mode: always
- Files: *.md,*.mdx,*.astro,*.ts,*.tsx
- Pattern: `(?i)(crafted with care|lovingly crafted|handcrafted with)`
- Fix: Etsy template. Either delete or say what makes the work careful (the named technique, the time spent, the person who did it).

### Rule: ai-tell-revolutionise
- Severity: High
- Mode: always
- Files: *.md,*.mdx,*.astro,*.ts,*.tsx
- Pattern: `(?i)revolution(is|iz)e`
- Fix: Outsized claim. Replace with the concrete change being delivered.

### Rule: ai-tell-elevate-your
- Severity: High
- Mode: always
- Files: *.md,*.mdx,*.astro,*.ts,*.tsx
- Pattern: `(?i)elevate your`
- Fix: "Elevate your workflow / experience / brand" is template glue. Name the actual lift.

### Rule: ai-tell-cutting-edge
- Severity: High
- Mode: always
- Files: *.md,*.mdx,*.astro,*.ts,*.tsx
- Pattern: `(?i)cutting[- ]edge`
- Fix: Decade-old startup filler. Describe the actual newness, dated.

### Rule: ai-tell-delve
- Severity: High
- Mode: always
- Files: *.md,*.mdx,*.astro,*.ts,*.tsx
- Pattern: `(?i)\bdelve\b`
- Fix: The signature LLM verb. Say "look at", "dig into", or just make the point directly.

### Rule: ai-tell-in-the-realm-of
- Severity: High
- Mode: always
- Files: *.md,*.mdx,*.astro,*.ts,*.tsx
- Pattern: `(?i)in the realm of`
- Fix: Throat-clearing that adds nothing. Name the field plainly ("in payments", "for restaurants") or drop the phrase.

### Rule: ai-tell-its-worth-noting
- Severity: High
- Mode: always
- Files: *.md,*.mdx,*.astro,*.ts,*.tsx
- Pattern: `(?i)it'?s worth noting`
- Fix: Filler hedge. If it is worth saying, just say it; if it is not, cut it.

### Rule: ai-tell-underscore
- Severity: High
- Mode: always
- Files: *.md,*.mdx,*.astro,*.ts,*.tsx
- Pattern: `(?i)\bunderscore(s|d)?\b(?! ?_)`
- Fix: "Underscores the importance of" is LLM emphasis filler. Say "shows", "proves", or state the point. (The negative look-ahead skips the literal `_` character used in code and identifiers.)

### Rule: ai-tell-testament-to
- Severity: High
- Mode: always
- Files: *.md,*.mdx,*.astro,*.ts,*.tsx
- Pattern: `(?i)testament to`
- Fix: "A testament to" is empty praise. Give the concrete evidence instead (the number, the outcome, the named result).

---

## Code-level rules (Vercel web-interface-guidelines, copied in)

### Rule: transition-all
- Severity: High
- Mode: always
- Files: *.css,*.ts,*.tsx,*.astro
- Pattern: `transition\s*:\s*all\b`
- Fix: `transition: all` animates every property and causes layout thrash. List the specific properties (e.g. `transition: color 200ms, background-color 200ms`).

### Rule: tailwind-transition-all
- Severity: Medium
- Mode: always
- Files: *.astro,*.ts,*.tsx,*.html
- Pattern: `class[^=]*=\s*["'][^"']*\btransition-all\b`
- Fix: Same as `transition: all`. Use `transition-colors`, `transition-transform`, or a custom utility for the specific property.

### Rule: input-missing-autocomplete
- Severity: High
- Mode: always
- Files: *.astro,*.tsx,*.html
- Pattern: `<input(?![^>]*\bautocomplete=)[^>]*>`
- Fix: Inputs without `autocomplete` break browser autofill and harm conversion. Set the correct token (`email`, `name`, `tel`, `street-address`, `current-password`, etc.) or `autocomplete="off"` if truly free-form.

### Rule: input-missing-name
- Severity: High
- Mode: always
- Files: *.astro,*.tsx,*.html
- Pattern: `<input(?![^>]*\bname=)[^>]*>`
- Fix: Inputs without `name` cannot be submitted. Add a `name`; pair it with `id` and a `<label for=...>`.

### Rule: brand-name-needs-translate-no
- Severity: Medium
- Mode: always
- Files: *.astro
- Pattern: `(?i)(?<![\w@/."])(jiffi|sanity|cloudflare|vercel|astro|stripe|claude|anthropic)(?![\w/.-])`
- Fix: Wrap brand names with `<span translate="no">` so machine translators do not mangle them. Apply once per page where the name appears; not every mention needs wrapping in body prose. (Pattern skips import paths, `*.astro` filenames and the `Astro.*` global so it only flags brand names in visible text, not code.)

### Rule: useState-for-mouse-coords
- Severity: High
- Mode: always
- Files: *.tsx,*.ts
- Pattern: `useState[^(]*\(\s*\{[^}]*x\s*:[^,}]*,[^}]*y\s*:`
- Fix: `useState` for continuous mouse / pointer values triggers a re-render per move. Use a `ref` and read it in the animation frame, or use Motion's `useMotionValue`.

### Rule: button-without-type
- Severity: Medium
- Mode: always
- Files: *.astro,*.tsx
- Pattern: `<button(?![^>]*\btype=)[^>]*>`
- Fix: Inside a `<form>`, a button without `type` defaults to `submit` and accidentally submits. Always set `type="button" | "submit" | "reset"`.

---

## Anti-stock-shape rules (anti-slop-ui-derived)

### Rule: stock-hero-centred-stack
- Severity: Medium
- Mode: compose-time
- Files: src/pages/index.astro
- Pattern: `(?s)class="[^"]*text-center[^"]*"[^>]*>\s*<h1[^>]*>.*?</h1>\s*<p[^>]*>.*?</p>\s*<(a|button)[^>]*>.*?</(a|button)>\s*</(section|div)>`
- Fix: A centred H1 + sub + single button as the entire hero is the AI default. Add a real visual element (a product still, a chart, a quote, an asymmetric image), or build the hero off-centre, or commit to a maximalist text-only treatment with extreme type. Note: this regex is only a backstop - it catches the one literal shape, and a generic hero can dodge it a dozen ways. The real judgement is the interpretive audit (dimension 11 / critique habit 5), which reads the composition against the donor and asks whether it actually earns its layout, not whether it matched a pattern.

### Rule: emoji-as-icon
- Severity: Medium
- Mode: always
- Files: src/components/**/*.astro,src/components/**/*.tsx
- Pattern: `>\s*[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]\s*<`
- Fix: Emoji as section / feature icons signals AI shortcut. Use SVGs from the brand package, Lucide, or commissioned marks.

---

## How to extend

Add a `### Rule: <slug-id>` heading and the metadata block. Keep `Pattern`
as a single backtick-quoted regex when possible. For multi-line or
backtick-using regex, use a fenced code block immediately after `- Pattern:`
with the language tag `regex`. Every rule must have a Fix paragraph; an
unfixable rule is documentation, not enforcement.

Run after any edit: `scripts/ux-lint.sh <project-dir>` (defaults: rules from
this file, `--fail-on High`).
