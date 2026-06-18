#!/usr/bin/env node
/**
 * hooks/palate-stop.mjs - make "done" machine-checkable from evidence (Stop hook).
 *
 * Registered at the user level. Guards against loops with `stop_hook_active`. It
 * only acts on a real build (a build-manifest.json that recorded source writes);
 * non-build sessions pass untouched. On a real build it runs, in order:
 *   1. the MCP-depth gate (gate-mcp-depth.sh)  - KEEP THE FLOOR, unchanged behaviour.
 *   2. the DONE gate (gate-done.sh)            - the VISUAL loop ran + passed
 *      (screenshots on disk, zero console errors, every rubric axis cleared the bar)
 *      AND the fresh-context palate-verifier ran + returned verdict:pass. It reads the
 *      real ARTEFACTS (verify-report.json, .palate-shots/*), never a manifest boolean
 *      an LLM could have set - anti-reward-hacking is the whole point.
 *   3. fold the computed verdicts into build-manifest.json (manifest-merge.mjs) so the
 *      manifest's visual/verifier blocks are a cache of computed evidence.
 *
 * Both gates FAIL OPEN: each skips (exit 0) when it cannot run - no jq, no manifest, no
 * MCP calls (MCP not connected / surveyed in a subagent), and (gate-done only) no
 * renderable preview (no dist/ and no verify-report.json). So enforcement fires ONLY
 * on a build that COULD have been verified and was not - never on a public-plugin user
 * whose token is not set or who is editing an existing app.
 *
 * Enforcement split (the "enforce-when-possible" default): the GATES enforce when they
 * CAN (renderable + MCP connected); the HOOK stays nudge-by-default. On any gate
 * failure: by DEFAULT allow finishing with a loud non-blocking reminder; HARD-BLOCK
 * (decision:"block") only under PALATE_GATE_STRICT=1. recordBuild runs ONLY after ALL
 * gates pass, so a build that fails the loop is not written to cross-build memory.
 *
 * Escape hatch: PALATE_GATE_OFF=1. Hard enforcement: PALATE_GATE_STRICT=1.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GATE = path.join(HERE, "..", "scripts", "gate-mcp-depth.sh");
const DONE_GATE = path.join(HERE, "..", "scripts", "gate-done.sh");
const MERGE = path.join(HERE, "..", "scripts", "manifest-merge.mjs");
const SOURCE = /\.(astro|svelte|vue|tsx?|jsx?|mjs|css|scss)$/i;

function readStdin() {
  try {
    const raw = fs.readFileSync(0, "utf8");
    return raw.trim() ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Pull the display FACE names a rendered variant actually used, so cross-build
// type-face recurrence (the smell gate-novelty.mjs catches) has data. The recurring
// FACE across unrelated builds is the tell, not the family - see references/type-
// selection.md. Normalise each declaration's first family + Google-Fonts link families
// to a bare lower-case token; drop the generic fallbacks.
function facesFromHtml(html) {
  const faces = new Set();
  const GENERIC = new Set(["serif", "sans-serif", "monospace", "system-ui", "ui-sans-serif", "ui-serif", "ui-monospace", "inherit", "initial", "unset", ""]);
  // Capture the whole value up to ; or } (quotes included) so a quoted first family is read.
  for (const m of html.matchAll(/font-family\s*:\s*([^;}]+)/gi)) {
    const f = m[1].replace(/['"]/g, "").split(",")[0].trim().toLowerCase().replace(/\s+/g, " ");
    if (!GENERIC.has(f) && !f.startsWith("var(")) faces.add(f);
  }
  for (const m of html.matchAll(/family=([A-Za-z0-9+]+)/g)) {
    const f = m[1].replace(/\+/g, " ").trim().toLowerCase();
    if (!GENERIC.has(f)) faces.add(f);
  }
  return [...faces];
}

function recordBuild(manifest) {
  try {
    const m = JSON.parse(fs.readFileSync(manifest, "utf8"));
    const dir = path.join(os.homedir(), ".config", "palate");
    fs.mkdirSync(dir, { recursive: true });
    const log = path.join(dir, "builds.log.json");
    let entries = [];
    try {
      entries = JSON.parse(fs.readFileSync(log, "utf8"));
    } catch {
      // Back-compat: migrate the v1 jiffi-namespaced log on first write.
      try {
        entries = JSON.parse(
          fs.readFileSync(path.join(os.homedir(), ".config", "jiffi", "builds.log.json"), "utf8"),
        );
      } catch {
        entries = [];
      }
    }
    // Record the display faces used, read from the rendered variant HTML the manifest
    // points at, so type-face recurrence is computable across builds. Best-effort: a
    // missing/unreadable variant file just contributes no faces.
    const faces = new Set();
    const mdir = path.dirname(manifest);
    for (const v of Array.isArray(m.variants) ? m.variants : []) {
      const hp = v && v.html_path;
      if (typeof hp !== "string") continue;
      const abs = path.isAbsolute(hp) ? hp : path.join(mdir, hp);
      try {
        for (const f of facesFromHtml(fs.readFileSync(abs, "utf8"))) faces.add(f);
      } catch {
        /* variant file gone; skip */
      }
    }
    entries.push({
      ts: new Date().toISOString(),
      business: m.business ?? null,
      signature_move: m.signature_move ?? null,
      donors: m.references_surveyed ?? [],
      faces: [...faces],
    });
    fs.writeFileSync(log, JSON.stringify(entries, null, 2) + "\n");
  } catch {
    /* memory is best-effort; never block finishing over it */
  }
}

