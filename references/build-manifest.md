# The build manifest (`build-manifest.json`)

The machine-readable record of what a build actually did, written to the project
root during a build by the PostToolUse hook (`hooks/palate-manifest.mjs`). It is
populated from real tool **telemetry**, not the agent's narration, so the gates
that read it cannot be talked around. Every enforcement gate hangs off this file.

## Schema

```jsonc
{
  "schema": 3,
  "created_at": "ISO-8601",
  "business": "free-text brief (optional; the agent may set it)",
  "signature_move": { "name": "...", "source_slug": "..." },  // optional, agent-set
  "mcp_calls": [
    { "tool": "mcp__palate__refs_search", "args": { ... }, "slugs": ["..."], "ts": "..." }
  ],
  "references_surveyed": ["slug", "..."],        // unique slugs seen across all calls
  "inner_pages_viewed": [{ "slug": "...", "page": "pricing" }],
  "layers_read": ["signature_moves", "do_dont", "..."], // R2: rich refs_get layers pulled
  "files_written": ["src/pages/index.astro", "..."],
  "sections": [],                                 // optional, agent-set: section -> donor provenance

  // --- schema 3 evidence blocks (the divergent spine + visual loop) ---
  // The agent may set the DESCRIPTIVE fields it genuinely knows; every pass/fail
  // verdict is computed by a script from a real artefact and folded in by
  // scripts/manifest-merge.mjs. The hook NEVER sets a pass/fail.
  "diverge": null,      // { ran, n, concepts:[{ id, mechanic, lens, analogical_seed, conventionality:0..1, self_tag }] }
  "converge": null,     // { ran, scored:[{ id, originality:0..5, craft_feasibility:0..5, combined:0..5 }], advanced:[id,...] }
  "commission": null,   // A.3.5: { bar, concept, vision, chosen_mechanisms:[{ name, recipe, precedent_slug, astro_recipe_pulled, fit_reason }], proof:{ viewports, read_pixels, read_console, mobile_friendly, holds_60fps, honours_reduced_motion }, restraint_note } - agent-set descriptive only
  "variants": [],       // [{ id, route, name, concept_id, donor_slugs:[], html_path }]
  "visual": null,       // SCRIPT-set: { ran, pass, iterations:[{ i, shots:{...}, axes:{...}, defects:[{type,location}], score }], console_errors:int }
  "novelty": null,      // SCRIPT-set: { ran, pass, closest_pair, struct, style, category_distance, recent_build_distance }
  "verifier": null,     // SCRIPT-set: { ran, pass, verdict, report_path }
  "buildability": null  // { ran, mechanics:[{ name, precedent_slug, astro_recipe_pulled:bool, feasible:bool, fallback }] }
}
```

- **`mcp_calls`**, **`references_surveyed`**, **`inner_pages_viewed`**, **`layers_read`**,
  **`files_written`** are written automatically by the hook (telemetry). The hook reads
  the tool result (`tool_response`) and harvests every `slug` it returned, including
  slugs inside stringified-JSON MCP text blocks.
- **`business`**, **`signature_move`**, **`sections`** are optional and may be set by
  the agent/surveyor to record intent; the depth gate cross-checks them against the
  telemetry (e.g. a declared signature move's `source_slug` must appear in
  `references_surveyed`).
- **The schema-3 evidence blocks** record the divergent-then-convergent concept spine
  (`diverge`, `converge`), the **build commission** (`commission`, the ambition bar +
  the chosen toolkit made explicit at A.3.5 - `references/build-commission.md`), the
  Explore variants and their donors (`variants`), the buildability oracle
  (`buildability`), and the COMPUTED verdicts of the visual loop, the novelty check and
  the verifier (`visual`, `novelty`, `verifier`). The agent sets the descriptive parts
  (concepts, scores, donor slugs, the commission's bar / concept / vision / chosen
  mechanisms / proof requirements); the `pass`/`fail` inside `visual`/`novelty`/`verifier`
  is set ONLY by a script reading a real artefact (screenshots, rendered HTML, a gate's
  exit code), never by an LLM boolean. The commission's ambition bar is likewise judged
  by the verifier from the render, not self-claimed in the manifest. This is the
  anti-reward-hacking rule: "done" is machine-checkable, not self-claimed.
- A schema-1/2 manifest is upgraded in place on the next hook write: the new blocks
  (including `commission`) are added (null / empty) without touching any existing field,
  and `schema` becomes 3. `commission` is additive within schema 3: a schema-3 manifest
  written before it existed gets `commission: null` backfilled on the next hook write,
  no schema bump.
- Note: the manifest `sections` field is the section -> donor provenance map (which
  donor each section came from). It is UNRELATED to the `refs_get` `layer` arg, which
  is the renamed retrieval selector (concept / pages / tokens / signature_moves / ...).

## What reads it

`scripts/gate-mcp-depth.sh` (the portable gate) asserts the build surveyed enough
references, read some deeply (`refs_get`), viewed enough inner pages, and used a
spread of tools. The Pre/Stop hooks call that gate. Thresholds are overridable via
`PALATE_MIN_REFS` / `PALATE_MIN_INNER` / `PALATE_MIN_TOOLS`.
