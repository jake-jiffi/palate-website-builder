#!/usr/bin/env bash
# add-reference-site.sh - file a site into the reference library (deep schema v2).
#
# Handles the MECHANICAL part: the catalog folder, the v2 notes stub files, the
# index.json matrix update, the refresh-schedule row. Claude then runs the
# capture engine (capture-reference-site.sh) and fills the notes from the
# resulting _capture/ data. See references/reference-library-curation.md.
#
# Safe to re-run for a refresh: existing notes files are NOT overwritten, only
# missing ones are stubbed.
#
# Usage: add-reference-site.sh <slug> <url> <style> <mode> [secondary-csv] [tier]
# Example: add-reference-site.sh vercel https://vercel.com product clean-corporate service flagship
set -euo pipefail
SLUG="${1:?site slug e.g. vercel}"
URL="${2:?site url}"
STYLE="${3:?style: product|service|story|operational|consumer|portfolio}"
MODE="${4:?mode: clean-corporate|motion-heavy-creative|minimal-portfolio}"
SECONDARY="${5:-}"
TIER="${6:-strong}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB="${JIFFI_REFERENCE_LIBRARY_PATH:-${SCRIPT_DIR}/../references/reference-library}"
INDEX="${LIB}/index.json"
DIR="${LIB}/catalog/${SLUG}"

[ -f "$INDEX" ] || { echo "no library index at ${INDEX}" >&2; exit 1; }

valid_styles="product service story operational consumer portfolio"
valid_modes="clean-corporate motion-heavy-creative minimal-portfolio"
valid_tiers="flagship strong niche"
echo "$valid_styles" | grep -qw "$STYLE" || { echo "invalid style: $STYLE" >&2; exit 1; }
echo "$valid_modes"  | grep -qw "$MODE"  || { echo "invalid mode: $MODE" >&2; exit 1; }
echo "$valid_tiers"  | grep -qw "$TIER"  || { echo "invalid tier: $TIER" >&2; exit 1; }

REFRESH=0
[ -d "$DIR" ] && REFRESH=1
mkdir -p "$DIR/_capture" "$DIR/assets/screenshots" "$DIR/assets/svg"

# stub() writes a file ONLY if it does not already exist (refresh-safe).
stub() { local f="$1"; shift; [ -f "$f" ] || cat > "$f"; }

stub "$DIR/overview.md" <<MD
# ${SLUG}

> Essence: <!-- one sentence: why this site is worth referencing -->

<!-- 2-3 paragraphs. The tier of craft this represents. What specifically to
reference it for (structure rhythm? motion intent? type system? restraint?).
Be concrete - a designer who has never seen ${URL} should understand its feel. -->

## Reference it for
<!-- bullet list of the transferable strengths -->

## Do not copy
<!-- what is strongly brand-coded to this site and would read as derivative -->
MD

stub "$DIR/tokens.json" <<MD
{
  "site": "${SLUG}",
  "schemaVersion": 2,
  "source": "${URL}",
  "color": {
    "palette": {},
    "roles": { "background": "", "surface": "", "text": "", "textMuted": "", "accent": "", "border": "" },
    "notes": ""
  },
  "typography": {
    "families": { "display": "", "body": "", "mono": "" },
    "scalePx": [],
    "weights": [],
    "tracking": "",
    "notes": ""
  },
  "space": { "scalePx": [], "sectionPaddingY": "", "notes": "" },
  "radius": { "scale": {}, "notes": "" },
  "shadow": { "scale": {}, "notes": "" },
  "layout": { "containerMaxWidth": "", "breakpoints": [], "grid": "" },
  "motion": { "easings": {}, "durations": {}, "notes": "" }
}
MD

stub "$DIR/typography.md" <<MD
# ${SLUG} typography

## Families
<!-- display / body / mono: names, foundry/source, why chosen -->

## Scale
<!-- the type scale in px or rem, the ratio, fluid clamp() where used -->

## Weights, tracking, line-height
## Loading strategy
## What to borrow / not borrow
MD

stub "$DIR/layout.md" <<MD
# ${SLUG} layout

## Container & grid
<!-- max-width, gutters, column system -->

## Breakpoints
## Section rhythm
<!-- vertical spacing between and within sections -->

## What to borrow / not borrow
MD

stub "$DIR/motion.md" <<MD
# ${SLUG} motion

## Signature
<!-- the one or two motions that define how this site feels -->

## Library / technique
<!-- GSAP, Lenis, Framer Motion, View Transitions, CSS-native, bespoke -->

