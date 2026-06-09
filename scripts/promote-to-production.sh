#!/usr/bin/env bash
# Promote a preview build to production. Verifies the preview is a real Astro
# project FIRST (anti-freestyle gate), then flips the stage so the build
# pipeline runs phases B-F on the SAME project. No rebuild.
# Run from the project directory. Usage: promote-to-production.sh
set -euo pipefail
[ -f .palate-skill-state.json ] || { echo "no project state here; run a preview build first" >&2; exit 1; }

stage=$(jq -r '.stage' .palate-skill-state.json)
if [ "$stage" = "production" ]; then
  echo "already in production stage; resuming production phases"
else
  # Gate: the preview MUST be a real Astro project before we promote it.
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  echo "verifying the preview is a real Astro build before promoting..."
  bash "$SCRIPT_DIR/verify-is-real-astro.sh" || {
    echo "REFUSING TO PROMOTE: the preview is not a real Astro project." >&2
    echo "Fix Phase A (scaffold from template) before promoting to production." >&2
    exit 2
  }
  tmp=$(mktemp)
  jq --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '.stage="production" | .skill.lastUpdatedAt=$ts' \
    .palate-skill-state.json > "$tmp" && mv "$tmp" .palate-skill-state.json
  echo "promoted to production stage."
fi
echo "Next: the build pipeline runs phases sanity -> cloudflare -> github -> domain -> optional on this project."
