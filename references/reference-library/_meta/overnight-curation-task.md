# Overnight curation - run it on demand or on a schedule

The capture pipeline is built to run unattended for hours. The reference library
data lives in a public GitHub repo (see `library-architecture.md`); curation
clones it, adds entries, and pushes. Nothing here auto-runs - it runs when you
choose.

## Option A - run it now
Say: **"Work the reference-library curation queue."** Claude syncs the repo,
reads `_meta/curation-queue.json`, and captures + analyses pending sites in
priority order until you stop it or the queue is done.

## Option B - one batch tonight
Say: **"Tonight, work through the curation queue for a few hours."**

## Option C - a recurring schedule
Ask to schedule it, or set it up yourself. Suggested cron: `0 2 * * *` (2am
daily; self-limiting - once the queue is done a run is a quick no-op or a
refresh check).

## The self-contained task prompt

Whichever option, this is the full instruction set, written so a fresh
unattended session can execute it with no other context.

---

Run the overnight reference-library curation for the jiffi-website-builder skill.
Reverse-engineer top-tier websites into deep schema-v2 reference entries. Run
autonomously; never stop the batch for one bad site; notify Jake with a summary.

**Set up the library (it lives in a GitHub repo, not the skill):**
1. Locate the installed `jiffi-website-builder` skill (invoke it via the Skill
   tool to find its directory, or search for `jiffi-website-builder/SKILL.md`).
2. Run `eval "$(scripts/sync-reference-library.sh)"`. This clones/updates the
   public reference-library repo into a local cache and sets
   `JIFFI_REFERENCE_LIBRARY_PATH` to that clone. Work entirely inside that clone
   - call it LIB.
3. If the repo will not clone (it does not exist yet), STOP and tell Jake the
   repo named in `references/reference-library/library-source.json` must be
   created and pushed first.

**Capture engine setup:** Run `bash scripts/reference-capture/setup.sh` once
(installs Playwright + headless Chromium; idempotent - re-run if a ~45s shell
limit interrupts it).

**Pipeline.** Read `LIB/_meta` schema and pipeline docs, then read
`LIB/_meta/curation-queue.json`. Process `pending` and `v1-migrate` entries in
priority order. For each site, with `JIFFI_REFERENCE_LIBRARY_PATH=LIB`:
1. `bash scripts/add-reference-site.sh <slug> <url> <style> <mode> "<secondary>" <tier>`
2. `bash scripts/capture-reference-site.sh <slug> <url> LIB/catalog/<slug> "" desktop`,
   then again with `responsive`. (Separate calls - the sandbox caps shell calls
   near 45s.)
3. Read `catalog/<slug>/_capture/digest.md` + the raw JSON, VIEW the screenshots
   in `catalog/<slug>/assets/screenshots/`, then write every Layer-1 notes file
   to the depth in `_meta/schema.md` - cite the REAL captured values, never
   vague description. `astro-rebuild.md` is mandatory. Match the depth of the
   existing linear / stripe / vercel entries.
4. Validate: `jq empty` every JSON; no `<!--` stub left.
5. Set the queue status to `done` (or `unreachable`). Update the file in place
   via a captured variable + write - do NOT use `mv`.

**Commit and push after each site (so progress is never lost):**
`git -C LIB add -A && git -C LIB commit -m "Add <slug> reference" && git -C LIB push`.
If push fails (no credentials), keep going and tell Jake in the summary that the
clone at LIB has uncommitted-or-unpushed work to push manually.

**Time-box** to about 3 hours. Quality over quantity - four deep entries beats
twelve thin ones. If the queue is empty, refresh sites past their
`_meta/refresh-schedule.md` due date.

**Notify Jake** at the end: sites added (tier + style), any unreachable, queue
remaining, and confirmation that the repo was pushed (or needs a manual push).

Posture: the library is internal Jiffi intelligence - extract deeply (real
tokens, motion curves, component anatomy), keep captured screenshots and SVGs as
reference material, keep voice notes abstract. Client deliverables are always
original work informed by these references, never copied from them.

---

## Why phased / why a repo

The capture is split into `desktop` and `responsive` phases because the sandbox
kills a process when its shell call returns (~45s cap). The library lives in a
GitHub repo, not the skill, because a skill is capped at ~200 files and the
library grows past that fast - see `library-architecture.md`.
