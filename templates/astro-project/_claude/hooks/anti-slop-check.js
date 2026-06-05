#!/usr/bin/env node
/**
 * .claude/hooks/anti-slop-check.js - the project-level aesthetic gate.
 *
 * Ships in templates/astro-project/_claude/ in the skill; Phase A renames
 * `_claude/` to `.claude/` (merging with the existing `.claude/` content) so
 * the final project carries this at `.claude/hooks/anti-slop-check.js`.
 *
 * Fires on every Edit / Write / MultiEdit (wired in .claude/settings.local.json).
 * Reads the tool-call payload from stdin, checks the affected file content
 * against the Critical-severity subset of the skill's anti-patterns, and exits
 * non-zero to block the edit if a Critical violation is introduced.
 *
 * The full rule set lives in the skill at references/anti-patterns.md and is
 * run at build time by scripts/ux-lint.sh. This hook is the lifecycle
 * counterpart - it stops a bad pattern from being committed by a client team's
 * own Claude Code session after Jiffi has handed the project over.
 *
 * Per-line escape: add a `ux-lint-disable <rule-id>` comment on the same or
 * preceding line; `ux-lint-disable-all` exempts the line entirely.
 *
 * Exit codes: 0 allow, 2 block (Claude sees the message and revises).
 *
 * Note: written as ESM (`import`) because the host project's package.json
 * declares `"type": "module"`.
 */

import fs from "node:fs";

const RULES = [
  { id: "no-em-dash", files: /\.(astro|css|ts|tsx|mjs|md|mdx|json)$/, pattern: /—/, fix: "Em dashes are not house style. Use \" - \" (spaced hyphen), a comma, parentheses, or a colon." },
  { id: "banned-display-inter", files: /\.(css|ts|tsx|astro|mjs)$/, pattern: /font-family\s*:\s*['"]?Inter/i, fix: "Inter is the AI-default display font. Use the brand package's display family." },
  { id: "banned-display-roboto", files: /\.(css|ts|tsx|astro|mjs)$/, pattern: /font-family\s*:\s*['"]?Roboto/i, fix: "Roboto is the Material default; banned as a marketing-site display." },
  { id: "banned-display-arial", files: /\.(css|ts|tsx|astro|mjs)$/, pattern: /font-family\s*:\s*['"]?Arial/i, fix: "Arial as the primary display signals no opinion. Use the brand package." },
  { id: "banned-display-space-grotesk", files: /\.(css|ts|tsx|astro|mjs)$/, pattern: /font-family\s*:\s*['"]?Space Grotesk/i, fix: "Space Grotesk is overused; pick something the brand actually chose." },
  { id: "gradient-purple-to-pink", files: /\.(css|ts|tsx|astro)$/, pattern: /(linear|radial)-gradient\([^)]*purple[^)]*pink/i, fix: "Purple-to-pink linear gradients are the AI hero default. Pick a single brand colour and use weight, contrast and composition." },
  { id: "gradient-pink-to-purple", files: /\.(css|ts|tsx|astro)$/, pattern: /(linear|radial)-gradient\([^)]*pink[^)]*purple/i, fix: "Same as the reverse direction; remove or replace." },
  { id: "ai-tell-leverage", files: /\.(md|mdx|astro|ts|tsx)$/, pattern: /\bleverage(s|d|ing)?\b/i, fix: "\"Leverage\" is the highest-frequency AI tell. Use \"use\", \"apply\", or name the action." },
  { id: "ai-tell-fast-paced", files: /\.(md|mdx|astro|ts|tsx)$/, pattern: /in today'?s fast-?paced/i, fix: "Pure boilerplate. Open with a specific observation about the reader's situation." },
  { id: "ai-tell-let-dive", files: /\.(md|mdx|astro|ts|tsx)$/, pattern: /let'?s dive (in|into)/i, fix: "Tutorial template language. Replace with the actual first step, named directly." },
  { id: "ai-tell-game-changer", files: /\.(md|mdx|astro|ts|tsx)$/, pattern: /game[- ]chang(er|ing)/i, fix: "Empty intensifier. Either delete or replace with the concrete change." },
  { id: "ai-tell-synergy", files: /\.(md|mdx|astro|ts|tsx)$/, pattern: /synerg(y|ies|istic)/i, fix: "Corporate filler. Say what two things actually do together." },
  { id: "ai-tell-unleash", files: /\.(md|mdx|astro|ts|tsx)$/, pattern: /\bunleash/i, fix: "Marketing cliche. Say \"let people do X\" or describe the action." },
];

function readStdinJson() {
  let raw = "";
  try { raw = fs.readFileSync(0, "utf8"); } catch { return null; }
  if (!raw.trim()) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function extractFilePath(payload) {
  if (!payload || typeof payload !== "object") return null;
  const ti = payload.tool_input || {};
  return ti.file_path || ti.filePath || ti.path || null;
}

function readFileSafe(p) {
  try { return fs.readFileSync(p, "utf8"); } catch { return null; }
}

function fileMatches(p) {
  const skip = ["/node_modules/", "/.git/", "/dist/", "/.astro/", "/.wrangler/", "/_explore-archive/"];
  for (const s of skip) if (p.includes(s)) return false;
  return true;
}

function findViolations(filePath, content) {
  const out = [];
  const lines = content.split("\n");
  for (const rule of RULES) {
    if (!rule.files.test(filePath)) continue;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes(`ux-lint-disable ${rule.id}`)) continue;
      if (line.includes("ux-lint-disable-all")) continue;
      if (i > 0 && lines[i - 1].includes(`ux-lint-disable ${rule.id}`)) continue;
      if (rule.pattern.test(line)) {
        out.push({ rule: rule.id, line: i + 1, text: line.trim(), fix: rule.fix });
      }
    }
  }
  return out;
}

const payload = readStdinJson();
const filePath = extractFilePath(payload);
if (!filePath || !fileMatches(filePath)) process.exit(0);
const content = readFileSafe(filePath);
if (content == null) process.exit(0);
const violations = findViolations(filePath, content);
if (violations.length === 0) process.exit(0);

console.error(`[anti-slop] ${violations.length} Critical violation(s) in ${filePath}:`);
for (const v of violations) {
  console.error(`  ${filePath}:${v.line}  [${v.rule}]  ${v.text}`);
  console.error(`    Fix: ${v.fix}`);
}
console.error("");
console.error("Per-line escape: add comment `ux-lint-disable <rule-id>` on the same or preceding line.");
process.exit(2);
