#!/usr/bin/env node
/**
 * scripts/eval-runner.mjs - the two-plane eval harness (S2 step 7).
 *
 * Scores a finished build on two planes and emits a JSON verdict, so quality is a
 * measured outcome, not narration. The DETERMINISTIC gates are authoritative here; an
 * LLM judge (the visual rubric gate, run by palate-verifier) is advisory and lives
 * outside this script.
 *
 *   PROCESS plane (from build-manifest.json): did the build actually draw on the
 *     library with depth - refs surveyed, a rich taste/craft layer pulled, inner-page
 *     coverage, donor diversity, the signature move sourced.
 *   OUTPUT plane (from the rendered variant HTML): are the variants genuinely distinct
 *     (uniqueness gate) and free of slop patterns / AI-tell copy.
 *
 * Usage: node scripts/eval-runner.mjs --manifest build-manifest.json --variants a.html b.html [...]
 * Prints a JSON report to stdout. Exit 0 = both planes pass, 2 = a gate failed.
 */
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const list = (k) => { const i = args.indexOf(k); if (i < 0) return []; const out = []; for (let j = i + 1; j < args.length && !args[j].startsWith("--"); j++) out.push(args[j]); return out; };

const manifestPath = arg("--manifest") ?? "build-manifest.json";
const variants = list("--variants");

const RICH = new Set(["signature_moves", "do_dont", "component_prompts", "design", "pages"]);
const AI_TELLS = /\b(leverage|seamless|game-?changer|elevate your|unlock|robust|effortless|delve|in the realm of|it's worth noting|testament to|cutting-edge|best-in-class)\b/i;

// ---- PROCESS plane -------------------------------------------------------
function processPlane() {
  if (!existsSync(manifestPath)) return { pass: false, score: 0, reasons: ["no build-manifest.json"] };
  const m = JSON.parse(readFileSync(manifestPath, "utf8"));
  const refs = new Set(m.references_surveyed ?? []).size;
  const inner = (m.inner_pages_viewed ?? []).length;
  const calls = m.mcp_calls ?? [];
  const tools = new Set(calls.map((c) => c.tool)).size;
  const richLayers = new Set();
  for (const c of calls) {
    if (c.tool !== "mcp__palate__refs_get") continue;
    const ls = Array.isArray(c.args?.layer) ? c.args.layer : (c.args?.layer ? [c.args.layer] : []);
    if (c.args?.format === "design") ls.push("design");
    for (const l of ls) if (RICH.has(l)) richLayers.add(l);
  }
  const sigSourced = !!(m.signature_move && m.signature_move.source_slug && (m.references_surveyed ?? []).includes(m.signature_move.source_slug));
  const checks = {
    refsSurveyed: refs >= 8,
    richLayer: richLayers.size >= 1,
    innerPages: inner >= 3,
    toolSpread: tools >= 3,
    signatureSourced: sigSourced || m.signature_move == null,
  };
  const passed = Object.values(checks).filter(Boolean).length;
  return {
    pass: Object.values(checks).every(Boolean),
    score: Math.round((passed / Object.keys(checks).length) * 100),
    metrics: { refs, inner, tools, richLayers: [...richLayers] },
    checks,
    reasons: Object.entries(checks).filter(([, v]) => !v).map(([k]) => `process: ${k} failed`),
  };
}

// ---- OUTPUT plane --------------------------------------------------------
function outputPlane() {
  const reasons = [];
  // uniqueness (deterministic gate)
  let uniquePass = null;
  if (variants.length >= 2) {
    try { execFileSync("node", [join(HERE, "gate-uniqueness.mjs"), ...variants], { stdio: "pipe" }); uniquePass = true; }
    catch { uniquePass = false; reasons.push("output: variants are near-duplicates (uniqueness gate)"); }
  }
  // slop / AI-tell scan over the rendered copy (visible text only is ideal; here a
  // whole-file scan is a cheap floor - the visual rubric gate is the real judge)
  const slop = [];
  for (const f of variants) {
    if (!existsSync(f)) continue;
    const raw = readFileSync(f, "utf8");
    // Scan VISIBLE copy only: strip script/style blocks and HTML comments, then tags,
    // so an AI-tell word in a code comment ("Robust:") is not a false positive.
    const html = raw
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ");
    if (AI_TELLS.test(html)) slop.push(`${f.split("/").pop()}: AI-tell copy`);
    // gradient-hero needs the raw CSS + markup (a purple/pink gradient near an h1).
    if (/linear-gradient\([^)]*\)[^;]*;[\s\S]{0,400}<h1/i.test(raw) && /purple|#8b5cf6|#a855f7|#d946ef|#ec4899/i.test(raw)) slop.push(`${f.split("/").pop()}: purple-pink gradient hero`);
  }
  if (slop.length) reasons.push(...slop.map((s) => "output: " + s));
  return {
    pass: (uniquePass !== false) && slop.length === 0,
    uniqueness: uniquePass,
    slop,
    reasons,
  };
}

const proc = processPlane();
const out = outputPlane();
const report = {
  process: proc,
  output: out,
  verdict: proc.pass && out.pass ? "pass" : "fail",
  note: "deterministic planes; the visual 6-axis rubric gate (palate-verifier) is the advisory output judge",
};
console.log(JSON.stringify(report, null, 2));
process.exit(report.verdict === "pass" ? 0 : 2);
