#!/usr/bin/env bash
# PALATE_GATE_OFF=1 is RECORDED, never silent.
#
# THE FAULT THIS PINS. Both hooks read the variable as their very first act and exited before
# touching anything, so a build run with every gate disabled left no trace at all. Weeks later
# the manifest, the check report and the local grade all read exactly like a build that had been
# gated and passed. The bypass is legitimate and stays; it just has to be on the record.
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
STOP="$DIR/../../hooks/palate-stop.mjs"
PRE="$DIR/../../hooks/palate-pretooluse.mjs"
pass=0; fail=0

want() { # <desc> <file> <needle>
  if [ -f "$2" ] && grep -qF "$3" "$2"; then echo "ok   - $1"; pass=$((pass+1));
  else echo "FAIL - $1 (no '$3' in $2)"; fail=$((fail+1)); fi
}

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

# --- the Stop hook ------------------------------------------------------------------
S="$TMP/stop"; mkdir -p "$S"
cp "$DIR/fixtures/manifest-deep.json" "$S/build-manifest.json"
printf '{"hook_event_name":"Stop","cwd":"%s"}' "$S" \
  | env PALATE_GATE_OFF=1 node "$STOP" >/dev/null 2>&1
want "the Stop hook records gates-off in the manifest" "$S/build-manifest.json" '"state": "off"'
want "and stamps when"                                 "$S/build-manifest.json" '"at":'

# --- the PreToolUse hook ------------------------------------------------------------
W="$TMP/write"; mkdir -p "$W/src/pages"
cp "$DIR/fixtures/manifest-deep.json" "$W/build-manifest.json"
printf '{"hook_event_name":"PreToolUse","cwd":"%s","tool_name":"Write","tool_input":{"file_path":"%s"}}' \
  "$W" "$W/src/pages/index.astro" \
  | env PALATE_GATE_OFF=1 node "$PRE" >/dev/null 2>&1
want "the PreToolUse hook records gates-off in the manifest" "$W/build-manifest.json" '"state": "off"'

# --- and it travels to the cross-build log entry -------------------------------------
entry="$(node -e '
import("'"$DIR"'/../../hooks/build-log-entry.mjs").then((m) => {
  const e = m.buildLogEntry({ gates: { state: "off", at: "2026-09-09T00:00:00.000Z" } }, []);
  console.log(JSON.stringify(e));
});
')"
if printf '%s' "$entry" | grep -qF '"gates_off":true'; then
  echo "ok   - the build log entry carries gates_off"; pass=$((pass+1))
else
  echo "FAIL - the build log entry carries gates_off (got: $entry)"; fail=$((fail+1))
fi

# A gated build must NOT carry the flag, or the field means nothing.
entry2="$(node -e '
import("'"$DIR"'/../../hooks/build-log-entry.mjs").then((m) => {
  console.log(JSON.stringify(m.buildLogEntry({}, [])));
});
')"
if printf '%s' "$entry2" | grep -qF 'gates_off'; then
  echo "FAIL - a gated build must not carry gates_off (got: $entry2)"; fail=$((fail+1))
else
  echo "ok   - a gated build carries no gates_off"; pass=$((pass+1))
fi

echo "---"
echo "passed=$pass failed=$fail"
[ "$fail" -eq 0 ]
