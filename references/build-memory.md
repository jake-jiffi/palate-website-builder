# Build memory - cross-build diversification

A single per-Palate log of every build, so the Explore stage actively
diversifies the variant set away from what was shipped recently. Stops the
slow drift toward a "Palate house structure" that would emerge if every
project's variants were generated from the same blank slate.

## Where the log lives

Outside the skill, at:

```
~/.config/palate/builds.log.json
```

Same convention the skill already uses for the GitHub token (the directory is
gitignored by being outside the repo entirely). The skill does not ship this
file - it is created on the first build that runs on a machine.

## What gets logged

One entry per build, appended at Phase A.6 (Compose), the moment the canonical
home page is written:

```json
{
  "slug": "lighthouse-optometry",
  "date": "2026-05-26",
  "macrostructure": "hero-asymmetric / proof-strip / three-services / quote / footer-mega",
  "mode": "minimal-portfolio",
  "style": "service",
  "host": "vercel",
  "hero_pattern": "asymmetric-left-text-right-image",
  "dominant_tokens": "type=1.25-scale, density=spacious, accent=single-saturated",
  "explore_picks": ["v3-hero", "v7-features", "v5-cta"]
}
```

The `macrostructure` and `hero_pattern` fields are the diversification
signals. The other fields are useful for the post-mortem read.

## How the Explore stage uses the log

At Phase A.4 (Explore) plan checkpoint, read the last 5 entries. Apply two
hard rules when generating the variant set:

1. **No hero pattern repeated from the last 3 builds.** If the most recent
   three Palate builds all used a "centred display + image-right" hero, the
   variant set for this build cannot include another centred display + image
   right hero. Pick from the long tail.
2. **No identical macrostructure from any of the last 5 builds.** The
   full section sequence cannot repeat verbatim.

Soft signal: if the dominant token treatment (scale + density + accent
posture) matches a recent build's fingerprint, flag it in the variant
write-up so the picker is aware.

If the log file does not exist (first build on a machine) or has fewer than
three entries, the rules are inert and Explore proceeds normally.

## Why it lives outside the skill

The diversification signal is Palate-wide, not per-project. A log inside any
single project would only track that project's own variants. The shared file
in `~/.config/palate/` is read and written by every build on the machine, so a
team running multiple builds in a week diversifies across all of them.

## Manual override

A brief that says "build it like {recent client}" deliberately overrides this
- the operator is asking for the same pattern, knowingly. Skip the memory
check when the brief names an explicit direction.

## Schema versioning

The first field is implicitly `"version": "1"`; bump the schema by adding a
`version` field at the top of new entries and updating this doc. The skill
should be backwards-compatible to v1 entries.
