#!/usr/bin/env bash
# The docs may not promise what the code does not do.
#
# Every claim below was in the doctrine and false: "Lighthouse 100 is the baseline" with no
# Lighthouse anywhere in the plugin, a post-deploy form round-trip test that nothing runs, a
# WCAG 2.2 AA promise over eleven axe rules, a route cap no customer-facing page mentioned,
# and a hygiene line that led with the number rather than with what the number is.
#
# HOW TO ADD A CASE. `absent <desc> <file> <string>` and `present <desc> <file> <string>` take
# a path relative to the repo root and a literal string. Add the pair when you delete a claim
# and when you land the thing that makes a claim true again, so the doc and the code can only
# drift with a red test in between.
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$DIR/../.."
pass=0; fail=0
ok()  { echo "ok   - $1"; pass=$((pass+1)); }
bad() { echo "FAIL - $1"; fail=$((fail+1)); }

# `--` before the pattern: a string starting with a dash (`--max-routes`) is otherwise read
# as a grep option, and the check dies instead of failing.
absent() { # <desc> <file> <literal string that must NOT appear>
  local f="$ROOT/$2"
  [ -f "$f" ] || { bad "$1 ($2 does not exist, so nothing was checked)"; return; }
  grep -qF -- "$3" "$f" && bad "$1 ($2 still says '$3')" || ok "$1"
}
present() { # <desc> <file> <literal string that MUST appear>
  local f="$ROOT/$2"
  [ -f "$f" ] || { bad "$1 ($2 does not exist, so nothing was checked)"; return; }
  grep -qF -- "$3" "$f" && ok "$1" || bad "$1 ($2 does not say '$3')"
}

# ============ 1. LIGHTHOUSE. Nothing in this plugin runs it. =============================
absent "testing.md does not promise a Lighthouse baseline" \
  "references/testing.md" "Lighthouse CI (baseline 100s"
absent "connective-tissue.md does not promise a Lighthouse baseline" \
  "references/connective-tissue.md" "Lighthouse 100 is the baseline"
# What IS measured, named as what it is: a throttled lab run of the vitals, on one route.
present "testing.md says what performance IS measured" \
  "references/testing.md" "vitals.mjs"

# ============ 2. THE FORM ROUND-TRIP, promised as the most important post-deploy check ====
# Nothing submits the form. The section says so plainly until E5 lands the real test.
absent "testing.md does not call an unrun test the most important post-deploy check" \
  "references/testing.md" "The most important post-deploy check: submit the contact form"
present "testing.md names the form round-trip as not yet implemented" \
  "references/testing.md" "Implemented by E5"
# ...and the smoke-check list two lines above must not promise the same test as done. The
# file argued with itself about the exact claim this guard exists to remove.
absent "the smoke-check list does not promise the POST either" \
  "references/testing.md" "a test POST to /api/contact"

# ============ 3. THE AXE SUBSET is a subset, and says which rules =========================
present "audit-dimensions.md says the automated pass is a subset" \
  "references/audit-dimensions.md" "eleven axe rules"
present "audit-dimensions.md names a rule the automated pass does NOT run" \
  "references/audit-dimensions.md" "aria-"

# ============ 4. THE ROUTE CAP, where a customer will see it ==============================
for f in README.md references/testing.md; do
  present "$f documents the 14-route default" "$f" "14 routes"
  present "$f documents --max-routes" "$f" "--max-routes"
done

# ============ 5. THE CSP DOC MUST NOT ARGUE WITH THE POLICY IT DESCRIBES =================
# Both files said 'unsafe-inline' must never reach script-src, in the files where it does. A
# reader who trusted that removed the token and broke the contact form, which is the failure
# the live CSP test exists to catch.
for f in references/hosting-vercel.md templates/host-cloudflare/_headers; do
  absent "$f does not forbid what its own policy does" "$f" "must never reach"
  present "$f says the policy is a host allowlist" "$f" "host allowlist"
done

# ============ 7. INCREMENTAL RE-VERIFY, where the person re-running it will look ==========
# A gate that renders only the blast radius is a promise about what was NOT checked, so the
# escape hatch has to be documented in the same breath as the saving. Both halves are pinned:
# the flag that narrows, and the flag that stops narrowing before hand-over.
for f in README.md references/testing.md; do
  present "$f documents --changed" "$f" "--changed"
  present "$f documents the full sweep before hand-over" "$f" "--full"
  present "$f says an unknown file falls wide" "$f" "falls wide"
done
present "the verifier agent re-runs the blast radius after a fix" \
  "agents/palate-verifier.md" "--changed <the files you edited>"
