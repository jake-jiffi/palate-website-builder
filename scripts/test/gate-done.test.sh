#!/usr/bin/env bash
# Tests the "done" gate (scripts/gate-done.sh): the three FAIL-OPEN skip cases, the
# BLOCK on failed evidence, and the PASS on real evidence. The gate reads artefacts
# (verify-report.json + .palate-shots/*) relative to the manifest's directory, so each
# case builds a throwaway project dir under a tmp root.
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
GATE="$DIR/../gate-done.sh"
DEEP="$DIR/fixtures/manifest-deep.json"   # a manifest that PASSES the depth floor
pass=0; fail=0

check() { # desc  expected_exit  manifest_path  [extra env assignments...]
  local desc="$1" want="$2" manifest="$3"; shift 3
  env "$@" bash "$GATE" "$manifest" >/dev/null 2>&1
  local ec=$?
  if [ "$ec" -eq "$want" ]; then echo "ok   - $desc"; pass=$((pass+1));
  else echo "FAIL - $desc (exit $ec, want $want)"; fail=$((fail+1)); fi
}

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# --- FAIL-OPEN 1: no manifest -> skip (exit 0) -------------------------------
check "no manifest -> skip" 0 "$TMP/no-such.json"

# --- FAIL-OPEN 2: manifest with zero MCP calls -> skip (MCP not connected) ----
NOMCP="$TMP/nomcp"; mkdir -p "$NOMCP"
echo '{"schema":3,"mcp_calls":[],"files_written":["src/pages/index.astro"]}' > "$NOMCP/build-manifest.json"
check "MCP not connected -> skip" 0 "$NOMCP/build-manifest.json"

# --- FAIL-OPEN 3: MCP calls but no dist/ and no verify-report.json -> skip ----
NOREND="$TMP/norender"; mkdir -p "$NOREND"
cp "$DEEP" "$NOREND/build-manifest.json"   # has >=1 mcp_call, passes depth
check "no renderable preview -> skip" 0 "$NOREND/build-manifest.json"

# Shared helper: drop a screenshot artefact (a non-empty PNG + manifest + errors).
make_shots() { # <proj-dir> <console_errors>
  local proj="$1" cerr="$2"
  mkdir -p "$proj/.palate-shots/desktop"
  # A minimal valid 1x1 PNG so the on-disk-evidence check finds a real file.
  printf '\x89PNG\r\n\x1a\n' > "$proj/.palate-shots/desktop-full.png"
  printf '\x89PNG\r\n\x1a\n' > "$proj/.palate-shots/mobile-full.png"
  echo "{\"status\":\"captured\",\"console_errors\":$cerr,\"shots\":{\"desktop_full\":\"desktop-full.png\"}}" > "$proj/.palate-shots/manifest.json"
  echo '[]' > "$proj/.palate-shots/errors.json"
}

# --- BLOCK: verifier verdict fail -> exit 2 ----------------------------------
BLOCK="$TMP/block"; mkdir -p "$BLOCK"
cp "$DEEP" "$BLOCK/build-manifest.json"
make_shots "$BLOCK" 0
cat > "$BLOCK/verify-report.json" <<'JSON'
{ "verdict": "fail",
  "visual": { "ran": true, "pass": false, "console_errors": 0,
    "iterations": [ { "i": 1, "axes": { "philosophy": 2 }, "defects": [ { "type": "overflow", "location": "hero mobile" } ], "score": 18,
      "shots": { "desktop_full": ".palate-shots/desktop-full.png" } } ] },
  "shots_dir": ".palate-shots" }
JSON
check "verifier verdict fail -> block" 2 "$BLOCK/build-manifest.json"

# --- BLOCK: console error on the render -> exit 2 (thrown build = visual fail) -
CERR="$TMP/cerr"; mkdir -p "$CERR"
cp "$DEEP" "$CERR/build-manifest.json"
make_shots "$CERR" 2   # 2 console errors recorded by the screenshot driver
cat > "$CERR/verify-report.json" <<'JSON'
{ "verdict": "pass",
  "visual": { "ran": true, "pass": true, "console_errors": 0,
    "iterations": [ { "i": 1, "axes": { "philosophy": 5 }, "score": 28,
      "shots": { "desktop_full": ".palate-shots/desktop-full.png" } } ] },
  "shots_dir": ".palate-shots" }
