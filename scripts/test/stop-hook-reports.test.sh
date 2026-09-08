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
# AND STDERR IS NOT WHERE THE OPERATOR LOOKS. The Claude Code hooks reference is explicit:
# "Stderr from a hook that exits 0 goes to the debug log only, never the transcript, and Claude
# never sees it." The documented channel is `systemMessage` in a JSON object on stdout, which
# for a Stop hook with `continue` unset is "shown to the user in the transcript instead". So the
# summary must travel there, and the stderr copy stays for `--debug`.
#
# So: on a PASSING build the hook must forward the done gate's summary and any skip line, on
# both channels.
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

# HOME is redirected so the suite does not append to the real cross-build log.
run_hook() { # -> stdout on fd 1, stderr captured into $err_file
  (cd "$T" && printf '{"hook_event_name":"Stop","cwd":"%s"}' "$T" \
    | env HOME="$TMP/home" node "$HOOK" 2>"$TMP/stderr")
}
mkdir -p "$TMP/home"
sout="$(run_hook)"
serr="$(cat "$TMP/stderr")"

want "the done gate's summary reaches the debug log on a pass" "$serr" "Done gate"
want "and the sub-gates that skipped are named there"          "$serr" "skipped("

# STDOUT MUST BE ONE VALID JSON OBJECT AND NOTHING ELSE. A parse failure here is not cosmetic:
# the hook protocol reads this stream, so trailing text would break the hook itself.
msg="$(printf '%s' "$sout" | node -e '
let raw = ""; process.stdin.on("data", (d) => (raw += d)).on("end", () => {
  try { const o = JSON.parse(raw); console.log(typeof o.systemMessage === "string" ? o.systemMessage : ""); }
  catch { console.log("__NOT_JSON__"); }
});' 2>/dev/null)"

if [ "$msg" = "__NOT_JSON__" ]; then
  echo "FAIL - stdout is one valid JSON object (got: $sout)"; fail=$((fail+1))
else
  echo "ok   - stdout is one valid JSON object"; pass=$((pass+1))
fi
want "the summary reaches the USER through systemMessage" "$msg" "Done gate"
want "and the skips travel with it"                       "$msg" "skipped("

echo "---"
echo "passed=$pass failed=$fail"
[ "$fail" -eq 0 ]
