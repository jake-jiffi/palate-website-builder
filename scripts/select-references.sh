#!/usr/bin/env bash
# Select 2-3 reference sites for design inspiration.
# Reads the reference library baked into this skill (references/reference-library/),
# no network, no clone. The library grows via the curator workflow (see
# references/reference-library-curation.md); adding sites makes this skill better.
#
# Three modes:
#   indirect:  select-references.sh --style product --mode motion-heavy-creative
#   direct:    select-references.sh --site linear
#   principle: select-references.sh --principle hierarchy-through-scale-contrast
#              (filters by the per-entry principle tags in tags.json / index.json)
set -euo pipefail

# Resolve the library relative to this script's location, so it works wherever
# the skill is installed. Allow an override for unusual layouts.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB="${JIFFI_REFERENCE_LIBRARY_PATH:-${SCRIPT_DIR}/../references/reference-library}"
INDEX="${LIB}/index.json"

[ -f "$INDEX" ] || { echo "no reference library at ${LIB}; proceeding without inspiration" >&2; exit 0; }

available() { jq -r '.available[]' "$INDEX"; }
is_available() { available | grep -qx "$1"; }

# Parse args
MODE=""; STYLE=""; SITE=""; PRINCIPLE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --site)      SITE="$2"; shift 2;;
    --style)     STYLE="$2"; shift 2;;
    --mode)      MODE="$2"; shift 2;;
    --principle) PRINCIPLE="$2"; shift 2;;
    *) shift;;
  esac
done

# Direct path: a named site
if [ -n "$SITE" ]; then
  if is_available "$SITE"; then
    echo "$SITE"
    exit 0
  fi
  echo "requested site '$SITE' not in library; falling back to inference" >&2
fi

# Principle path: filter by principle tag. Reads index.json's `principleIndex`
# map first (fast path); falls back to scanning per-site tags.json. Returns
# up to 3 available matches.
if [ -n "$PRINCIPLE" ]; then
  result=()
  # Fast path: principleIndex in index.json
  matches=$(jq -r --arg p "$PRINCIPLE" '.principleIndex[$p][]?' "$INDEX" 2>/dev/null || true)
  while IFS= read -r site; do
    [ -n "$site" ] && is_available "$site" && result+=("$site")
  done <<< "$matches"
  # Fallback: walk catalog tags.json files
  if [ ${#result[@]} -eq 0 ]; then
    while IFS= read -r tagfile; do
      site=$(basename "$(dirname "$tagfile")")
      is_available "$site" || continue
      if jq -e --arg p "$PRINCIPLE" '.principle // [] | index($p)' "$tagfile" >/dev/null 2>&1; then
        result+=("$site")
      fi
    done < <(find "${LIB}/catalog" -name tags.json -type f 2>/dev/null)
  fi
  if [ ${#result[@]} -gt 0 ]; then
    printf '%s\n' "${result[@]}" | head -n 3
    exit 0
  fi
  echo "no entries match principle '$PRINCIPLE'; falling back to inference" >&2
fi

# Indirect path: style x mode
if [ -n "$STYLE" ] && [ -n "$MODE" ]; then
  matches=$(jq -r --arg s "$STYLE" --arg m "$MODE" '.matrix[$s][$m][]?' "$INDEX" 2>/dev/null || true)
  result=()
  while IFS= read -r site; do
    [ -n "$site" ] && is_available "$site" && result+=("$site")
  done <<< "$matches"
  # Fall back to any available site in the style if the exact cell is empty
  if [ ${#result[@]} -eq 0 ]; then
    allmodes=$(jq -r --arg s "$STYLE" '.matrix[$s] | to_entries[] | .value[]?' "$INDEX" 2>/dev/null || true)
    while IFS= read -r site; do
      [ -n "$site" ] && is_available "$site" && result+=("$site")
    done <<< "$allmodes"
  fi
  printf '%s\n' "${result[@]}" | head -n 3
  exit 0
fi

echo "provide --site, or --style and --mode" >&2
exit 1