JSON
check "console errors on render -> block" 2 "$CERR/build-manifest.json"

# --- BLOCK: visual pass but NO screenshot on disk -> exit 2 (evidence, not assertion) -
NOPNG="$TMP/nopng"; mkdir -p "$NOPNG/.palate-shots"
cp "$DEEP" "$NOPNG/build-manifest.json"
echo '{"status":"captured","console_errors":0}' > "$NOPNG/.palate-shots/manifest.json"
cat > "$NOPNG/verify-report.json" <<'JSON'
{ "verdict": "pass", "visual": { "ran": true, "pass": true, "console_errors": 0, "iterations": [] }, "shots_dir": ".palate-shots" }
JSON
check "visual pass with no PNG on disk -> block" 2 "$NOPNG/build-manifest.json"

# --- PASS: real evidence, verdict pass, screenshots on disk, zero errors -> exit 0 -
PASS="$TMP/pass"; mkdir -p "$PASS"
cp "$DEEP" "$PASS/build-manifest.json"
make_shots "$PASS" 0
cat > "$PASS/verify-report.json" <<'JSON'
{ "verdict": "pass",
  "visual": { "ran": true, "pass": true, "console_errors": 0,
    "iterations": [ { "i": 1, "axes": { "philosophy": 5, "hierarchy": 4, "execution": 4, "specificity": 4, "restraint": 4, "variety": 4 }, "score": 25,
      "shots": { "desktop_full": ".palate-shots/desktop-full.png", "mobile_full": ".palate-shots/mobile-full.png" } } ] },
  "shots_dir": ".palate-shots" }
JSON
check "real pass evidence -> pass" 0 "$PASS/build-manifest.json"

# --- THE SUMMARY COUNTS ITS SKIPS BEFORE IT SAYS PASSED ----------------------------
# "Done gate passed" over a line naming seven sub-gates reads as seven gates passing. On this
# fixture only two of them could run: there is no src/pages, so ship-ready, SEO and Explore
# all refused, and there are no rendered variants to compare. The count has to be the first
# thing in the line, and each skip has to carry its own reason.
summary="$(bash "$GATE" "$PASS/build-manifest.json" 2>/dev/null)"
if printf '%s' "$summary" | grep -qE 'Done gate: [0-9]+ of [0-9]+ sub-gates ran, [0-9]+ skipped'; then
  echo "ok   - the summary opens with how many sub-gates ran"; pass=$((pass+1))
else
  echo "FAIL - the summary opens with how many sub-gates ran (got: $summary)"; fail=$((fail+1))
fi
if printf '%s' "$summary" | grep -qE 'explore=skipped([^(]|$)'; then
  echo "ok   - gate-explore's skip is mapped, not read as a pass"; pass=$((pass+1))
else
  echo "FAIL - gate-explore's skip is mapped, not read as a pass (got: $summary)"; fail=$((fail+1))
fi
# EACH REASON IS PRINTED ONCE. It used to appear in the count clause AND again inside
# name=skipped(reason) in the tail, which is how one line reached 1,055 characters: fourteen
# lines at 80 columns, for a summary whose job is to be read.
if printf '%s' "$summary" | grep -qF 'explore: not an Explore build'; then
  echo "ok   - and the reason is in the count clause"; pass=$((pass+1))
else
  echo "FAIL - and the reason is in the count clause (got: $summary)"; fail=$((fail+1))
fi
reason_hits="$(printf '%s' "$summary" | grep -o 'not an Explore build' | grep -c . || true)"
if [ "$reason_hits" = "1" ]; then
  echo "ok   - and only once, not twice"; pass=$((pass+1))
else
  echo "FAIL - and only once, not twice (found $reason_hits times)"; fail=$((fail+1))
fi
# The tail is broken onto its own INDENTED line, so the two halves read as two things.
if printf '%s' "$summary" | grep -qE '^  Passed:'; then
  echo "ok   - and the Passed tail is its own indented line"; pass=$((pass+1))
