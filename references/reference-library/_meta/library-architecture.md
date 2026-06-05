# Reference library architecture - skill vs repo

A Claude skill is capped at roughly 200 files. A deep reference library is not:
each schema-v2 entry is ~55-60 files (notes, raw capture, screenshots, SVG
assets), so even a dozen sites would blow the cap. The library is therefore
split in two.

## What lives in the SKILL (machinery - small, fixed)

`references/reference-library/` in the skill keeps only the methodology:
- `_meta/schema.md` - the entry contract
- `_meta/capture-pipeline.md` - how the capture engine works
- `_meta/style-taxonomy.md`, `_meta/mode-taxonomy.md` - the fixed taxonomies
- `_meta/overnight-curation-task.md` - the curation runbook
- `_meta/library-architecture.md` - this file
- `library-source.json` - points at the data repo

Plus the scripts (`capture-reference-site.sh`, `add-reference-site.sh`,
`select-references.sh`, `sync-reference-library.sh`, `reference-capture/`) and
the usage/curation docs at `references/`.

## What lives in the REPO (data - grows without limit)

The public GitHub repo `jake-jiffi/website-references` (URL in
`library-source.json`) - anyone using the skill can contribute to it directly:
- `catalog/<slug>/` - every analysed site, full schema v2
- `index.json` - the style x mode lookup matrix
- `_meta/curation-queue.json` - the queue of sites to capture
- `_meta/refresh-schedule.md` - re-inspection dates
- `CONTRIBUTING.md` - how to add a site

The repo can hold thousands of files. It is also independently useful - like
`jiffi-brand-assets`, it is a clean public artefact other tools can read.

## How they connect

1. `scripts/sync-reference-library.sh` clones / pulls the repo into a local
   cache (`~/.cache/jiffi-website-references` by default) and prints an
   `export JIFFI_REFERENCE_LIBRARY_PATH=...` line.
2. `eval "$(scripts/sync-reference-library.sh)"` sets that variable.
3. `select-references.sh` and `add-reference-site.sh` already honour
   `JIFFI_REFERENCE_LIBRARY_PATH` - they now read and write the local clone.
4. CURATE captures into the clone, commits, and `git push`es - the library
   grows in the repo, and every machine `sync`s the new entries next pull.

Reads need no credentials (public repo). Pushing (the curation flow) needs git
push access on the machine doing the curating.

## First-time setup

The repo lives at `https://github.com/jake-jiffi/website-references`.

Reads (cloning during a build) need no credentials - the repo is public.
Pushing new entries needs a GitHub token with Contents:write: set it as the
`JIFFI_GITHUB_TOKEN` environment variable and `sync-reference-library.sh` uses
it. The token is NEVER stored in the skill or the repo - see the `auth` block in
`library-source.json`. Anyone with push access can contribute captured sites
directly.
