#!/usr/bin/env bash
# Tests the staging size guard that /publish runs before it commits.
#
# An adoption run staged 874 MB of screenshots and nothing stood between it and the client's
# repo. Ignores are the first defence and they only cover paths somebody thought of; this is
# the second, and it works on size alone, so a directory nobody predicted still gets caught.
#
# The two limits are deliberately different: one enormous file is usually a mistaken asset,
# and a directory that has quietly grown past 50 MB is the leak this exists for.
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
GUARD="$DIR/../palate-stage-guard.sh"
pass=0; fail=0
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
ok()  { echo "ok   - $1"; pass=$((pass+1)); }
bad() { echo "FAIL - $1"; fail=$((fail+1)); }
is()  { if [ "$2" = "$3" ]; then ok "$1"; else bad "$1 (got '$2', want '$3')"; fi }

newrepo() { # <name> -> path
  local r="$TMP/$1"; mkdir -p "$r"; git -C "$r" init -q 2>/dev/null
  git -C "$r" config user.email t@example.com; git -C "$r" config user.name T
  echo "$r"
}
mb() { dd if=/dev/zero of="$1" bs=1048576 count="$2" >/dev/null 2>&1; }

# ============ 1. A CLEAN STAGE passes and says what it measured ===========================
R="$(newrepo clean)"
mkdir -p "$R/src/pages"; printf 'hello\n' > "$R/src/pages/index.astro"
git -C "$R" add -A
out="$(bash "$GUARD" "$R" 2>&1)"; rc=$?
is "a clean stage exits 0" "$rc" "0"
printf '%s' "$out" | grep -qi "1 staged file" && ok "and says how much it inspected" \
  || bad "a passing guard that does not say what it inspected (got: $out)"

# ============ 2. ONE ENORMOUS FILE is refused, by name ====================================
R2="$(newrepo bigfile)"
mkdir -p "$R2/public"; mb "$R2/public/hero.mov" 6; printf 'x\n' > "$R2/index.html"
git -C "$R2" add -A
out="$(bash "$GUARD" "$R2" 2>&1)"; rc=$?
is "a 6 MB staged file exits 1" "$rc" "1"
printf '%s' "$out" | grep -q "public/hero.mov" && ok "and the guard names the file" \
  || bad "the guard refused without naming the file (got: $out)"
printf '%s' "$out" | grep -qi "index.html" && bad "it also named a file that is fine" \
  || ok "and does not name the file that is fine"

# ============ 3. A DIRECTORY over the limit is refused even though no single file is ======
# The real leak: 249 screenshots, none of them individually remarkable.
R3="$(newrepo bigdir)"
mkdir -p "$R3/.palate/adoption"
for i in $(seq 1 11); do mb "$R3/.palate/adoption/shot-$i.png" 5; done
git -C "$R3" add -f .palate/adoption >/dev/null 2>&1
out="$(bash "$GUARD" "$R3" 2>&1)"; rc=$?
is "55 MB of small files exits 1" "$rc" "1"
printf '%s' "$out" | grep -q ".palate/adoption" && ok "and the guard names the directory" \
  || bad "the guard refused without naming the directory (got: $out)"

# ============ 4. THE LIMITS ARE TUNABLE, and the override is honoured =====================
R4="$(newrepo tuned)"
mb "$R4/photo.jpg" 2
git -C "$R4" add -A
rc=0; bash "$GUARD" "$R4" >/dev/null 2>&1 || rc=$?
is "2 MB passes the default 5 MB file limit" "$rc" "0"
rc=0; PALATE_MAX_STAGED_FILE_MB=1 bash "$GUARD" "$R4" >/dev/null 2>&1 || rc=$?
is "and is refused at a 1 MB limit" "$rc" "1"

# ============ 5. A GATE NEVER EXITS 0 HAVING INSPECTED NOTHING ============================
R5="$(newrepo empty)"
out="$(bash "$GUARD" "$R5" 2>&1)"; rc=$?
is "nothing staged skips with exit 2" "$rc" "2"
printf '%s' "$out" | grep -qi "staged" && ok "and says why it inspected nothing" \
  || bad "it skipped without a reason (got: $out)"

N="$TMP/norepo"; mkdir -p "$N"
out="$(bash "$GUARD" "$N" 2>&1)"; rc=$?
is "no git repo skips with exit 2" "$rc" "2"
printf '%s' "$out" | grep -qi "git" && ok "and says it is not a repo" \
  || bad "it skipped without a reason (got: $out)"

# ============ 6. A STAGED DELETION is not a size, and must not break the guard ============
R6="$(newrepo deletion)"
printf 'x\n' > "$R6/gone.txt"; git -C "$R6" add -A; git -C "$R6" commit -qm one
git -C "$R6" rm -q gone.txt
out="$(bash "$GUARD" "$R6" 2>&1)"; rc=$?
is "a staged deletion alone skips rather than passing on nothing" "$rc" "2"

echo "---"
echo "passed=$pass failed=$fail"
[ "$fail" -eq 0 ]
