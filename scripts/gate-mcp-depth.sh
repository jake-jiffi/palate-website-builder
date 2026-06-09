#!/usr/bin/env bash
# scripts/gate-mcp-depth.sh - the portable MCP-depth gate.
#
# Reads build-manifest.json (real tool telemetry, not the agent's narration) and
# fails closed if the build did not actually draw on the library. This is the
# source of truth; the Pre/Stop hooks are thin wrappers that call it, and it runs
# anywhere (CI, pre-commit, Cursor) on its own.
#
# Exit 0 = pass, 2 = block (with a specific, actionable reason on stderr).
#
# Thresholds are overridable via env so thin verticals can be loosened later
# (ties to G1): PALATE_MIN_REFS, PALATE_MIN_INNER, PALATE_MIN_TOOLS.
set -euo pipefail

MANIFEST="${1:-build-manifest.json}"
MIN_REFS="${PALATE_MIN_REFS:-8}"
MIN_INNER="${PALATE_MIN_INNER:-3}"
MIN_TOOLS="${PALATE_MIN_TOOLS:-3}"

fail() { echo "MCP-depth gate FAILED: $1" >&2; exit 2; }

command -v jq >/dev/null 2>&1 || fail "jq is not installed (the gate needs it). Run scripts/install.sh or 'brew install jq'."
[ -f "$MANIFEST" ] || fail "no $MANIFEST - the build did no MCP research. Survey the library (refs_search across verticals, refs_get the donors) before writing code."

refs=$(jq '(.references_surveyed // []) | unique | length' "$MANIFEST")
inner=$(jq '(.inner_pages_viewed // []) | length' "$MANIFEST")
tools=$(jq '[(.mcp_calls // [])[].tool] | unique | length' "$MANIFEST")
deepread=$(jq '[(.mcp_calls // [])[] | select(.tool=="mcp__palate__refs_get")] | length' "$MANIFEST")

[ "$refs" -ge "$MIN_REFS" ] || fail "Narrow retrieval: $refs reference(s) surveyed, the gate needs $MIN_REFS. Run the palate-surveyor subagent, or call refs_search across more verticals."
[ "$deepread" -ge 1 ] || fail "Shallow read: no refs_get call. You looked at cards but never read a reference deeply. refs_get your backbone and donors."
[ "$inner" -ge "$MIN_INNER" ] || fail "Thin inner-page coverage: $inner inner page(s) viewed, the gate needs $MIN_INNER. refs_get_screenshot the pricing/menu/booking pages of your donors."
[ "$tools" -ge "$MIN_TOOLS" ] || fail "Narrow tool use: only $tools palate tool(s) used, the gate needs $MIN_TOOLS (e.g. refs_search + refs_get + refs_get_screenshot/refs_similar)."

# Soft check: if the agent declared a signature move, its source must have been fetched.
sigslug=$(jq -r '.signature_move.source_slug // empty' "$MANIFEST")
if [ -n "$sigslug" ]; then
  jq -e --arg s "$sigslug" '(.references_surveyed // []) | index($s)' "$MANIFEST" >/dev/null 2>&1 \
    || fail "Signature move source '$sigslug' was never fetched (not in references_surveyed). Fetch it before building on it."
fi

echo "MCP-depth gate passed: $refs refs surveyed, $inner inner page(s), $tools palate tool(s), $deepread deep read(s)."
exit 0
