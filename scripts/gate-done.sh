#!/usr/bin/env bash
# scripts/gate-done.sh - the "done" gate. Makes "done" machine-checkable from
# EVIDENCE, not narration.
#
# A build is only DONE when the real artefacts prove it: the visual loop ran and
# passed (screenshots exist on disk, zero console errors, every rubric axis cleared
# the bar), the fresh-context palate-verifier ran and returned verdict:pass, and (when
# applicable) the novelty gate passed. It reads the ARTEFACTS directly
# (verify-report.json, .palate-shots/*) - never a manifest boolean an LLM could have
# set. That is the whole point: anti-reward-hacking.
#
# Exit 0 = pass OR skip, 2 = block (with a specific reason on stderr). Like
# gate-mcp-depth.sh this script only DECIDES; whether a block is ENFORCED is up to the
# caller. The Stop hook nudges by default and only hard-blocks under
# PALATE_GATE_STRICT=1; PALATE_GATE_OFF=1 disables it entirely.
#
# KEEP THE FLOOR: it runs gate-mcp-depth.sh first, unchanged, and fails if depth fails.
#
# KEEP FAIL-OPEN (the non-negotiable invariant): it can only BLOCK when it could
# actually run - i.e. when the MCP is connected (>=1 mcp_call, same ladder as the
# depth gate) AND a renderable preview exists (dist/ built OR verify-report.json
# present). Absent either, it SKIPS (exit 0). A public-plugin user whose token is not
# set, who is editing an existing app, or whose preview cannot render is NEVER trapped.
set -euo pipefail

MANIFEST="${1:-build-manifest.json}"
HERE="$(cd "$(dirname "$0")" && pwd)"
DEPTH_GATE="$HERE/gate-mcp-depth.sh"
NOVELTY_GATE="$HERE/gate-novelty.mjs"   # Move 1 (may not exist yet; treated fail-open)

# The project dir is the directory holding the manifest, so artefacts resolve next to it.
PROJ="$(cd "$(dirname "$MANIFEST")" 2>/dev/null && pwd || echo .)"
REPORT="$PROJ/verify-report.json"
SHOTS_DIR="$PROJ/.palate-shots"
SHOTS_MANIFEST="$SHOTS_DIR/manifest.json"
SHOTS_ERRORS="$SHOTS_DIR/errors.json"

fail() { echo "Done gate FAILED: $1" >&2; exit 2; }
skip() { echo "Done gate skipped: $1"; exit 0; }

# --- FAIL-OPEN LADDER (mirrors gate-mcp-depth.sh:32-35, plus one render rung) ---
# Never block closed when there is nothing to gate.
command -v jq >/dev/null 2>&1 || skip "jq is not installed; not gating done."
[ -f "$MANIFEST" ] || skip "no $MANIFEST (no tracked build, or the Palate MCP is not in use)."

mcpcalls=$(jq '((.mcp_calls // []) | length)' "$MANIFEST" 2>/dev/null || echo 0)
[ "${mcpcalls:-0}" -ge 1 ] || skip "no Palate MCP calls recorded (MCP not connected, or surveyed in a subagent); cannot gate done."

# NEW rung beyond the depth gate: a render must be possible for visual/verifier to
# mean anything. If neither a built dist/ nor a verify-report.json exists, the gate
# could not have run, so it SKIPS rather than blocks (render impossible != failure).
[ -d "$PROJ/dist" ] || [ -f "$REPORT" ] \
  || skip "no renderable preview (no dist/ and no verify-report.json); cannot judge visual/verifier."

# --- KEEP THE FLOOR: the MCP-depth gate runs first and must pass ---------------
# Capture its stderr so a depth failure surfaces the real reason through this gate.
if ! depth_err="$(bash "$DEPTH_GATE" "$MANIFEST" 2>&1 1>/dev/null)"; then
  fail "MCP-depth gate did not pass. ${depth_err}"
fi

# --- EVIDENCE 1: the VISUAL LOOP ran AND passed (read the artefacts) -----------
# Read verify-report.json (computed by the verifier from real pixels), NOT a manifest
# boolean. The render itself is double-checked against the on-disk screenshots and the
# screenshot driver's own console-error count.
[ -f "$REPORT" ] || fail "Visual loop did not run: no verify-report.json. Spawn palate-verifier (fresh context) to run the visual loop and write the report before calling the build done."

