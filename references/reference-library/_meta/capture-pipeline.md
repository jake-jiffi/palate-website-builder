# The capture pipeline

How a top-tier website becomes a deep reference entry. The pipeline is built to
run unattended (an overnight scheduled task drives it), so every step is
idempotent and survives interruption.

## The engine

`scripts/reference-capture/capture.mjs` drives a real headless Chromium
(Playwright) over a site and extracts a structured record of how it is built.
It does NOT do `web_fetch` of raw HTML - it renders the page, runs its
JavaScript, scrolls it to trigger lazy content and motion, and reads the
*computed* result. That is the difference between describing a site and
reverse-engineering it.

What it extracts: every CSS custom property the site declares; colour, spacing,
radius and shadow values by usage frequency; the real numeric type scale;
font families and `@font-face`; every CSS transition and `@keyframes` name;
animation-library and framework detection; the computed styles of representative
elements; the DOM section outline; the network resource list; inline SVG assets;
and screenshots at three breakpoints plus a desktop scroll filmstrip.

## Why phases

The Cowork sandbox kills any process the moment its shell call returns, and a
shell call is capped near 45 seconds. A full multi-breakpoint capture does not
fit in one call. So the capture is split into phases, each of which finishes
inside one call and writes its results to disk before exiting:

- `--phase desktop` (default, ~12-30s) - the analytical pass. Desktop render,
  deep extraction, all `_capture/*.json`, the digest, the SVG assets, the
  desktop screenshot and scroll filmstrip. This phase produces everything the
  notes are written from.
- `--phase responsive` (~15-25s) - the mobile and tablet full-page screenshots.
  Updates the manifest from the desktop phase.
- `--phase full` - both, in one process. Only safe in an environment without
  the shell time limit.

The curator runs `desktop` then `responsive` as two separate calls per site.

## Setup (once per environment)

`scripts/reference-capture/setup.sh` installs the Playwright npm package and the
headless Chromium build (cached in `~/.cache/ms-playwright`). Idempotent; if a
45s limit interrupts it, run it again - npm and `playwright install` both
resume. Run setup once at the start of a batch, before any capture.

Engine config note: launch with `channel: 'chromium'` (the full Chromium
build). The bundled `headless_shell` segfaults in the sandbox; the full build is
stable. `capture.mjs` already does this.

## Network reality in the sandbox

The sandbox has allowlisted outbound network. Major sites resolve and load
(stripe.com, linear.app, vercel.com and similar). Some niche or
award-portfolio domains may not resolve. When a site is unreachable the engine
writes `manifest.json` with `status:"unreachable"` and exits 0, so a batch
keeps going. The curation queue records these so they can be retried or done
later via the Claude-in-Chrome path.

## The end-to-end curator flow

For one site:

1. `scripts/add-reference-site.sh <slug> <url> <style> <mode> [secondary] [tier]`
   - scaffolds `catalog/<slug>/` with the v2 notes stubs, updates `index.json`.
2. `scripts/capture-reference-site.sh <slug> <url> catalog/<slug> "<inner>" desktop`
   - runs the desktop phase.
3. `scripts/capture-reference-site.sh <slug> <url> catalog/<slug> "" responsive`
   - runs the responsive phase.
4. The curator (Claude) reads `catalog/<slug>/_capture/digest.md`, then the raw
   JSON, then VIEWS the screenshots in `assets/screenshots/`, and writes every
   Layer 1 notes file - including `astro-rebuild.md`.
5. Validate: `jq empty` the JSON files; confirm `select-references.sh --site
   <slug>` returns it.

Steps 1-3 are mechanical and fast. Step 4 is the real work and the reason a
human-grade model does it, not a script.

## Refreshing

Re-run `add-reference-site.sh` (it preserves existing notes, only re-stubs
missing files) and the two capture phases. The capture overwrites Layer 2 and
Layer 3. The curator then diffs the new `_capture/digest.md` against the notes
and updates anything the site changed. `_meta/refresh-schedule.md` tracks due
dates.
