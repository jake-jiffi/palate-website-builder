#!/usr/bin/env bash
# A FAILED CAPTURE EXITS NON-ZERO AND SAYS SO IN ITS OWN MANIFEST.
#
# THE FAULT THIS PINS. screenshot-build.mjs exited 0 on every path, including a browser that
# never launched, under a comment reading "never wedge a build over a screenshot". The caller
# therefore could not tell a capture from a crash, and the PNGs from the PREVIOUS run were still
# sitting in the output directory, so the done gate counted them and called the visual loop
# evidenced. A capture that did not happen must not be able to satisfy the shot-count test.
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
SHOOTER="$DIR/../reference-capture/screenshot-build.mjs"
pass=0; fail=0
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

# No browser is installed at that path, so chromium.launch throws before anything is captured.
# It is the launch branch on purpose: it needs no server and no browser, so this stays fast.
out="$(env PLAYWRIGHT_BROWSERS_PATH="$TMP/no-browsers" \
  node "$SHOOTER" --url "http://127.0.0.1:1/" --out "$TMP/shots" 2>&1)"; rc=$?

if [ "$rc" -eq 1 ]; then echo "ok   - a failed launch exits 1"; pass=$((pass+1));
else echo "FAIL - a failed launch exits 1 (got $rc)"; fail=$((fail+1)); fi

m="$TMP/shots/manifest.json"
if [ -f "$m" ] && grep -qF '"status": "failed"' "$m"; then
  echo "ok   - and the shots manifest records status failed"; pass=$((pass+1))
else
  echo "FAIL - and the shots manifest records status failed (got: $(cat "$m" 2>/dev/null | head -8))"; fail=$((fail+1))
fi
if [ -f "$m" ] && grep -qF '"error":' "$m"; then
  echo "ok   - and carries the reason"; pass=$((pass+1))
else
  echo "FAIL - and carries the reason"; fail=$((fail+1))
fi

echo "---"
echo "passed=$pass failed=$fail"
[ "$fail" -eq 0 ]
