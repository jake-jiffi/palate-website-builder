# Curating the reference library (how this skill gets better)

The skill keeps only the reference-library MACHINERY (`references/reference-library/`);
the CATALOG of analysed sites lives in an external public GitHub repo,
`github.com/jake-jiffi/website-references`, and is synced via
`scripts/sync-reference-library.sh` (see `_meta/library-architecture.md`).
Every site added to the catalog makes the website builder more capable,
because BUILD SITE draws on it for structure, motion, tokens and component
behaviour.

Schema v2 (this version) does not describe sites from raw HTML. It
reverse-engineers them with a real headless browser. Read `_meta/schema.md` for
the entry contract and `_meta/capture-pipeline.md` for how the engine works.

## Adding a site (the curator workflow)

When Jake says "add {site}", "study {url}", or the overnight task pulls the next
site from `_meta/curation-queue.json`:

### 0. Sync the library

The catalog lives in a GitHub repo, not in this skill (a skill is capped at ~200
files - see `reference-library/_meta/library-architecture.md`). Before anything:

```
eval "$(scripts/sync-reference-library.sh)"
```

That clones / updates the repo and sets `JIFFI_REFERENCE_LIBRARY_PATH` to the
local clone. Every step below operates on that clone.

### 1. Scaffold

```
scripts/add-reference-site.sh <slug> <url> <style> <mode> [secondary-csv] [tier]
```

Creates `catalog/<slug>/` with the v2 notes stubs and the `_capture/` and
`assets/` folders, updates `index.json`, appends to the refresh schedule.

### 2. Capture (the engine does the seeing)

Once per environment, first: `scripts/reference-capture/setup.sh`.

Then, two phases:

```
scripts/capture-reference-site.sh <slug> <url> catalog/<slug> "<inner-csv>" desktop
scripts/capture-reference-site.sh <slug> <url> catalog/<slug> "" responsive
```

The desktop phase renders the site, runs its JS, scrolls it, and extracts the
computed result into `catalog/<slug>/_capture/` plus screenshots and SVG assets.
The responsive phase adds mobile and tablet screenshots. Phases exist because
the sandbox kills processes at ~45s; each phase fits in one call.

If the manifest comes back `unreachable`, the sandbox cannot reach that domain.
Record it in the queue and either retry later or capture it through the
Claude-in-Chrome browser tools instead, then write the notes from what you see.

### 3. Write the notes (the real work - Claude does this)

**Write `principle.md` FIRST.** Finish the sentence "This is a good example
of ___" in a single, specific principle (e.g. `hierarchy-through-scale-contrast`,
`restraint-via-single-accent`, `editorial-rhythm-over-grid`). MAX 3 tags;
mirror them into `tags.json`'s `principle[]` field. If the sentence cannot
be finished without filler, the entry is not worth adding - delete the
stub and move on. The principle, not the aesthetic, is what the entry
teaches; the rest of Layer 1 is the argument for it.

Then read `catalog/<slug>/_capture/digest.md`, then the raw JSON, then VIEW the
screenshots in `catalog/<slug>/assets/screenshots/` (open them - the filmstrip
shows the motion and the section rhythm). Then write every Layer 1 file to the
quality bar:

- `overview.md` - the essence, the tier, what to borrow, what is too brand-coded.
- `tokens.json` - the cleaned canonical tokens, de-noised from `tokens.raw.json`.
- `typography.md`, `layout.md`, `visual-system-notes.md`, `structure-notes.md`,
  `components.md`, `voice-notes.md` - deep notes per `_meta/schema.md`.
- `motion.md` + `motion.json` - the signature motion, the interaction inventory,
  each interaction with a real `astroRecipe`.
- `astro-rebuild.md` - the translation layer. How to reproduce these strengths
  on Astro + Tailwind + the client brand package. THIS IS THE POINT of the
  upgrade; do not skip or thin it.

