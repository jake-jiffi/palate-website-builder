#!/usr/bin/env node
/**
 * hooks/palate-stop.mjs - don't let the agent finish a build that never reached
 * MCP depth (Stop hook).
 *
 * Registered at the user level. Guards against loops with `stop_hook_active`. It
 * only acts on a real build (a build-manifest.json that recorded source writes);
 * non-build sessions pass untouched. On a real build it runs the portable depth
 * gate: pass -> allow + record the build to cross-build memory; fail -> block
 * with the gate's reason so the agent keeps going.
 *
 * Escape hatch: PALATE_GATE_OFF=1.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GATE = path.join(HERE, "..", "scripts", "gate-mcp-depth.sh");
const SOURCE = /\.(astro|svelte|vue|tsx?|jsx?|mjs|css|scss)$/i;

function readStdin() {
  try {
    const raw = fs.readFileSync(0, "utf8");
    return raw.trim() ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
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
    entries.push({
      ts: new Date().toISOString(),
      business: m.business ?? null,
      signature_move: m.signature_move ?? null,
      donors: m.references_surveyed ?? [],
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

try {
  execFileSync("bash", [GATE, manifest], { stdio: ["ignore", "ignore", "pipe"] });
  recordBuild(manifest);
  process.exit(0);
} catch (e) {
  const reason =
    (e.stderr ? e.stderr.toString() : "").trim() ||
    "MCP-depth gate failed: the build did not draw on the library deeply enough to finish.";
  process.stdout.write(JSON.stringify({ decision: "block", reason }));
  process.exit(0);
}