# verify-report.json must be valid JSON.
jq -e . "$REPORT" >/dev/null 2>&1 || fail "verify-report.json is not valid JSON; the verifier did not complete a clean run."

vran=$(jq -r '(.visual.ran // false)' "$REPORT")
vpass=$(jq -r '(.visual.pass // false)' "$REPORT")
verr_report=$(jq -r '(.visual.console_errors // 0)' "$REPORT")

[ "$vran" = "true" ] || fail "Visual loop did not run (.visual.ran is not true in verify-report.json)."

# EVIDENCE not assertion: a screenshot must exist ON DISK. A report claiming visual
# pass with no captured PNG is rejected (the verifier may not pass without real pixels).
shot_count=$(find "$SHOTS_DIR" -maxdepth 2 -type f -name '*.png' 2>/dev/null | wc -l | tr -d ' ')
[ "${shot_count:-0}" -ge 1 ] || fail "Visual loop has no screenshot evidence: no PNG under $SHOTS_DIR. The verifier must capture and read real pixels (scripts/reference-capture/screenshot-build.mjs) before visual can pass."

# Console errors are an automatic visual fail. Prefer the screenshot driver's own
# count (the live truth off the running page) over the report's recorded number.
console_errors="$verr_report"
if [ -f "$SHOTS_MANIFEST" ]; then
  sc=$(jq -r '(.console_errors // 0)' "$SHOTS_MANIFEST" 2>/dev/null || echo 0)
  console_errors="${sc:-$verr_report}"
fi
[ "${console_errors:-0}" -eq 0 ] || fail "Visual loop has $console_errors console error(s) on the rendered page (see $SHOTS_ERRORS). A thrown build cannot pass; fix the runtime error and re-render."

[ "$vpass" = "true" ] || fail "Visual loop did not pass: verify-report.json .visual.pass is not true. An axis fell below the bar or a defect was found - revise the named section, re-render, and re-verify (cap 2-3 iterations then escalate)."

# --- EVIDENCE 2: the VERIFIER ran AND passed -----------------------------------
verdict=$(jq -r '(.verdict // "fail")' "$REPORT")
[ "$verdict" = "pass" ] || fail "Verifier verdict is '$verdict' (not pass). Fix the named gate findings in verify-report.json and re-run the fresh-context palate-verifier."

# --- EVIDENCE 3 (NOVELTY): Move 1 is wired - gate-novelty.mjs now exists ---------
# The DIVERGE/CONVERGE spine + scripts/gate-novelty.mjs (Move 1) are live, so novelty
# is required by DEFAULT (PALATE_GATE_NOVELTY defaults to 1). gate-novelty.mjs is
# itself fully FAIL-OPEN: its CONVERGE pre-check skips (exit 0) when DIVERGE did not
# run, and its build-level / type-face-recurrence check skips (exit 0) with <2 rendered
# variants or no build history. So it can only BLOCK on a real novelty failure (a
# safe-only converge, a near-repeat build, or a recurring display face) and never traps
# a build that has nothing to compare. Set PALATE_GATE_NOVELTY=0 to disable it entirely.
REQUIRE_NOVELTY="${PALATE_GATE_NOVELTY:-1}"
novelty_note="novelty=off(PALATE_GATE_NOVELTY=0)"
if [ "$REQUIRE_NOVELTY" = "1" ] && [ -f "$NOVELTY_GATE" ]; then
  if novelty_err="$(node "$NOVELTY_GATE" --manifest "$MANIFEST" 2>&1 1>/dev/null)"; then
    # gate-novelty prints "passed:" on a real pass and "skipped:" when nothing to
    # compare; both exit 0. Reflect which one happened in the summary.
    novelty_note="novelty=pass-or-skip"
  else
    fail "Novelty gate did not pass. ${novelty_err}"
  fi
elif [ ! -f "$NOVELTY_GATE" ]; then
  novelty_note="novelty=skipped(gate-novelty.mjs not present)"
fi

echo "Done gate passed: visual=pass (0 console errors, $shot_count shot(s)), verifier=pass, $novelty_note."
exit 0
