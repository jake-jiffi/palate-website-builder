#!/usr/bin/env bash
# The three website-kit gates, each watched FAILING before it is trusted to pass.
#
# A gate that only ever says "clean" is indistinguishable from a gate that inspects nothing, and
# this repo has shipped that four times. Every assertion here introduces the fault the gate
# exists to catch and asserts the gate catches it, then removes it and asserts the gate goes
# quiet again.
#
# The token gate in particular was WRONG TWICE before it was right: its first version reported
# 207 findings on clean code (`\s*` backtracks to zero width, so the lookahead tested the space
# after the colon rather than the value), and its second missed `rebeccapurple` because the
# colour check was a hand-written denylist. Both are pinned below.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP="$(mktemp -d)"
# EVERY MUTATION BELOW EDITS A TRACKED FILE AND RESTORES IT ON THE NEXT LINE. A failure between the
# two leaves the repository edited, and one run of this suite did exactly that: it left the manifest
# a flag short and the next assertion failed on a file the test had broken. The trap restores
# whatever is backed up here however the run ends, so a mid-test failure costs a red line and never
# a corrupted tree.
restore_backups() {
  for b in "$TMP"/*.restore; do
    [ -e "$b" ] || continue
    dest="$(cat "${b%.restore}.dest" 2>/dev/null)"
    [ -n "$dest" ] && [ -e "$dest" ] && cp "$b" "$dest"
  done
  rm -rf "$TMP"
}
trap restore_backups EXIT
# back_up <file> <name>: keep a copy the trap will put back no matter how the run ends.
back_up() { cp "$1" "$TMP/$2.restore"; printf '%s' "$1" > "$TMP/$2.dest"; }
pass=0; fail=0
ok()  { echo "ok   - $1"; pass=$((pass+1)); }
bad() { echo "FAIL - $1"; fail=$((fail+1)); }

KIT="$HERE/templates/astro-project/src/components/kit"
TOKENS="$HERE/scripts/gate-kit-tokens.mjs"
COMPLETE="$HERE/scripts/gate-kit-complete.mjs"
IMAGERY="$HERE/scripts/gate-client-imagery.mjs"

for f in "$TOKENS" "$COMPLETE" "$IMAGERY"; do
  [ -f "$f" ] || { bad "$(basename "$f") is missing"; echo "passed=$pass failed=$fail"; exit 1; }
done
[ -d "$KIT" ] || { bad "the kit components are missing"; echo "passed=$pass failed=$fail"; exit 1; }

# ---------- baseline: the shipped kit is clean under both gates ----------
if "$HERE/scripts/gate-kit-tokens.mjs" "$HERE" >/dev/null 2>&1; then
  ok "the shipped kit passes gate-kit-tokens"
else bad "the shipped kit FAILS gate-kit-tokens: $("$TOKENS" "$HERE" 2>&1 | head -3)"; fi

if "$COMPLETE" "$HERE" >/dev/null 2>&1; then
  ok "the shipped kit passes gate-kit-complete"
else bad "the shipped kit FAILS gate-kit-complete: $("$COMPLETE" "$HERE" 2>&1 | head -3)"; fi

# ---------- the token gate catches each class it exists for ----------
VICTIM="$KIT/cta/CtaBanner.astro"
cp "$VICTIM" "$TMP/victim.bak"
mutate() { # <css declaration>
  python3 - "$VICTIM" "$1" <<'PY'
import sys
p, decl = sys.argv[1], sys.argv[2]
s = open(p, encoding="utf-8").read()
i = s.index("<style>") + len("<style>")
open(p, "w", encoding="utf-8").write(s[:i] + "\n  .kit-mutant { " + decl + " }\n" + s[i:])
PY
}
restore() { cp "$TMP/victim.bak" "$VICTIM"; }

while IFS='|' read -r label decl; do
  [ -z "$label" ] && continue
  mutate "$decl"
  if "$TOKENS" "$HERE" >/dev/null 2>&1; then bad "gate-kit-tokens MISSED $label ($decl)"
  else ok "gate-kit-tokens catches $label"; fi
  restore
done <<'MUTS'
a hex colour|background: #ff0044;
a colour function|background: hsl(210 50% 40%);
a named colour|color: rebeccapurple;
an obscure named colour|color: papayawhip;
a font family|font-family: Inter, sans-serif;
a font size|font-size: 19px;
a spacing literal|padding: 2.5rem;
a gap literal|gap: 13px;
a radius literal|border-radius: 14px;
a shadow literal|box-shadow: 0 4px 12px rgba(0,0,0,0.25);
a border literal|border: 3px solid #333;
a literal laundered through a local alias|--sneaky: #ff0000; background: var(--sneaky);
a component redefining a kit token|--kit-accent-lift: var(--kit-text-inverse);
MUTS

# ---------- and does NOT fire on the things it must allow ----------
while IFS='|' read -r label decl; do
  [ -z "$label" ] && continue
  mutate "$decl"
  if "$TOKENS" "$HERE" >/dev/null 2>&1; then ok "gate-kit-tokens allows $label"
  else bad "gate-kit-tokens FALSE-FAILS on $label ($decl): $("$TOKENS" "$HERE" 2>&1 | sed -n 2p)"; fi
  restore
done <<'OKS'
a value read from a token|font-size: var(--kit-text-base);
a token behind whitespace|font-size:   var(--kit-text-lg);
a hairline border|border-width: 1px;
a type-relative icon size|width: 1em;
a colour mixed from a token|background: color-mix(in srgb, var(--kit-text) 8%, transparent);
a component-scoped alias over a token|--local: var(--kit-bg-subtle); background: var(--local);
zero|padding: 0;
OKS
restore

# ---------- the completeness gate ----------
ORPHAN="$KIT/cta/CtaOrphanFixture.astro"
cp "$VICTIM" "$ORPHAN"
if "$COMPLETE" "$HERE" >/dev/null 2>&1; then bad "gate-kit-complete MISSED a component with no manifest entry"
else ok "gate-kit-complete catches a component no manifest entry declares"; fi
rm -f "$ORPHAN"

MOVED="$KIT/faq/FaqAccordion.astro"
mv "$MOVED" "$TMP/moved.astro"
if "$COMPLETE" "$HERE" >/dev/null 2>&1; then bad "gate-kit-complete MISSED a declared variation with no component"
else ok "gate-kit-complete catches a declared variation with no component"; fi
mv "$TMP/moved.astro" "$MOVED"

EMPTYV="$KIT/benefits/BenefitCards.astro"
cp "$EMPTYV" "$TMP/empty.bak"
sed -i.bak 's/kit-empty/kit-notempty/g' "$EMPTYV" && rm -f "$EMPTYV.bak"
if "$COMPLETE" "$HERE" >/dev/null 2>&1; then bad "gate-kit-complete MISSED a declared empty state with no .kit-empty"
else ok "gate-kit-complete catches a declared empty state that is not implemented"; fi
cp "$TMP/empty.bak" "$EMPTYV"

# ---------- every declared state has to be REACHABLE ----------
# The manifest has always listed the states a piece must handle. These four assertions are what
# stops that list drifting back into a promise: a state with no fixture, a fixture no state can
# reach, a missing route, and a frame that imports the driver without rendering it. The last one
# is here because the FIRST version of that check passed a file where the driver had been renamed
# and nothing was rendered, since the name still appeared in the import path.
STATES="$HERE/templates/astro-project/src/lib/kit-states.ts"
VIEWER="$HERE/templates/astro-project/src/pages/kit/[piece]/[variation]/[state].astro"
FRAME="$HERE/templates/astro-project/src/pages/kit-frame/[piece]/[variation]/[state].astro"

back_up "$STATES" states
cp "$STATES" "$TMP/states.bak"
node -e '
const fs = require("fs");
const p = process.argv[1];
const s = fs.readFileSync(p, "utf8");
const start = s.indexOf("  FaqAccordion: {", s.indexOf("LONG_PROPS"));
const end = s.indexOf("\n  },\n", start) + 5;
fs.writeFileSync(p, s.slice(0, start) + s.slice(end));
' "$STATES"
if "$COMPLETE" "$HERE" >/dev/null 2>&1; then bad "gate-kit-complete MISSED a declared long state with no fixture"
else ok "gate-kit-complete catches a declared content state that has no fixture to render"; fi
cp "$TMP/states.bak" "$STATES"

node -e '
const fs = require("fs");
const p = process.argv[1];
const s = fs.readFileSync(p, "utf8");
fs.writeFileSync(p, s.replace("export const EMPTY_PROPS: Record<string, Record<string, unknown>> = {", "export const EMPTY_PROPS: Record<string, Record<string, unknown>> = {\n  CtaBanner: { items: [] },"));
' "$STATES"
if "$COMPLETE" "$HERE" >/dev/null 2>&1; then bad "gate-kit-complete MISSED a fixture for a state nothing declares"
else ok "gate-kit-complete catches a fixture no declared state can ever reach"; fi
cp "$TMP/states.bak" "$STATES"

mv "$VIEWER" "$TMP/viewer.bak"
if "$COMPLETE" "$HERE" >/dev/null 2>&1; then bad "gate-kit-complete MISSED the state route being gone"
else ok "gate-kit-complete catches the state route being gone, which makes every state unreachable"; fi
mv "$TMP/viewer.bak" "$VIEWER"

back_up "$FRAME" frame
cp "$FRAME" "$TMP/frame.bak"
sed -i.bak 's/import StateDriver from/import NoDriver from/; s/{drive \&\& <StateDriver/{drive \&\& <NoDriver/' "$FRAME" && rm -f "$FRAME.bak"
if "$COMPLETE" "$HERE" >/dev/null 2>&1; then bad "gate-kit-complete MISSED a frame that imports the driver and never renders it"
else ok "gate-kit-complete catches a frame that names the driver without rendering it"; fi
cp "$TMP/frame.bak" "$FRAME"

# ---------- empty copy is for a VISITOR, and the state has to be declared ----------
# Five components defaulted to an instruction for whoever was building the page, and those are
# defaults, so they ship. Three of the five did not declare `empty`, so nothing could show a
# reviewer what a visitor would read.
EMPTYC="$HERE/templates/astro-project/src/components/kit/benefits/BenefitCards.astro"
back_up "$EMPTYC" emptyc
cp "$EMPTYC" "$TMP/emptyc.bak"
sed -i.bak 's/emptyMessage = "What you get from this is being written up."/emptyMessage = "Add three to eight benefits, each with a title."/' "$EMPTYC" && rm -f "$EMPTYC.bak"
if "$COMPLETE" "$HERE" >/dev/null 2>&1; then bad "gate-kit-complete MISSED an empty message written for the builder"
else ok "gate-kit-complete catches an empty message that instructs the builder rather than the visitor"; fi
cp "$TMP/emptyc.bak" "$EMPTYC"

MANIFEST="$HERE/templates/astro-project/src/lib/kit.ts"
back_up "$MANIFEST" kit
cp "$MANIFEST" "$TMP/kit.bak"
node -e '
const fs = require("fs");
const p = process.argv[1];
const s = fs.readFileSync(p, "utf8");
const m = /(\{ id: "PricingCards", name: "[^"]*",[\s\S]*?states: \[)([^\]]*)(\])/.exec(s);
fs.writeFileSync(p, s.slice(0, m.index) + m[1] + m[2].replace(/,\s*"empty"/, "") + m[3] + s.slice(m.index + m[0].length));
' "$MANIFEST"
if "$COMPLETE" "$HERE" >/dev/null 2>&1; then bad "gate-kit-complete MISSED a piece that renders an empty message and declares no empty state"
else ok "gate-kit-complete catches a piece whose empty message no state can ever show"; fi
cp "$TMP/kit.bak" "$MANIFEST"

# A hero renders the page's h1; every other piece needs the frame to supply one. Get the flag
# wrong either way and the demo document has two h1s or none.
perl -0pi -e 's/, ownsPageHeading: true//' "$MANIFEST"
if "$COMPLETE" "$HERE" >/dev/null 2>&1; then bad "gate-kit-complete MISSED a level-1 piece that does not declare ownsPageHeading"
else ok "gate-kit-complete catches a piece that renders an h1 without declaring it, so the frame adds a second"; fi
cp "$TMP/kit.bak" "$MANIFEST"


"$COMPLETE" "$HERE" >/dev/null 2>&1 && ok "and the kit is clean again once every fixture is removed" \
  || bad "the kit did not return to clean after the fixtures were removed"

# ---------- the client-imagery gate ----------
SITE="$TMP/site"; mkdir -p "$SITE/_assets-archive/photos" "$SITE/dist/client"
for i in 1 2 3; do printf 'x' > "$SITE/_assets-archive/photos/p$i.jpg"; done
cat > "$SITE/dist/client/index.html" <<'HTML'
<html><body><h1>A site</h1><img src="/favicon.svg" alt=""></body></html>
HTML
if "$IMAGERY" "$SITE" >/dev/null 2>&1; then bad "gate-client-imagery MISSED harvested photos with none used"
else ok "gate-client-imagery catches harvested photographs that the site never uses"; fi

printf '{"compose":{"photography_reason":"Only three of the harvested photographs are large enough to carry a hero, so no direction depends on photography they do not own."}}' > "$SITE/build-manifest.json"
if "$IMAGERY" "$SITE" >/dev/null 2>&1; then ok "and passes once the decision is RECORDED with a real reason"
else bad "gate-client-imagery ignored a recorded photography_reason"; fi

printf '{"compose":{"photography_reason":"no good photos"}}' > "$SITE/build-manifest.json"
if "$IMAGERY" "$SITE" >/dev/null 2>&1; then bad "gate-client-imagery accepted a token gesture as a reason"
else ok "and still fails on a token gesture rather than a reason"; fi

rm -f "$SITE/build-manifest.json"
cat > "$SITE/dist/client/index.html" <<'HTML'
<html><body><img src="/photos/workshop.jpg" alt="The workshop"></body></html>
HTML
if "$IMAGERY" "$SITE" >/dev/null 2>&1; then ok "and passes when the site actually uses the client's photography"
else bad "gate-client-imagery fired on a site that DOES use the imagery"; fi

rm -rf "$SITE/_assets-archive"
if "$IMAGERY" "$SITE" >/dev/null 2>&1; then ok "and skips a build with no harvested imagery to fail on"
else bad "gate-client-imagery did not skip a build with nothing harvested"; fi

echo "---"
echo "passed=$pass failed=$fail"
[ "$fail" -eq 0 ]
