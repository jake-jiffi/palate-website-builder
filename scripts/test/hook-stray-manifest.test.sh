#!/usr/bin/env bash
# A stray build-manifest.json is not a Palate build.
#
# THE FAULT THIS PINS. Older recorders started a manifest on the first Write in any directory,
# so non-Palate repositories still carry one (some committed it). The recorder kept filing every
# write into it, including writes to files outside the repository, and the Stop hook read "files
# written, zero Palate calls" as an ungrounded build and printed the reconnect warning on every
# turn of unrelated work, in a Next.js app that had never seen Palate.
#
# THE LINE IT MUST NOT CROSS. A real Palate build that made zero library calls (MCP not
# connected) must still be labelled UNGROUNDED. So the test pins both directions: stray
# manifests go quiet, and a manifest with Palate evidence (a state file, an agent-filled block,
# a library call) is still recorded and still gated.
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"
MHOOK="$ROOT/hooks/palate-manifest.mjs"
SHOOK="$ROOT/hooks/palate-stop.mjs"
pass=0; fail=0
ok()  { echo "ok   - $1"; pass=$((pass+1)); }
bad() { echo "FAIL - $1"; fail=$((fail+1)); }
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

write() { # <cwd> <file_path>
  printf '{"hook_event_name":"PostToolUse","tool_name":"Write","tool_input":{"file_path":"%s"},"tool_response":{},"cwd":"%s"}' "$2" "$1" |
    CLAUDE_PLUGIN_ROOT="$ROOT" node "$MHOOK" >/dev/null 2>&1
}
palate_call() { # <cwd>
  printf '{"hook_event_name":"PostToolUse","tool_name":"mcp__palate__refs_search","tool_input":{"query":"bakery"},"tool_response":{"content":[{"type":"text","text":"{\\"results\\":[{\\"slug\\":\\"example-ref\\"}]}"}]},"cwd":"%s"}' "$1" |
    CLAUDE_PLUGIN_ROOT="$ROOT" node "$MHOOK" >/dev/null 2>&1
}
stop() { # <cwd>  -> everything the Stop hook said, on either channel
  printf '{"hook_event_name":"Stop","cwd":"%s","stop_hook_active":false}' "$1" |
    CLAUDE_PLUGIN_ROOT="$ROOT" node "$SHOOK" 2>&1
}
# A non-Palate app: package.json and src/app (no src/pages, so no project shape is detected),
# a git root, and a manifest an older recorder left behind: files written, nothing else.
app() { # <dir> -> creates it
  mkdir -p "$1/src/app"; echo '{}' > "$1/package.json"; git -C "$1" init -q
  printf '{"schema":3,"created_at":"2026-08-11T00:00:00.000Z","mcp_calls":[],"references_surveyed":[],"files_written":["%s/src/app/page.tsx"],"grounding":{"state":"ungrounded","mcp_calls":0}}\n' "$1" > "$1/build-manifest.json"
}

# 1. A write in the app does not touch the stray manifest.
A="$TMP/app"; app "$A"; before="$(cat "$A/build-manifest.json")"
write "$A" "$A/src/app/layout.tsx"
[ "$(cat "$A/build-manifest.json")" = "$before" ] && ok "a write leaves a stray manifest untouched" || bad "a write changed the stray manifest"

# 2. Nor does a write OUTSIDE the repository (the case that filed a memory note into a client repo).
write "$A" "$TMP/elsewhere/note.md"
[ "$(cat "$A/build-manifest.json")" = "$before" ] && ok "an outside write is not filed into it" || bad "an outside write was filed into the stray manifest"

# 3. The Stop hook says nothing about it.
out="$(stop "$A")"; rc=$?
[ "$rc" = "0" ] && [ -z "$out" ] && ok "Stop is silent on a stray manifest" || bad "Stop spoke on a stray manifest (exit $rc): $out"

# 4. Same from a subdirectory, where the manifest is found by walking up.
out="$(stop "$A/src/app")"
[ -z "$out" ] && ok "Stop is silent from a subdirectory too" || bad "Stop spoke from a subdirectory: $out"

# 5. The gates-off path must not stamp a stray manifest either.
printf '{"hook_event_name":"Stop","cwd":"%s","stop_hook_active":false}' "$A" | PALATE_GATE_OFF=1 CLAUDE_PLUGIN_ROOT="$ROOT" node "$SHOOK" >/dev/null 2>&1
[ "$(cat "$A/build-manifest.json")" = "$before" ] && ok "PALATE_GATE_OFF does not stamp a stray manifest" || bad "PALATE_GATE_OFF stamped a stray manifest"
printf '{"hook_event_name":"PreToolUse","tool_name":"Write","tool_input":{"file_path":"%s/src/app/x.tsx","content":"x"},"cwd":"%s"}' "$A" "$A" |
  PALATE_GATE_OFF=1 CLAUDE_PLUGIN_ROOT="$ROOT" node "$ROOT/hooks/palate-pretooluse.mjs" >/dev/null 2>&1
[ "$(cat "$A/build-manifest.json")" = "$before" ] && ok "PALATE_GATE_OFF on a write does not stamp it either" || bad "the PreToolUse gates-off path stamped a stray manifest"

# 6. A Palate call is evidence by itself: it is recorded, and later writes are recorded too.
B="$TMP/starts-palate"; app "$B"
palate_call "$B"
n="$(node -e 'const m=require(process.argv[1]);console.log((m.mcp_calls||[]).length)' "$B/build-manifest.json" 2>/dev/null)"
[ "$n" = "1" ] && ok "a Palate call in the same directory is recorded" || bad "a Palate call was not recorded (mcp_calls=$n)"
write "$B" "$B/src/app/new.tsx"
grep -qF "$B/src/app/new.tsx" "$B/build-manifest.json" && ok "after a Palate call, writes are recorded again" || bad "a write after a Palate call was not recorded"

# 7. UNGROUNDED survives: a real build with a Palate state file and zero calls is still gated.
C="$TMP/real-ungrounded"; app "$C"; echo '{"brandMode":"vendored"}' > "$C/.palate-skill-state.json"
write "$C" "$C/src/app/hero.tsx"
grep -qF "$C/src/app/hero.tsx" "$C/build-manifest.json" && ok "a build with a Palate state file is still recorded" || bad "a build with a Palate state file stopped recording"
out="$(stop "$C")"
printf '%s' "$out" | grep -qiE "ungrounded|zero palate mcp calls" && ok "a real zero-call build is still labelled UNGROUNDED" || bad "UNGROUNDED was swallowed for a real build: $out"

# 8. Same, when the evidence is a block the agent filled in rather than a file.
D="$TMP/agent-block"; app "$D"
node -e 'const f=process.argv[1],m=require(f);m.business="a bakery in Newtown";require("fs").writeFileSync(f,JSON.stringify(m))' "$D/build-manifest.json"
out="$(stop "$D")"
printf '%s' "$out" | grep -qiE "ungrounded|zero palate mcp calls" && ok "an agent-filled block keeps a zero-call build gated" || bad "an agent-filled block did not keep the build gated: $out"

echo "$pass passed, $fail failed"
[ "$fail" = "0" ]
