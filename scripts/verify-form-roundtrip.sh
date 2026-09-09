#!/usr/bin/env bash
# POST the contact form to a DEPLOYED site and prove the endpoint answers.
#
# Called by verify-vercel.sh and verify-cloudflare.sh after the 200 check, and runnable on its
# own against any deployment.
#
#   Usage:  verify-form-roundtrip.sh <site-url>
#   Exit:   0  the round trip is proven: 2xx carrying "smoke": true, nothing sent
#           1  the endpoint is there and something is wrong, with the reason printed
#           2  SKIPPED with a reason: this deployment serves no /api/contact
#
# WHY THIS IS SAFE TO RUN AGAINST A LIVE SITE. The request carries `x-palate-smoke: 1`, which
# makes src/pages/api/contact.ts validate the body and answer `{ ok: true, smoke: true }`
# having sent nothing. On a preview that is all it takes. In PRODUCTION the endpoint ignores
# the header unless `x-palate-smoke-secret` matches `PALATE_SMOKE_SECRET`, so set that variable
# in the environment this runs in, or the request falls through to the real path. Falling
# through is not a disaster (the real path verifies a Turnstile token this script does not
# have, and refuses with a 400 long before Resend is called) but it is a failure of this check
# and is reported as one, because a deployment where the smoke header does nothing is a
# deployment where nobody can test the form without emailing the client.
set -uo pipefail
URL="${1:?site url}"
URL="${URL%/}"

BODY='{"name":"Palate verify","email":"verify@example.com","message":"Automated round-trip check from the Palate post-deploy verifier. Nothing to action."}'
args=(-s -S --max-time 20 -X POST
  -H "content-type: application/json"
  -H "x-palate-smoke: 1")
if [ -n "${PALATE_SMOKE_SECRET:-}" ]; then
  args+=(-H "x-palate-smoke-secret: ${PALATE_SMOKE_SECRET}")
else
  echo "verify-form-roundtrip: PALATE_SMOKE_SECRET is not set. Correct for a preview; on a production deployment the smoke header is ignored and this check will fail." >&2
fi

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
# `|| echo "000"` would CONCATENATE with the 000 curl's own -w already wrote on a failed
# connection, producing "000000", which matches no branch below and lands in the wildcard. The
# unreachable-host branch would have existed and never once fired.
code=$(curl "${args[@]}" -o "$tmp" -w "%{http_code}" -d "$BODY" "$URL/api/contact" 2>/dev/null) || code="${code:-000}"
seen=$(tr -d '\r\n' < "$tmp" | cut -c1-200)

case "$code" in
  404|405)
    echo "FORM_ROUNDTRIP: SKIPPED - $URL/api/contact answered $code, so this deployment has no contact endpoint to test." >&2
    exit 2
    ;;
  000)
    echo "FORM_ROUNDTRIP: FAILED - no response from $URL/api/contact within 20s." >&2
    exit 1
    ;;
  2*)
    if printf '%s' "$seen" | grep -q '"smoke"[[:space:]]*:[[:space:]]*true'; then
      echo "FORM_ROUNDTRIP: $URL/api/contact -> $code with smoke: true (validated, nothing sent)"
      exit 0
    fi
    echo "FORM_ROUNDTRIP: FAILED - $URL/api/contact answered $code WITHOUT \"smoke\": true, so the header was ignored and this submission took the real path. On a live site that is a fake enquiry in the client's inbox. Either the endpoint predates the smoke contract, or PUBLIC_SITE_ENV is production and PALATE_SMOKE_SECRET is unset or does not match. Response: $seen" >&2
    exit 1
    ;;
  *)
    echo "FORM_ROUNDTRIP: FAILED - $URL/api/contact answered $code. Response: $seen" >&2
    exit 1
    ;;
esac