else
  echo "FAIL - and the Passed tail is its own indented line (got: $summary)"; fail=$((fail+1))
fi
if printf '%s' "$summary" | grep -qF 'Passed:'; then
  echo "ok   - and it only says passed after the count"; pass=$((pass+1))
else
  echo "FAIL - and it only says passed after the count (got: $summary)"; fail=$((fail+1))
fi
# THE NOVELTY GATE PRINTS ITS SKIP ON STDOUT AND EXITS 0, so reading stderr alone could not
# tell a pass from a skip and counted both as ran. On this fixture it skips ("no diverge
# block"), so the count is one lower than the first version of this line claimed.
if printf '%s' "$summary" | grep -qE 'novelty=skipped([^(]|$)' \
   && printf '%s' "$summary" | grep -qF 'novelty: no diverge block'; then
  echo "ok   - a novelty skip is counted as a skip, not a pass"; pass=$((pass+1))
else
  echo "FAIL - a novelty skip is counted as a skip, not a pass (got: $summary)"; fail=$((fail+1))
fi

# --- SHIPREADY'S OTHER EXIT-2 REASONS ARE NOT ALL "not an Astro project shape" ---------
# This epic gave gate-shipready two more exit-2 paths (nothing to inspect, and a refusal), and
# the mapping still labelled every one of them with the one reason it knew. src/pages exists
# here and holds nothing, so the gate skips for the NEW reason.
SRNONE="$TMP/shipready-empty"; mkdir -p "$SRNONE/src/pages"
cp "$DEEP" "$SRNONE/build-manifest.json"
make_shots "$SRNONE" 0
cp "$PASS/verify-report.json" "$SRNONE/verify-report.json"
sr_summary="$(bash "$GATE" "$SRNONE/build-manifest.json" 2>/dev/null)"
if printf '%s' "$sr_summary" | grep -qF 'shipready: nothing to inspect'; then
  echo "ok   - gate-shipready's skip carries its own reason"; pass=$((pass+1))
else
  echo "FAIL - gate-shipready's skip carries its own reason (got: $sr_summary)"; fail=$((fail+1))
fi

# --- THE SEO SKIP REASON IS THE FINDING, NOT THE HEADER --------------------------------
# gate-seo opens a cannot-check report with "N thing(s) could NOT be checked. These are unknown,
# not clean." and names the actual unknown two lines later. Taking the first line verbatim put
# the header in the summary and dropped the one part that says what was not checked.
SEOB="$TMP/seo-blocked"; mkdir -p "$SEOB/src/pages" "$SEOB/dist"
cp "$DEEP" "$SEOB/build-manifest.json"
make_shots "$SEOB" 0
cp "$PASS/verify-report.json" "$SEOB/verify-report.json"
printf -- '---\n---\n<h1>Home</h1>\n' > "$SEOB/src/pages/index.astro"
# THE SITE HAS TO BE OTHERWISE CLEAN, or gate-seo exits 1 with findings and the done gate fails
# rather than skipping, which is what happened when the SEO gate grew two checks under this
# fixture: it went on asserting nothing, from an empty summary. So the home page carries an
# Organization node and robots.txt is environment aware, leaving the answer-engine surfaces as
# the only thing it could not check.
cat > "$SEOB/dist/index.html" <<'HTML'
<!doctype html><html><head><link rel="canonical" href="https://x.test/">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"X","url":"https://x.test/"}</script>
</head><body><h1>h</h1></body></html>
HTML
printf '<?xml version="1.0"?><urlset><url><loc>https://x.test/</loc></url></urlset>' > "$SEOB/dist/sitemap-0.xml"
cat > "$SEOB/dist/robots.txt" <<'ROBOTS'
# VERCEL_ENV preview builds emit Disallow: / instead of this policy
User-agent: *
Allow: /
Sitemap: https://x.test/sitemap-index.xml
ROBOTS
seo_summary="$(bash "$GATE" "$SEOB/build-manifest.json" 2>/dev/null)"
if printf '%s' "$seo_summary" | grep -qF 'answer-engine surfaces'; then
  echo "ok   - the SEO skip names what could not be checked"; pass=$((pass+1))
