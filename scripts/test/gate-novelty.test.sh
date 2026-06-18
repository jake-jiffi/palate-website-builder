#!/usr/bin/env bash
# Tests the novelty gate (scripts/gate-novelty.mjs): the CONVERGE concept pre-check
# (block a safe-only converge, pass a low-typicality advance, skip when DIVERGE is
# absent) and the build-level / type-face-recurrence check (skip <2 variants, block a
# display face that recurs across recent builds). All the "nothing to compare" cases
# SKIP (exit 0) - that is the fail-open invariant, never a trap.
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
GATE="$DIR/../gate-novelty.mjs"
pass=0; fail=0

check() { # desc  expected_exit  [args...]
  local desc="$1" want="$2"; shift 2
  node "$GATE" "$@" >/dev/null 2>&1
  local ec=$?
  if [ "$ec" -eq "$want" ]; then echo "ok   - $desc"; pass=$((pass+1));
  else echo "FAIL - $desc (exit $ec, want $want)"; fail=$((fail+1)); fi
}

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# --- CONCEPT pre-check: safe-only converge -> BLOCK (exit 2) -----------------
SAFE="$TMP/safe.json"
cat > "$SAFE" <<'JSON'
{ "schema": 3,
  "diverge": { "ran": true, "n": 6, "concepts": [
    { "id": "c1", "conventionality": 0.9 },
    { "id": "c2", "conventionality": 0.8 },
    { "id": "c3", "conventionality": 0.2 } ] },
  "converge": { "ran": true, "advanced": ["c1", "c2"] } }
JSON
check "safe-only converge -> block" 2 --manifest "$SAFE"

# --- CONCEPT pre-check: advanced the low-typicality tail -> PASS (exit 0) ----
BOLD="$TMP/bold.json"
cat > "$BOLD" <<'JSON'
{ "schema": 3,
  "diverge": { "ran": true, "n": 6, "concepts": [
    { "id": "c1", "conventionality": 0.9 },
    { "id": "c2", "conventionality": 0.2 },
    { "id": "c3", "conventionality": 0.15 } ] },
  "converge": { "ran": true, "advanced": ["c2", "c3"] } }
JSON
check "low-typicality advance -> pass" 0 --manifest "$BOLD"

# --- CONCEPT pre-check: no diverge block -> SKIP (fail-open, exit 0) ---------
NODIV="$TMP/nodiv.json"
echo '{ "schema": 3, "diverge": null, "converge": null }' > "$NODIV"
check "no diverge -> skip (fail-open)" 0 --manifest "$NODIV"

# --- CONCEPT pre-check: no manifest -> SKIP (fail-open, exit 0) --------------
check "no manifest -> skip (fail-open)" 0 --manifest "$TMP/no-such.json"

# --- BUILD-level: <2 variants -> SKIP (fail-open, exit 0) --------------------
printf '<html><body><h1>only one</h1></body></html>' > "$TMP/v1.html"
check "single variant -> skip (fail-open)" 0 --variants "$TMP/v1.html"

# --- BUILD-level: 2 distinct variants, no history -> PASS (exit 0) -----------
printf '<html><style>h1{font-family:"Fraunces",serif}</style><body><h1>a</h1></body></html>' > "$TMP/a.html"
printf '<html><style>h2{font-family:"Schibsted Grotesk",sans-serif}</style><body><h2>b</h2></body></html>' > "$TMP/b.html"
check "two variants, no history -> pass" 0 --variants "$TMP/a.html" "$TMP/b.html"

# --- BUILD-level: TYPE-FACE RECURRENCE across recent builds -> BLOCK (exit 2) -
# Seed a throwaway builds.log.json (HOME-relative) where one face appears in 3 recent
# builds, then run a build that uses that same face. Use a temp HOME so the real log
# is untouched.
FAKEHOME="$TMP/home"; mkdir -p "$FAKEHOME/.config/palate"
cat > "$FAKEHOME/.config/palate/builds.log.json" <<'JSON'
[ { "ts": "1", "business": "x1", "donors": ["a"], "faces": ["space grotesk"] },
  { "ts": "2", "business": "x2", "donors": ["b"], "faces": ["space grotesk"] },
  { "ts": "3", "business": "x3", "donors": ["c"], "faces": ["space grotesk"] } ]
JSON
printf '<html><style>h1{font-family:"Space Grotesk",sans-serif}</style><body><h1>a</h1></body></html>' > "$TMP/r1.html"
printf '<html><style>h2{font-family:"Space Grotesk",sans-serif}</style><body><h2>b</h2></body></html>' > "$TMP/r2.html"
HOME="$FAKEHOME" node "$GATE" --variants "$TMP/r1.html" "$TMP/r2.html" >/dev/null 2>&1
ec=$?
if [ "$ec" -eq 2 ]; then echo "ok   - recurring display face -> block"; pass=$((pass+1));
else echo "FAIL - recurring display face -> block (exit $ec, want 2)"; fail=$((fail+1)); fi

# --- BUILD-level: a DIFFERENT face vs the same history -> PASS (exit 0) -------
printf '<html><style>h1{font-family:"Fraunces",serif}</style><body><h1>a</h1></body></html>' > "$TMP/f1.html"
printf '<html><style>h2{font-family:"Canela",serif}</style><body><h2>b</h2></body></html>' > "$TMP/f2.html"
HOME="$FAKEHOME" node "$GATE" --variants "$TMP/f1.html" "$TMP/f2.html" >/dev/null 2>&1
ec=$?
if [ "$ec" -eq 0 ]; then echo "ok   - fresh face vs same history -> pass"; pass=$((pass+1));
else echo "FAIL - fresh face vs same history -> pass (exit $ec, want 0)"; fail=$((fail+1)); fi

echo "---"
echo "passed=$pass failed=$fail"
[ "$fail" -eq 0 ]