Use the captured numbers. The whole reason the engine exists is so the notes say
`cubic-bezier(0.25, 0.46, 0.45, 0.94)` and `0.16s`, not "a smooth quick ease".

### 3b. Extract the signature moves (the distinctiveness the build reproduces)

After the notes, derive **1-3 `signatureMoves`** for the entry and write them onto
its fingerprint in `_meta/insights/index.json` (the generator carries them into
`catalog.json`, the seed into the MCP). A signature move is a distinctive,
borrowable craft pattern - the compositional / motion / type move that makes the
site feel designed - captured concretely enough to reproduce:

```
{ "name": "full-bleed pinned hero stage",
  "what": "a 100vh hero with the headline pinned left and the proof bleeding off the right edge",
  "how": "Astro section, CSS grid 7/5 split, position:sticky stage, IntersectionObserver reveal",
  "reskin": "swap the photo and the accent hue for the client's; keep the split, the bleed and the pin" }
```

Derive them from the EXISTING notes - `structure-notes.md` ("the rhythm to
borrow"), `motion.json` (the signature interaction), `visual-system-notes.md` -
and the real `tokens.json` (use the captured radii, scale and easings in `how`).
The `reskin` field always names what to substitute (hexes, wordmark, photos,
copy) and what to keep (the choreography, the grid, the rhythm).

**Reframe, do not strip.** Where an older note says "a decorative signature - do
NOT clone, design an original effect", rewrite it to "reproduce the PATTERN
faithfully; re-skin the identity (swap the hexes/asset, keep the choreography)".
The only thing off-limits is the identity layer (the literal artefact: exact
hexes, wordmark, font files, photos, a trademark-grade gimmick like Linear's
literal dot-grid). The craft pattern is always reproducible. This is the two-layer
doctrine in `reference-library-usage.md`.

### 4. Validate

`jq empty` the JSON files. Confirm `select-references.sh --site <slug>` returns
it. Confirm `manifest.json` status is `captured` and no notes file still has its
stub comment. Confirm the fingerprint carries a non-empty `signatureMoves`.

### 5. Commit and push

The library is a Git repo. Commit and push so the entry is permanent and every
machine picks it up on the next sync:

```
git -C "$JIFFI_REFERENCE_LIBRARY_PATH" add -A
git -C "$JIFFI_REFERENCE_LIBRARY_PATH" commit -m "Add <slug> reference"
git -C "$JIFFI_REFERENCE_LIBRARY_PATH" push
```

## Refreshing existing sites

`_meta/refresh-schedule.md` tracks due dates (quarterly). Re-run
`add-reference-site.sh` (it preserves filled notes, only re-stubs missing
files), re-run both capture phases, diff the new `_capture/digest.md` against the
notes, update what changed, update the schedule row.

## Migrating a v1 entry

The five original entries (linear, stripe, anthropic, plain, aesop) are schema
v1: six shallow files, a vague `tokens-extracted.json`. To upgrade one, treat it
as a refresh - scaffold (adds the v2 stubs alongside), capture, rewrite. The old
`tokens-extracted.json` can stay as a deprecated artefact or be folded into the
new `tokens.json`.

## Quality over coverage

A shallow entry is worse than no entry: it misleads a build. Better five deep
references than forty thin ones. The overnight task is allowed to be slow.

## Pruning ratio

For every ten new entries added, prune roughly five dead ones - references
that have not been used in 12+ months, sites that have rebranded so heavily
the captured notes no longer match, or entries whose principle is now better
expressed by a newer entry. A library's value is in its sharpness, not its
size; 200 strong references beats 2000 unsorted ones. The curation queue
tracks pruning candidates alongside additions.

## The taxonomies

Styles and modes are fixed (`_meta/style-taxonomy.md`, `_meta/mode-taxonomy.md`).
The `tier` field (`flagship` / `strong` / `niche`) ranks craft, not category.
Don't invent new styles or modes casually; the 6x3 matrix is what makes lookup
predictable.