else
  echo "FAIL - the SEO skip names what could not be checked (got: $seo_summary)"; fail=$((fail+1))
fi
if printf '%s' "$seo_summary" | grep -qF 'thing(s) could NOT be checked'; then
  echo "FAIL - and not gate-seo's header (got: $seo_summary)"; fail=$((fail+1))
else
  echo "ok   - and not gate-seo's header"; pass=$((pass+1))
fi

# --- AN ADVISORY BEFORE THE REASON IS NOT THE REASON ------------------------------------
# gate-seo prints a build-format advisory on stderr BEFORE it does anything, so on any exit-2
# path where it fires the first stderr line is the advisory and the reason is two lines below.
# The mapping took the first line, so a site that had simply never been built was summarised as
# a config problem: "astro.config declares build.format file and @astrojs/vercel overrides it".
# The operator is sent to change their host over a missing dist.
SEOW="$TMP/seo-warned"; mkdir -p "$SEOW/src/pages"
cp "$DEEP" "$SEOW/build-manifest.json"
make_shots "$SEOW" 0
cp "$PASS/verify-report.json" "$SEOW/verify-report.json"
printf -- '---\n---\n<h1>Home</h1>\n' > "$SEOW/src/pages/index.astro"
printf '{"name":"s","dependencies":{"@astrojs/vercel":"^8.0.0"}}' > "$SEOW/package.json"
cat > "$SEOW/astro.config.mjs" <<'CFG'
import vercel from "@astrojs/vercel";
export default { output: "static", adapter: vercel(), build: { format: "file" } };
CFG
warn_summary="$(bash "$GATE" "$SEOW/build-manifest.json" 2>/dev/null)"
if printf '%s' "$warn_summary" | grep -qF 'seo: no build output'; then
  echo "ok   - the SEO skip reports the reason, not the advisory above it"; pass=$((pass+1))
else
  echo "FAIL - the SEO skip reports the reason, not the advisory above it (got: $warn_summary)"; fail=$((fail+1))
fi
if printf '%s' "$warn_summary" | grep -qF 'astro.config declares build.format'; then
  echo "FAIL - and the advisory is not mistaken for it (got: $warn_summary)"; fail=$((fail+1))
else
  echo "ok   - and the advisory is not mistaken for it"; pass=$((pass+1))
fi

# --- THE NO-JQ SKIP SAYS HOW TO FIX IT -------------------------------------------------
# Without jq every gate here is off, and the operator was told so and nothing else.
NOJQ="$TMP/nojq-bin"; mkdir -p "$NOJQ"
for c in node bash find wc tr sed grep cat ls dirname basename mktemp rm printf; do
  src="$(command -v "$c" 2>/dev/null)" && ln -sf "$src" "$NOJQ/$c" 2>/dev/null
done
nojq_err="$(PATH="$NOJQ" bash "$GATE" "$PASS/build-manifest.json" 2>&1 >/dev/null || true)"
if printf '%s' "$nojq_err" | grep -qF 'brew install jq'; then
  echo "ok   - the no-jq skip says how to fix it"; pass=$((pass+1))
else
  echo "FAIL - the no-jq skip says how to fix it (got: $nojq_err)"; fail=$((fail+1))
fi

# --- A KILLED CAPTURE LEAVES A PENDING MANIFEST, AND THAT IS NOT EVIDENCE --------------
# The driver writes its manifest before it launches now, so a run killed by a timeout, an OOM
# or a SIGKILL leaves status "pending" rather than the PREVIOUS run's "captured".
PENDING="$TMP/pending-capture"; mkdir -p "$PENDING"
cp "$DEEP" "$PENDING/build-manifest.json"
make_shots "$PENDING" 0
echo '{"status":"pending","console_errors":0}' > "$PENDING/.palate-shots/manifest.json"
cp "$PASS/verify-report.json" "$PENDING/verify-report.json"
check "a capture killed mid-run (status pending) -> block" 2 "$PENDING/build-manifest.json"

