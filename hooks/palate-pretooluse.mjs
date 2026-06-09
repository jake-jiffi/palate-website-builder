#!/usr/bin/env node
/**
 * hooks/palate-pretooluse.mjs - block the first real code write until the build
 * has actually researched the library (PreToolUse).
 *
 * Registered at the user level, matched on `Write|MultiEdit`. It only gates NEW
 * source content (.astro/.ts/.css/...); reads, Edits of existing files, config,
 * the manifest itself, and non-source files pass (the Explore / tiny-reversible
 * carve-outs), so it never deadlocks scaffolding. When it does gate, it runs the
 * portable depth gate and denies with that gate's specific reason.
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

const cwd = p.cwd || process.cwd();
try {
  execFileSync("bash", [GATE, path.join(cwd, "build-manifest.json")], {
    stdio: ["ignore", "ignore", "pipe"],
  });
  allow();
} catch (e) {
  const reason =
    (e.stderr ? e.stderr.toString() : "").trim() ||
    "MCP-depth gate failed: survey the library (refs_search, refs_get, refs_get_screenshot) before writing code.";
  deny(reason);
}