present "the verifier agent rebuilds the index under --changed" \
  "agents/palate-verifier.md" "rebuilds \`.palate/index.json\` first"
present "testing.md says --changed rebuilds the index" \
  "references/testing.md" "rebuilds \`.palate/index.json\` first"
present "testing.md says the content a route renders is in the hash" \
  "references/testing.md" "the collection its \`getCollection\` call names"
# THE DOCTRINE'S FIRST COMMAND IS RUN, not just matched. It named a file list, and ux-lint
# takes a project directory and nothing else, so the cheap lane the re-run rule leads with
# exited 2 for anyone who followed it literally: a gate that did not run, reading as one that
# did. Pinning the sentence alone is what let that ship, so the sentence is executed.
present "the verifier agent lints the project directory, not a file list" \
  "agents/palate-verifier.md" "bash scripts/ux-lint.sh <project-dir>"
UXSITE="$(mktemp -d)"
mkdir -p "$UXSITE/src/pages"
printf '<h1>Hello</h1>\n' > "$UXSITE/src/pages/index.astro"
bash "$ROOT/scripts/ux-lint.sh" "$UXSITE" >/dev/null 2>&1; ux_dir=$?
bash "$ROOT/scripts/ux-lint.sh" "$UXSITE/src/pages/index.astro" >/dev/null 2>&1; ux_file=$?
rm -rf "$UXSITE"
[ "$ux_dir" -ne 2 ] && ok "the doctrine's ux-lint command runs (exit $ux_dir, not 2)" \
  || bad "the doctrine's ux-lint command exits 2, so the cheap lane never runs"
[ "$ux_file" -eq 2 ] && ok "a file path still exits 2, which is why the doctrine names a directory" \
  || bad "ux-lint accepts a file path now, so the doctrine should say so (exit $ux_file)"

present "the verifier agent runs the cheap lane first" \
  "agents/palate-verifier.md" "ux-lint before rendered, rendered before vitals"
present "the verifier agent certifies on one full sweep" \
  "agents/palate-verifier.md" "THE LAST RUN BEFORE HAND-OVER IS ONE FULL SWEEP"
# The per-route record is the thing the skip rests on, so the doc names its fields.
present "testing.md names the per-route record" \
  "references/testing.md" "sourcesHash, renderedHash,"
present "testing.md names the shared inputs the hash covers" \
  "references/testing.md" "global inputs changed, all routes re-rendered"
present "testing.md names what the hash does NOT cover" \
  "references/testing.md" "so an unchanged source can still render differently"

# ============ 6. THE HYGIENE LINE leads with what the number is ===========================
# ASSERT THE RENDERED LINE, NOT THE SOURCE. The first draft grepped hygiene-loop.mjs for
# "clears the " and failed on a correct implementation, because the verb is a ternary and the
# words only meet at runtime. What a reader sees is the only thing worth pinning.
line() { # <minScore> <overall>
  node --input-type=module -e "
    import { summaryLine } from '$ROOT/scripts/reference-capture/hygiene-loop.mjs';
    process.stdout.write(summaryLine({
      scored: { overall: $2, measuredWeight: 52 },
      cmp: { verdict: 'first' }, stall: { iterations: 1 }, minScore: $1,
    }));" 2>/dev/null
}
saysline() { # <desc> <rendered> <literal>
  case "$2" in *"$3"*) ok "$1" ;; *) bad "$1 (the line reads: $(printf '%.90s' "$2"))" ;; esac
}
notline() { # <desc> <rendered> <literal>
  case "$2" in *"$3"*) bad "$1 (the line reads: $(printf '%.90s' "$2"))" ;; *) ok "$1" ;; esac
}
CLEARS="$(line 80 92)"; BELOW="$(line 80 61)"; UNGATED="$(line 0 92)"
[ -n "$CLEARS" ] || bad "the hygiene line could not be rendered, so nothing here was checked"
saysline "a passing hygiene line reads as agreed" "$CLEARS" "build hygiene: clears the 80 floor at 92 (not a grade)"
saysline "a failing hygiene line reads as agreed" "$BELOW" "build hygiene: is BELOW the 80 floor at 61 (not a grade)"
saysline "an ungated line still says it is not a grade" "$UNGATED" "(not a grade)"
notline "the score does not lead the line" "$CLEARS" "build hygiene 92/100"
notline "and the ungated line does not claim a pass" "$UNGATED" "clears the"

echo "---"
echo "passed=$pass failed=$fail"
[ "$fail" -eq 0 ]
