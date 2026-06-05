#!/usr/bin/env bash
# Initialise .jiffi-skill-state.json
# Usage: state-init.sh <slug> <client-name> <domain> [stage]
#   stage: preview (default) | production
set -euo pipefail
SLUG="${1:?slug}"; CLIENT="${2:?client}"; DOMAIN="${3:?domain}"; STAGE="${4:-preview}"
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
case "$STAGE" in preview|production) ;; *) echo "stage must be preview or production" >&2; exit 1;; esac
cat > .jiffi-skill-state.json <<JSON
{
  "schemaVersion": "1.1",
  "skill": { "name": "jiffi-website-builder", "version": "1.1.0", "startedAt": "${TS}", "lastUpdatedAt": "${TS}" },
  "stage": "${STAGE}",
  "client": { "name": "${CLIENT}", "slug": "${SLUG}", "domain": "${DOMAIN}" },
  "brand": { "mode": null, "repoUrl": null, "packageName": null, "packageVersion": null, "vendored": false },
  "design": { "websiteStyle": null, "designMode": null, "references": [] },
  "phases": {
    "brandAsCode": { "status": "pending", "resources": {} },
    "scaffold": { "status": "pending", "resources": {} },
    "previewVerified": { "status": "pending", "resources": {} },
    "sanity": { "status": "pending", "resources": {} },
    "cloudflare": { "status": "pending", "resources": {} },
    "github": { "status": "pending", "resources": {} },
    "domain": { "status": "pending", "resources": {} },
    "optional": { "status": "pending", "resources": {} }
  },
  "cro": { "enabled": false, "dormantUntilSessions": 500 }
}
JSON
echo "state initialised: stage=${STAGE}"
