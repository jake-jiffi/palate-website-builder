#!/usr/bin/env bash
# Verify the Vercel deployment is reachable AND that its contact form reaches its endpoint.
# Parallel to verify-cloudflare.sh.
#   Usage:  verify-vercel.sh <url>
#
# The form round trip is a separate script so both hosts run the same request; see
# verify-form-roundtrip.sh for why posting to a live site is safe. A deployment with no
# contact endpoint SKIPS that half with a printed reason and still passes, because a brochure
# site has not failed by having no form.
set -uo pipefail
URL="${1:?url}"
HERE="$(cd "$(dirname "$0")" && pwd)"
code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$URL" || echo "000")
echo "VERIFY_VERCEL: $URL -> $code"
[ "$code" = "200" ] \
  || { echo "verify-vercel: deployment not responding 200 ($code)" >&2; exit 1; }

bash "$HERE/verify-form-roundtrip.sh" "$URL"; form=$?
[ "$form" -eq 1 ] && { echo "verify-vercel: the contact form round trip failed (see above)" >&2; exit 1; }
exit 0