# --- A FAILED CAPTURE IS NOT EVIDENCE ----------------------------------------------
# The PNG on disk outlives the run that wrote it. A capture that threw, or a browser that
# never launched, leaves the previous run's screenshots sitting exactly where the shot count
# looks, so counting files answered "did a capture ever happen here" and never "did THIS one
# succeed". The driver records its own verdict; the gate has to read it before it counts.
STALE="$TMP/stale-capture"; mkdir -p "$STALE"
cp "$DEEP" "$STALE/build-manifest.json"
make_shots "$STALE" 0
echo '{"status":"failed","error":"browser launch failed","console_errors":0}' > "$STALE/.palate-shots/manifest.json"
cp "$PASS/verify-report.json" "$STALE/verify-report.json"
check "a failed capture beside a stale PNG -> block" 2 "$STALE/build-manifest.json"
stale_err="$(bash "$GATE" "$STALE/build-manifest.json" 2>&1 >/dev/null || true)"
if printf '%s' "$stale_err" | grep -qF 'shots manifest reports failed capture'; then
  echo "ok   - and it names the failed capture as the cause"; pass=$((pass+1))
else
  echo "FAIL - and it names the failed capture as the cause (got: $stale_err)"; fail=$((fail+1))
fi

# An older shots manifest with no status at all must NOT be trapped: absent is not bad.
NOSTATUS="$TMP/no-status"; mkdir -p "$NOSTATUS"
cp "$DEEP" "$NOSTATUS/build-manifest.json"
make_shots "$NOSTATUS" 0
echo '{"console_errors":0}' > "$NOSTATUS/.palate-shots/manifest.json"
cp "$PASS/verify-report.json" "$NOSTATUS/verify-report.json"
check "a shots manifest with no status -> pass (absent is not bad)" 0 "$NOSTATUS/build-manifest.json"

# A shots manifest with NO console_errors field must not be read as a clean render. jq's
# `// 0` said zero for an absent field, so a manifest written by verify-rendered.mjs before
# the capture driver ran would have overridden a report that recorded real errors.
NOCERR="$TMP/no-console-field"; mkdir -p "$NOCERR"
cp "$DEEP" "$NOCERR/build-manifest.json"
make_shots "$NOCERR" 0
echo '{"routes":{"/":{"sourcesHash":"abc","renderedHash":"def","passed_at":"2026-09-09T00:00:00.000Z"}}}' \
  > "$NOCERR/.palate-shots/manifest.json"
sed 's/"console_errors": 0/"console_errors": 3/' "$PASS/verify-report.json" > "$NOCERR/verify-report.json"
check "a shots manifest with no console_errors falls back to the report" 2 "$NOCERR/build-manifest.json"

# --- PROJECT DIR COMES FROM THE MANIFEST, NOT FROM WHERE THE MANIFEST SITS --------
# A real client build kept build-manifest.json at the repo root and the Astro site (dist/,
# .palate-shots/, verify-report.json) in a subdirectory. Deriving the project from dirname
# resolved to a directory holding none of them, so the render rung found no preview and the
# whole gate skipped clean while eight built variants sat one level down.
SUBROOT="$TMP/subdir-project"; SUBSITE="$SUBROOT/site"; mkdir -p "$SUBSITE"
jq --arg p "$SUBSITE" '.project=$p' "$DEEP" > "$SUBROOT/build-manifest.json"
make_shots "$SUBSITE" 0
cat > "$SUBSITE/verify-report.json" <<'JSON'
{ "verdict": "pass",
  "visual": { "ran": true, "pass": true, "console_errors": 0,
    "iterations": [ { "i": 1, "axes": { "philosophy": 5, "hierarchy": 4, "execution": 4, "specificity": 4, "restraint": 4, "variety": 4 }, "score": 25,
      "shots": { "desktop_full": ".palate-shots/desktop-full.png", "mobile_full": ".palate-shots/mobile-full.png" } } ] },
  "shots_dir": ".palate-shots" }
JSON
check "manifest.project points at a subdir -> artefacts are FOUND (real pass)" 0 "$SUBROOT/build-manifest.json"

