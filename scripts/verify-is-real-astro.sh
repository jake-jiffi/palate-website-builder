#!/usr/bin/env bash
# Anti-freestyle gate. Confirms the working dir is a REAL Astro project built
# from the Jiffi template, not loose hand-written HTML masquerading as a build.
# Run at the end of Phase A (preview boundary) and before any production phase.
# Exits 0 only if every required marker of a genuine scaffold is present.
set -euo pipefail
fail() { echo "NOT_A_REAL_ASTRO_BUILD: $1" >&2; echo "  The deliverable must be scaffolded from templates/astro-project, not hand-written." >&2; echo "  Re-run Phase A scaffolding. Do NOT substitute static HTML." >&2; exit 1; }

# 1. Astro is an actual dependency, pinned
[ -f package.json ] || fail "no package.json"
jq -e '.dependencies.astro // .devDependencies.astro' package.json >/dev/null 2>&1 || fail "astro not in dependencies"
astro_ver=$(jq -r '.dependencies.astro // .devDependencies.astro' package.json)
case "$astro_ver" in
  *"^"*|*"~"*|"latest") fail "astro version '$astro_ver' is not exact-pinned (no ^, ~, or latest allowed)";;
esac

# 2. The Astro config exists and uses a supported SSR adapter. Vercel is the
#    DEFAULT host; Cloudflare is the --host cloudflare backup. Either is valid.
[ -f astro.config.mjs ] || fail "no astro.config.mjs"
grep -qE "@astrojs/(vercel|cloudflare)" astro.config.mjs \
  || fail "astro.config.mjs has no supported SSR adapter (@astrojs/vercel default, or @astrojs/cloudflare backup)"

# 3. The brand package is consumed (dependency present), not inlined ad hoc
jq -e '.dependencies | to_entries[] | select(.key | startswith("@jiffi-projects/"))' package.json >/dev/null 2>&1 \
  || grep -q "vendored" .palate-skill-state.json 2>/dev/null \
  || fail "brand package not consumed and not vendored; brand system not wired"

# 4. Real Astro source structure, not a pile of root .html files
[ -d src/layouts ] || fail "no src/layouts (not a real Astro project)"
[ -d src/pages ] || fail "no src/pages"
[ -f src/layouts/BaseLayout.astro ] || fail "no BaseLayout.astro (the brand+SEO wiring)"
# Pages must be .astro, not hand-written .html dumped at the root
root_html=$(find . -maxdepth 1 -name "*.html" 2>/dev/null | wc -l | tr -d ' ')
[ "$root_html" = "0" ] || fail "found $root_html hand-written .html file(s) at the project root, this is the freestyle anti-pattern"
astro_pages=$(find src/pages -name "*.astro" 2>/dev/null | wc -l | tr -d ' ')
[ "$astro_pages" -ge 1 ] || fail "no .astro pages in src/pages"

# 5. The build actually compiles
npm run build >/dev/null 2>&1 || fail "npm run build failed, the project does not compile"
[ -d dist ] || fail "no dist/ after build"

echo "REAL_ASTRO_BUILD_OK: $astro_pages .astro pages, astro@$astro_ver, brand wired, builds clean"
