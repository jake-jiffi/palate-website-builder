#!/usr/bin/env bash
# Phase C: provision Cloudflare Workers. Uploads secrets (incl Sanity write
# token for the form handler), does the initial local deploy (local has .npmrc
# so the brand package installs). Subsequent deploys go through CI.
# Usage: provision-cloudflare.sh <slug> <write-token>
set -euo pipefail
SLUG="${1:?slug}"; WRITE_TOKEN="${2:?sanity write token}"
WORKER="${SLUG}-site"

echo "uploading Worker secrets..."
# Read token + others from .env; write token passed in (never in .env)
set -a; [ -f .env ] && . ./.env; set +a

# THE POST-DEPLOY FORM ROUND TRIP'S SECRET, generated here rather than read from .env like the
# others, because it is the one value nobody has a reason to invent: it exists only so
# verify-form-roundtrip.sh can reach /api/contact on a PRODUCTION deployment without the
# endpoint sending a real enquiry. Without it that check skips, and a check that always skips
# is a check nobody runs. Written back to .env (gitignored) so the verifier finds it with no
# manual step, and only generated when it is not already there, so a re-run keeps the value the
# deployment already holds.
ensure_smoke_secret() {
  [ -n "${PALATE_SMOKE_SECRET:-}" ] && return 0
  if command -v openssl >/dev/null 2>&1; then
    PALATE_SMOKE_SECRET="$(openssl rand -hex 24)"
  else
    PALATE_SMOKE_SECRET="$(LC_ALL=C tr -dc 'a-f0-9' < /dev/urandom | head -c 48)"
  fi
  export PALATE_SMOKE_SECRET
  [ -f .env ] || : > .env
  printf '\n# Post-deploy form round trip (verify-form-roundtrip.sh). Production only.\nPALATE_SMOKE_SECRET=%s\n' "$PALATE_SMOKE_SECRET" >> .env
  echo "generated PALATE_SMOKE_SECRET and wrote it to ./.env"
}
ensure_smoke_secret
printf '%s' "${SANITY_API_READ_TOKEN:-}" | wrangler secret put SANITY_API_READ_TOKEN --name "$WORKER" >/dev/null 2>&1 || true
printf '%s' "$WRITE_TOKEN"               | wrangler secret put SANITY_API_WRITE_TOKEN --name "$WORKER" >/dev/null 2>&1 || true
printf '%s' "${RESEND_API_KEY:-}"        | wrangler secret put RESEND_API_KEY --name "$WORKER" >/dev/null 2>&1 || true
printf '%s' "${TURNSTILE_SECRET:-}"      | wrangler secret put TURNSTILE_SECRET --name "$WORKER" >/dev/null 2>&1 || true
printf '%s' "${PALATE_SMOKE_SECRET:-}"   | wrangler secret put PALATE_SMOKE_SECRET --name "$WORKER" >/dev/null 2>&1 || true

echo "initial local build + deploy..."
npm run build
wrangler deploy
echo "CLOUDFLARE_PROVISIONED:${WORKER}"
