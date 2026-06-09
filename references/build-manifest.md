# The build manifest (`build-manifest.json`)

The machine-readable record of what a build actually did, written to the project
root during a build by the PostToolUse hook (`hooks/palate-manifest.mjs`). It is
populated from real tool **telemetry**, not the agent's narration, so the gates
that read it cannot be talked around. Every enforcement gate hangs off this file.

## Schema

```jsonc
{
  "schema": 1,
  "created_at": "ISO-8601",
  "business": "free-text brief (optional; the agent may set it)",
  "signature_move": { "name": "...", "source_slug": "..." },  // optional, agent-set
  "mcp_calls": [
    { "tool": "mcp__palate__refs_search", "args": { ... }, "slugs": ["..."], "ts": "..." }
  ],
  "references_surveyed": ["slug", "..."],        // unique slugs seen across all calls
  "inner_pages_viewed": [{ "slug": "...", "page": "pricing" }],
  "files_written": ["src/pages/index.astro", "..."],
  "sections": []                                  // optional, agent-set: section -> donor provenance
}
```

- **`mcp_calls`**, **`references_surveyed`**, **`inner_pages_viewed`**, **`files_written`**
  are written automatically by the hook (telemetry). The hook reads the tool result
  (`tool_response`) and harvests every `slug` it returned, including slugs inside
  stringified-JSON MCP text blocks.
- **`business`**, **`signature_move`**, **`sections`** are optional and may be set by
  the agent/surveyor to record intent; the depth gate cross-checks them against the
  telemetry (e.g. a declared signature move's `source_slug` must appear in
  `references_surveyed`).

## What reads it

`scripts/gate-mcp-depth.sh` (the portable gate) asserts the build surveyed enough
references, read some deeply (`refs_get`), viewed enough inner pages, and used a
spread of tools. The Pre/Stop hooks call that gate. Thresholds are overridable via
`PALATE_MIN_REFS` / `PALATE_MIN_INNER` / `PALATE_MIN_TOOLS`.