const p = readStdin() || {};
if (p.stop_hook_active === true || process.env.PALATE_GATE_OFF === "1") process.exit(0);

const cwd = p.cwd || process.cwd();
const manifest = path.join(cwd, "build-manifest.json");
if (!fs.existsSync(manifest)) process.exit(0); // not a build session

// Only gate a real build (one that wrote source files).
try {
  const m = JSON.parse(fs.readFileSync(manifest, "utf8"));
  const wroteSource = (m.files_written ?? []).some((f) => SOURCE.test(f));
  if (!wroteSource) process.exit(0);
} catch {
  process.exit(0);
}

// Fold the COMPUTED verdicts from the artefacts into the manifest before gating, so
// the visual/verifier cache blocks are fresh. Best-effort and never fatal: the gates
// read the artefacts directly as the source of truth, so a merge miss cannot weaken
// or strengthen the verdict.
try {
  execFileSync("node", [MERGE, "--manifest", manifest], { cwd, stdio: ["ignore", "ignore", "ignore"] });
} catch {
  /* merge is a cache convenience; never block finishing over it */
}

try {
  execFileSync("bash", [GATE, manifest], { stdio: ["ignore", "ignore", "pipe"] }); // existing depth gate - KEEP THE FLOOR
  execFileSync("bash", [DONE_GATE, manifest], { stdio: ["ignore", "ignore", "pipe"] }); // NEW: visual loop + verifier (reads artefacts, fails open)
  recordBuild(manifest); // MOVED: only record the build to cross-build memory after ALL gates pass
  process.exit(0);
} catch (e) {
  const reason =
    (e.stderr ? e.stderr.toString() : "").trim() ||
    "Palate gate: this build is not done - it did not draw on the library deeply enough, or the visual loop / verifier has not passed.";
  // Hard enforcement is opt-in. By DEFAULT never block finishing — blocking traps a
  // session that cannot satisfy the gate (MCP not connected, surveyed in a subagent).
  // Surface a non-blocking reminder instead so the build is still nudged toward depth.
  if (process.env.PALATE_GATE_STRICT === "1") {
    process.stdout.write(JSON.stringify({ decision: "block", reason }));
    process.exit(0);
  }
  process.stderr.write(`[palate] ${reason}\n(Set PALATE_GATE_STRICT=1 to enforce this as a hard gate.)\n`);
  process.exit(0);
}
