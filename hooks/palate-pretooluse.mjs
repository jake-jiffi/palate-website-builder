#!/usr/bin/env node
/**
 * hooks/palate-pretooluse.mjs - nudge a build toward the library before it writes
 * uninformed source (PreToolUse).
 *
 * Registered at the user level, matched on `Write|MultiEdit`. NON-BLOCKING by
 * default: it allows every write (the depth nudge is delivered by the skill and the
 * Stop hook), so it can never trap a session whose Palate MCP is not connected, who
 * is editing an existing app, or who surveyed in a subagent. Set PALATE_GATE_STRICT=1
 * to make it HARD-BLOCK the first uninformed NEW source write (.astro/.ts/.css/...);
 * even then it fails OPEN when the gate cannot be satisfied (no manifest / no MCP
 * calls), and reads/Edits/config/non-source always pass.
 *
 * Escape hatch: PALATE_GATE_OFF=1.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GATE = path.join(HERE, "..", "scripts", "gate-mcp-depth.sh");
const SOURCE = /\.(astro|svelte|vue|tsx?|jsx?|mjs|css|scss)$/i;
const CONFIG = /(^|\/)(astro|tailwind|vite|postcss|package|tsconfig|eslint)\.[a-z.]+$/i;

function readStdin() {
  try {
    const raw = fs.readFileSync(0, "utf8");
    return raw.trim() ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function allow() {
  process.exit(0);
}

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    }),
  );
  process.exit(0);
}

const p = readStdin();
if (!p || process.env.PALATE_GATE_OFF === "1") allow();

const tool = p.tool_name || "";
if (tool !== "Write" && tool !== "MultiEdit") allow();

const input = p.tool_input || {};
const fp = input.file_path || input.filePath || input.path || "";
if (!SOURCE.test(fp)) allow(); // non-source: scaffolding, config, notes, the manifest
if (CONFIG.test(fp)) allow();

// Public default: NEVER block a write. The depth gate is a nudge, not a wall —
// hard-blocking a write traps anyone whose Palate MCP is not connected, who is
// editing an existing app, or who surveyed in a subagent. Opt into hard enforcement
// (block the first uninformed source write) with PALATE_GATE_STRICT=1.
if (process.env.PALATE_GATE_STRICT !== "1") allow();

const cwd = p.cwd || process.cwd();
try {
  execFileSync("bash", [GATE, path.join(cwd, "build-manifest.json")], {
    stdio: ["ignore", "ignore", "pipe"],
  });
  allow();
} catch (e) {
  const reason =
    (e.stderr ? e.stderr.toString() : "").trim() ||
    'MCP-depth gate failed: survey the library first: refs_search with concrete lexical terms (a font, "GSAP", "preloader", the business category), then refs_get your donors with a layer (signature_moves / do_dont / component_prompts) or format:design before writing code.';
  deny(reason);
}
