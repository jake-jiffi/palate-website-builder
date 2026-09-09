#!/usr/bin/env bash
# Run every test in the repo. There was no runner before this, so suites only ran
# when somebody remembered which ones existed, and a new suite could sit green-by-
# absence for weeks.
#
# Usage: scripts/test/run.sh [--fast]
#   --fast  skip the browser-driven and build-driven suites, which need Playwright or an npm
#           install and take minutes. template-csp-live, board-components, boards-render,
#           explore-page-boards and gate-fidelity all install and build the template, which is
#           the only honest way to prove a policy, a render or a fidelity comparison.
#
# THE SLOW LIST COVERS BOTH LOOPS. It used to be consulted only for the shell suites, so a
# browser suite written as a .test.mjs ran under --fast whatever the list said.
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
FAST=0; for a in "$@"; do [ "$a" = "--fast" ] && FAST=1; done
SLOW="hygiene-loop verify-rendered-a11y template-csp-live board-components boards-render explore-page-boards gate-fidelity"
pass=0; fail=0; skipped=0; failed_names=""

is_slow() { # <suite-name>; true when --fast should skip it
  [ "$FAST" = "1" ] || return 1
  case " $SLOW " in *" $1 "*) return 0 ;; esac
  return 1
}

run() { # label  command...
  local label="$1"; shift
  if out="$("$@" 2>&1)"; then
    printf '  %-34s PASS\n' "$label"; pass=$((pass+1))
  else
    printf '  %-34s *** FAIL ***\n' "$label"; fail=$((fail+1)); failed_names="$failed_names $label"
    printf '%s\n' "$out" | tail -6 | sed 's/^/      /'
  fi
}

echo "shell suites"
for t in "$DIR"/*.test.sh; do
  [ -e "$t" ] || continue
  n="$(basename "$t" .test.sh)"
  is_slow "$n" && { printf '  %-34s skipped (--fast)\n' "$n"; skipped=$((skipped+1)); continue; }
  run "$n" bash "$t"
done

echo "node suites"
for t in "$DIR"/*.test.mjs; do
  [ -e "$t" ] || continue
  n="$(basename "$t" .test.mjs)"
  is_slow "$n" && { printf '  %-34s skipped (--fast)\n' "$n"; skipped=$((skipped+1)); continue; }
  run "$n" node --test "$t"
done

echo "---"
echo "passed=$pass failed=$fail skipped=$skipped"
[ "$fail" -eq 0 ] || { echo "failed:$failed_names"; exit 1; }
