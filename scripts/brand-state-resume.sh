#!/usr/bin/env bash
# Print the first non-complete step, or "all-complete", or "no-state".
set -euo pipefail
[ -f .jiffi-brand-state.json ] || { echo "no-state"; exit 0; }
for step in repoCreated assetsInventoried assetsCopied tokensGenerated fontsCssWritten componentsWritten examplesWritten docsWritten metaFilesWritten packagePublished pushed; do
  status=$(jq -r --arg s "$step" '.steps[$s]' .jiffi-brand-state.json)
  if [ "$status" != "complete" ]; then echo "$step"; exit 0; fi
done
echo "all-complete"
