#!/usr/bin/env bash
# sync-reference-library.sh - clone or update the external reference library.
#
# The reference library (catalog + index.json + the curation queue) lives in a
# public GitHub repo, not in this skill, because a skill is capped at ~200 files.
# This script makes / updates a local clone and prints an `export` line so the
# rest of the skill can find it:
#
#   eval "$(scripts/sync-reference-library.sh)"
#   # -> JIFFI_REFERENCE_LIBRARY_PATH now points at the local clone
#
# After that, select-references.sh and add-reference-site.sh work unchanged.
#
# AUTH. Reading is anonymous (public repo). To PUSH new entries, set the
# JIFFI_GITHUB_TOKEN environment variable to a GitHub token with Contents:write
# on the repo; this script then configures the clone with an authenticated
# remote so `git -C <clone> push` works. The token is read from the environment
# only - it is NEVER written into the skill or committed. See library-source.json.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_JSON="${SCRIPT_DIR}/../references/reference-library/library-source.json"

[ -f "$SRC_JSON" ] || { echo "echo 'sync: library-source.json not found' >&2"; exit 1; }
REPO=$(jq -r '.repo' "$SRC_JSON" 2>/dev/null)
BRANCH=$(jq -r '.branch // "main"' "$SRC_JSON" 2>/dev/null)
RAW_CACHE=$(jq -r '.cacheDir // "~/.cache/jiffi-website-references"' "$SRC_JSON" 2>/dev/null)
CACHE="${JIFFI_LIBRARY_CACHE:-${RAW_CACHE/#\~/$HOME}}"

[ -n "$REPO" ] && [ "$REPO" != "null" ] || { echo "echo 'sync: no repo set in library-source.json' >&2"; exit 1; }

# Build the URL used for git operations. With a token, use an authenticated URL
# so pushes work; the token lives only in the environment and in this local
# clone's git config (inside the cache dir - never in the skill, never pushed).
CLONE_URL="$REPO"
if [ -n "${JIFFI_GITHUB_TOKEN:-}" ]; then
  CLONE_URL=$(printf '%s' "$REPO" | sed -E "s#^https://#https://x-access-token:${JIFFI_GITHUB_TOKEN}@#")
fi

if [ -d "$CACHE/.git" ]; then
  git -C "$CACHE" remote set-url origin "$CLONE_URL" 2>/dev/null || true
  git -C "$CACHE" pull --quiet --ff-only origin "$BRANCH" >&2 \
    || echo "[sync] pull failed - using the existing clone" >&2
else
  mkdir -p "$(dirname "$CACHE")"
  if ! git clone --quiet --branch "$BRANCH" "$CLONE_URL" "$CACHE" >&2; then
    echo "echo 'sync: git clone failed for ${REPO}' >&2"
    exit 1
  fi
fi

echo "export JIFFI_REFERENCE_LIBRARY_PATH='${CACHE}'"
echo "[sync] reference library ready at ${CACHE}" >&2
[ -n "${JIFFI_GITHUB_TOKEN:-}" ] && echo "[sync] push auth: enabled (JIFFI_GITHUB_TOKEN)" >&2 \
  || echo "[sync] push auth: read-only (set JIFFI_GITHUB_TOKEN to enable pushing)" >&2