## Interaction inventory
<!-- scroll reveals, hovers, page transitions, hero motion: each with
trigger, property, duration, easing -->

## What to borrow / not borrow
MD

stub "$DIR/motion.json" <<MD
{
  "site": "${SLUG}",
  "schemaVersion": 2,
  "stack": { "library": "", "smoothScroll": "", "notes": "" },
  "signatureEasings": {},
  "interactions": []
}
MD

stub "$DIR/components.md" <<MD
# ${SLUG} components

<!-- Anatomy of the key components. For each: structure, variants, states,
sizing, and the behaviour worth borrowing. -->

## Navigation
## Hero
## Buttons & links
## Cards
## Footer
## Forms / inputs
MD

stub "$DIR/structure-notes.md" <<MD
# ${SLUG} structure notes

## Homepage section rhythm
<!-- the ordered sequence of sections, each one line -->

## Inner pages
## The rhythm to borrow
## Anti-pattern to avoid when borrowing
MD

stub "$DIR/visual-system-notes.md" <<MD
# ${SLUG} visual system notes

## Grid & composition
## Hierarchy
## Imagery & texture
## Depth & effects
## What to borrow / not borrow
MD

stub "$DIR/voice-notes.md" <<MD
# ${SLUG} voice notes

<!-- Abstract patterns only. At most one quote under 15 words. -->

## Patterns
## When to borrow this voice / when not to
MD

stub "$DIR/astro-rebuild.md" <<MD
# ${SLUG} - rebuilding the patterns in Astro

<!-- The translation layer. How a Jiffi Astro build reproduces this site's
strengths on the Jiffi stack (Astro + Tailwind + the client brand package). -->

## Islands strategy
<!-- what is static .astro, what needs a client: directive and why -->

## Motion on the Jiffi stack
<!-- how to achieve the motion above with View Transitions / CSS / a small lib -->

## Layout & tokens
<!-- mapping the layout and tokens onto the Tailwind preset -->

## Recommended packages
## Pitfalls
MD

# tags.json - always (re)written; it is generated metadata, not authored notes.
sec_json="[]"
[ -n "$SECONDARY" ] && sec_json=$(printf '%s' "$SECONDARY" | jq -R 'split(",")')
cat > "$DIR/tags.json" <<MD
{
  "site": "${SLUG}",
  "url": "${URL}",
  "schemaVersion": 2,
  "style": "${STYLE}",
  "mode": "${MODE}",
  "secondary": ${sec_json},
  "tier": "${TIER}",
  "inspectedAt": "$(date -u +%Y-%m)"
}
MD
jq empty "$DIR/tags.json" || { echo "tags.json invalid" >&2; exit 1; }

# index.json - add to the matrix cell, move planned -> available.
# Overwrite in place via a captured variable: no mv/rm, because some sandboxed
# mounts block unlink on the target file. printf > file truncates in place.
INDEX_NEW=$(jq --arg slug "$SLUG" --arg style "$STYLE" --arg mode "$MODE" '
  .matrix[$style][$mode] = ((.matrix[$style][$mode] // []) + [$slug] | unique)
  | .available = ((.available + [$slug]) | unique)
  | .planned = (.planned - [$slug])
' "$INDEX") || { echo "index.json jq transform failed" >&2; exit 1; }
printf '%s\n' "$INDEX_NEW" > "$INDEX"
jq empty "$INDEX" || { echo "index.json corrupted" >&2; exit 1; }

# refresh schedule
SCHED="${LIB}/_meta/refresh-schedule.md"
if [ -f "$SCHED" ] && [ "$REFRESH" -eq 0 ]; then
  next=$(date -u -d "+3 months" +%Y-%m 2>/dev/null || date -u -v+3m +%Y-%m 2>/dev/null || echo "TBD")
  printf '| %s | %s | %s | Added via curator (v2) |\n' "$SLUG" "$(date -u +%Y-%m)" "$next" >> "$SCHED"
fi

if [ "$REFRESH" -eq 1 ]; then
  echo "RESCAFFOLDED:${SLUG} (refresh - existing notes preserved)"
else
  echo "SCAFFOLDED:${SLUG}"
fi
echo "  Next: capture-reference-site.sh ${SLUG} ${URL} ${DIR}   (desktop then responsive phase)"
echo "  Then fill the notes files in ${DIR} from ${DIR}/_capture/"
echo "  index.json updated: ${SLUG} -> matrix[${STYLE}][${MODE}], marked available"