# The same layout with a FAILING report must now BLOCK. Without the fix this exits 0 by
# skipping, which is the silent hole: a failed build reads exactly like a clean one.
SUBFAIL="$TMP/subdir-fail"; SUBFSITE="$SUBFAIL/site"; mkdir -p "$SUBFSITE"
jq --arg p "$SUBFSITE" '.project=$p' "$DEEP" > "$SUBFAIL/build-manifest.json"
make_shots "$SUBFSITE" 0
echo '{ "verdict": "fail", "visual": { "ran": true, "pass": false, "console_errors": 0, "iterations": [] }, "shots_dir": ".palate-shots" }' > "$SUBFSITE/verify-report.json"
check "manifest.project subdir + failing report -> BLOCK (not a silent skip)" 2 "$SUBFAIL/build-manifest.json"

# A recorded project path that no longer exists must fall back, never crash the gate.
STALE="$TMP/stale-project"; mkdir -p "$STALE"
jq '.project="/nonexistent/path/that/was/moved"' "$DEEP" > "$STALE/build-manifest.json"
check "manifest.project missing on disk -> falls back to the manifest dir (skip, no crash)" 0 "$STALE/build-manifest.json"

# --- UNIQUENESS NOW HAS A DETERMINISTIC CALLER ---------------------------------------
# It was the only gate in the suite invoked solely by an agent instruction, and it could not
# have been otherwise: the scaffold is SSR, so dist/ holds no HTML. screenshot-build.mjs now
# writes rendered.html beside each variant's shots, which is what makes this reachable.
mk_variant_html() { # <shots-dir> <vN> <body>
  mkdir -p "$1/$2"
  printf '<!doctype html><html><body>%s</body></html>' "$3" > "$1/$2/rendered.html"
}

UOK="$TMP/uniq-ok"; mkdir -p "$UOK"
cp "$DEEP" "$UOK/build-manifest.json"; make_shots "$UOK" 0
cat > "$UOK/verify-report.json" <<'JSON'
{ "verdict": "pass", "visual": { "ran": true, "pass": true, "console_errors": 0,
  "iterations": [ { "i": 1, "axes": { "philosophy": 5, "hierarchy": 4, "execution": 4, "specificity": 4, "restraint": 4, "variety": 4 }, "score": 25,
    "shots": { "desktop_full": ".palate-shots/desktop-full.png" } } ] }, "shots_dir": ".palate-shots" }
JSON
mk_variant_html "$UOK/.palate-shots" v1 '<header class="masthead"><h1>One</h1></header><section class="rail"><p>A quiet column of type, one photograph, a great deal of air.</p></section>'
mk_variant_html "$UOK/.palate-shots" v2 '<nav class="strip"><ul><li>a</li></ul></nav><main class="grid"><article class="tile"><h2>Two</h2></article><aside class="pin">Scroll-driven record opening as you go</aside></main>'
check "distinct rendered variants -> pass" 0 "$UOK/build-manifest.json"

# Two variants that are the same page twice must be caught rather than shipped.
UBAD="$TMP/uniq-bad"; mkdir -p "$UBAD"
cp "$UOK/build-manifest.json" "$UBAD/build-manifest.json"; cp "$UOK/verify-report.json" "$UBAD/verify-report.json"
make_shots "$UBAD" 0
DUP='<header class="masthead"><h1>Same</h1></header><section class="rail"><p>A quiet column of type, one photograph, a great deal of air.</p></section>'
mk_variant_html "$UBAD/.palate-shots" v1 "$DUP"
mk_variant_html "$UBAD/.palate-shots" v2 "$DUP"
check "two near-identical variants -> block" 2 "$UBAD/build-manifest.json"

# One variant is not a set: nothing to compare, and it must not block.
USOLO="$TMP/uniq-solo"; mkdir -p "$USOLO"
cp "$UOK/build-manifest.json" "$USOLO/build-manifest.json"; cp "$UOK/verify-report.json" "$USOLO/verify-report.json"
make_shots "$USOLO" 0
mk_variant_html "$USOLO/.palate-shots" v1 "$DUP"
check "a single rendered variant -> pass (nothing to compare)" 0 "$USOLO/build-manifest.json"

echo "---"
echo "passed=$pass failed=$fail"
[ "$fail" -eq 0 ]
