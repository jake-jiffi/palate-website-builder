#!/usr/bin/env bash
# The Stop hook REPORTS what the gates said, on a build that passed.
#
# THE FAULT THIS PINS. Both gate calls ran with stdio ["ignore","ignore","pipe"], so on exit 0
# every word the gates printed was discarded: the done gate's summary line (which names each
# sub-gate and whether it ran) went to stdout and was thrown away, and a sub-gate that SKIPPED
# said so into the same void. A build where the ship-ready, SEO, uniqueness and Explore checks
# all skipped is then indistinguishable, in the transcript, from a build where every one of them
# ran and passed. That is the whole failure class this repo keeps paying for: a gate that was
# blocked reads exactly like a gate that passed.
#
# So: on a PASSING build the hook must forward the done gate's summary and any skip line.
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
HOOK="$DIR/../../hooks/palate-stop.mjs"
pass=0; fail=0

want() { # <desc> <haystack> <needle>
  if printf '%s' "$2" | grep -qF "$3"; then echo "ok   - $1"; pass=$((pass+1));
  else echo "FAIL - $1 (no '$3' in output)"; fail=$((fail+1)); fi
}

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

# A build the done gate PASSES: deep manifest (clears the depth floor), a screenshot on disk,
# a shots manifest with no console errors, and a verifier report with verdict pass.
T="$TMP/site"; mkdir -p "$T/.palate-shots"
cp "$DIR/fixtures/manifest-deep.json" "$T/build-manifest.json"
printf '\x89PNG\r\n\x1a\n' > "$T/.palate-shots/desktop-full.png"
printf '{"status":"captured","console_errors":0,"shots":{"desktop_full":"desktop-full.png"}}' \
  > "$T/.palate-shots/manifest.json"
cat > "$T/verify-report.json" <<'JSON'
{ "verdict": "pass",
  "visual": { "ran": true, "pass": true, "console_errors": 0,
    "iterations": [ { "i": 1, "axes": { "philosophy": 5, "hierarchy": 4, "execution": 4, "specificity": 4, "restraint": 4, "variety": 4 }, "score": 25,
      "shots": { "desktop_full": ".palate-shots/desktop-full.png" } } ] },
  "shots_dir": ".palate-shots" }
JSON

out="$(cd "$T" && printf '{"hook_event_name":"Stop","cwd":"%s"}' "$T" | node "$HOOK" 2>&1 >/dev/null)"

want "the done gate's summary reaches the user on a pass" "$out" "Done gate"
want "and the sub-gates that skipped are named"           "$out" "skipped("

echo "---"
echo "passed=$pass failed=$fail"
[ "$fail" -eq 0 ]
