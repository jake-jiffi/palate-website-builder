#!/usr/bin/env node
/**
 * hooks/palate-manifest.mjs - the build-manifest keystone (PostToolUse).
 *
 * Registered at the USER level (~/.claude/settings.json) by scripts/install.sh,
 * matched on `mcp__palate__.*` and `Edit|Write|MultiEdit`. On every matched tool
 * call it appends real telemetry to `build-manifest.json` at the project root
 * (cwd), so the depth gate reads what the build ACTUALLY did, not what the agent
 * claims. This is the source of truth every other gate hangs off.
 *
 * PostToolUse delivers the tool RESULT in the payload. The field is `tool_response`
 * in current Claude Code; we also read `tool_output`/`toolResponse` defensively so
 * a field-name change cannot silently empty the manifest.
 *
 * Never blocks (PostToolUse cannot). Exit 0 always; failures are swallowed so the
 * hook can never wedge a build.
 */
import fs from "node:fs";
import path from "node:path";

const MANIFEST = path.join(process.cwd(), "build-manifest.json");

function readStdin() {
  try {
    const raw = fs.readFileSync(0, "utf8");
    return raw.trim() ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function load() {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  } catch {
    return null;
  }
}

function blank() {
  return {
    schema: 1,
    created_at: new Date().toISOString(),
    business: null,
    signature_move: null,
    mcp_calls: [],
    references_surveyed: [],
    inner_pages_viewed: [],
    files_written: [],
    sections: [],
  };
}

// Walk an arbitrary tool result and collect every `slug` string it contains.
function collectSlugs(node, out) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const x of node) collectSlugs(x, out);
    return;
  }
  for (const [k, v] of Object.entries(node)) {
    if (k === "slug" && typeof v === "string") out.add(v);
    else collectSlugs(v, out);
  }
}

// MCP results often arrive as { content: [{ type:'text', text:'<json>' }] }; the
// slugs live inside that stringified JSON, so parse text blocks too.
function collectFromMcpResult(result, out) {
  collectSlugs(result, out);
  const blocks = result && Array.isArray(result.content) ? result.content : [];
  for (const b of blocks) {
    if (b && b.type === "text" && typeof b.text === "string") {
      try {
        collectSlugs(JSON.parse(b.text), out);
      } catch {
        /* not JSON; ignore */
      }
    }
  }
}

function main() {
  const p = readStdin();
  if (!p) return;
  const tool = p.tool_name || "";
  const input = p.tool_input || {};
  const result = p.tool_response ?? p.tool_output ?? p.toolResponse ?? null;

  const m = load() ?? blank();

  if (tool.startsWith("mcp__palate__")) {
    const slugs = new Set();
    collectFromMcpResult(result, slugs);
    if (typeof input.slug === "string") slugs.add(input.slug);
    if (Array.isArray(input.slugs)) for (const s of input.slugs) if (typeof s === "string") slugs.add(s);
    const slugList = [...slugs];
    m.mcp_calls.push({ tool, args: input, slugs: slugList, ts: new Date().toISOString() });
    for (const s of slugList) if (!m.references_surveyed.includes(s)) m.references_surveyed.push(s);
    // An inner-page view = looking at a specific inner page screenshot.
    if (tool === "mcp__palate__refs_get_screenshot" && input.page && input.slug) {
      const seen = m.inner_pages_viewed.some((v) => v.slug === input.slug && v.page === input.page);
      if (!seen) m.inner_pages_viewed.push({ slug: input.slug, page: input.page });
    }
  } else if (tool === "Write" || tool === "Edit" || tool === "MultiEdit") {
    const fp = input.file_path || input.filePath || input.path;
    if (fp && !m.files_written.includes(fp)) m.files_written.push(fp);
  } else {
    return; // not a tool we track
  }

  try {
    fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + "\n");
  } catch {
    /* never wedge a build over a manifest write */
  }
}

main();
process.exit(0);
