#!/usr/bin/env node
/**
 * scripts/palate-pick.mjs - record what the client chose, and what they changed.
 *
 * ====================== WHY THIS EXISTS AT ALL =======================
 *
 * Until this file, the Explore stage produced no number. "Which rung do clients actually pick",
 * "how long does it take them" and "how often do they want a second pass" were all
 * unanswerable, so the most expensive stage of a build could not be argued about with anything
 * but anecdote. A pick recorded here carries the rung, its position on the ladder and the
 * moment it was made, and `boards-render` stamped `explore.shown_at` when the set went out, so
 * time to pick is a subtraction rather than a memory.
 *
 * ==================== AND WHY IT REFUSES SO MUCH =====================
 *
 * Everything downstream trusts this record: Compose lifts the picked components, the fidelity
 * gate measures the built home against the picked board, and the changelog quotes the numbers.
 * A pick naming a board that does not exist is worse than no pick, because it looks like data.
 * So an unregistered id, a rung outside the ladder, a second hero pick without `--replace` and
 * an unreadable canvas extract are each refused with their own message.
 *
 * THE CANVAS IS FEEDBACK, NEVER THE SOURCE OF TRUTH. `--canvas <dir>` diffs the artboards the
 * design skill read back against the ones we seeded and writes `.palate/explore/feedback.json`.
 * Compose must honour the text edits and the notes on the picked surfaces; the style edits are
 * evidence of intent rather than instructions, because a client dragging a font size on a
 * flattened snapshot is saying "bigger", not specifying 72px.
 *
 * Usage:
 *   node scripts/palate-pick.mjs <projectDir> --hero b3 [--section b5] [--cta "Book a table"]
 *        [--intensity 3] [--note "..."] [--canvas <extract-dir>] [--second-pass] [--replace]
 *        [--proof <preview-url>]
 * Exit: 0 recorded, 1 refused (with the reason), 2 bad arguments.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseRegistry } from "./boards-render.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const VALUE_FLAGS = new Set(["--hero", "--section", "--cta", "--intensity", "--note", "--canvas", "--proof"]);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : null; };
const flag = (k) => args.includes(k);
const positional = [];
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith("--")) { if (VALUE_FLAGS.has(args[i])) i++; continue; }
  positional.push(args[i]);
}

const refuse = (reason) => { process.stderr.write(`palate-pick: ${reason}\n`); process.exit(1); };
const badArgs = (reason) => { process.stderr.write(`palate-pick: ${reason}\n`); process.exit(2); };

const dir = resolve(positional[0] || ".");
const registryPath = join(dir, "src/lib/variants.ts");
if (!existsSync(registryPath)) badArgs(`no ${join("src/lib/variants.ts")} under ${dir}. Not an Explore build; nothing recorded.`);

const boards = parseRegistry(readFileSync(registryPath, "utf8"));
if (!boards.length) refuse("no boards are registered in src/lib/variants.ts, so there is nothing to pick.");
const ids = boards.map((b) => b.id).join(", ");
const N = boards.length;

const manifestPath = join(dir, "build-manifest.json");
let manifest = {};
if (existsSync(manifestPath)) {
  try { manifest = JSON.parse(readFileSync(manifestPath, "utf8")); }
  catch { refuse(`${manifestPath} is not readable JSON. Fix or remove it; a pick written beside a broken manifest is a pick nothing will read.`); }
}
const explore = manifest.explore && typeof manifest.explore === "object" ? manifest.explore : {};
const existing = Array.isArray(explore.picks) ? explore.picks.slice() : [];

// --------------------------------------------------------------------------- the picks
const wanted = [];
for (const surface of ["hero", "section"]) {
  const id = opt(`--${surface}`);
  if (id) wanted.push({ surface, id });
}

/**
 * A pick is only ever as good as the entry behind it.
 *
 * The rung comes from the registry, not from the command line, so a pick cannot claim a
 * position the board does not hold. A registry whose rung is outside 1..N is a broken ladder
 * and it is refused HERE rather than recorded and discovered later by the gate that reads it.
 */
function resolvePick(surface, id) {
  const b = boards.find((x) => x.id === id);
  if (!b) refuse(`${id} is not a registered board. Registered: ${ids}.`);
  const rung = Number(b.ambition);
  if (!Number.isFinite(rung) || rung < 1 || rung > N) {
    refuse(`${id} carries rung ${b.ambition}, which is outside 1 to ${N}. The ladder is broken; fix src/lib/variants.ts before recording a pick against it.`);
  }
  if (existing.some((p) => p.surface === surface) && !flag("--replace")) {
    const held = existing.find((p) => p.surface === surface);
    refuse(`a ${surface} pick is already recorded (${held.variant_id}). Pass --replace to change it, so a change of mind is a decision rather than an accident.`);
  }
  return {
    surface,
    variant_id: id,
    rung,
    // The rung divided by the count: a rung number means nothing without the ladder it sat on,
    // and 3 of 5 and 3 of 10 are not the same choice.
    position: Math.round((rung / N) * 1000) / 1000,
    picked_at: new Date().toISOString(),
  };
}

const picks = existing.filter((p) => !wanted.some((w) => w.surface === p.surface));
const made = wanted.map((w) => resolvePick(w.surface, w.id));
picks.push(...made);

// --------------------------------------------------------------- intensity, cta, notes
const patch = { explore: {} };
if (made.length) patch.explore.picks = picks;

const intensityRaw = opt("--intensity");
if (intensityRaw !== null) {
  const n = Number(intensityRaw);
  if (!Number.isInteger(n) || n < 1 || n > 4) {
    refuse(`--intensity ${intensityRaw} is outside 1 to 4. It is the position the client pointed at on the calibration row, not a score.`);
  }
  patch.commission = { intensity_asked: n };
}

const cta = opt("--cta");
if (cta) patch.explore.cta = cta;

const note = opt("--note");
if (note) {
  const on = made[0] || existing[0] || null;
  patch.explore.notes = [
    ...(Array.isArray(explore.notes) ? explore.notes : []),
    { surface: on ? on.surface : "general", variant_id: on ? on.variant_id : null, note, at: new Date().toISOString() },
  ];
}

/**
 * The motion proof: Compose has built the home page and shown it to the client, moving.
 *
 * IT IS A COMMAND BECAUSE THE GATE DEPENDS ON IT. `scripts/gate-done.sh` runs the fidelity gate
 * only once `explore.proof` is recorded, so a model that has to hand-edit JSON to write it is a
 * model that will sometimes not, and every build after Compose would then read
 * `fidelity=skipped` in the done summary with nothing saying a check had been lost. A flag can
 * be named in the doctrine and copied verbatim.
 */
const proofUrl = opt("--proof");
if (proofUrl) {
  if (!/^https?:\/\/\S+$/.test(proofUrl)) {
    refuse(`--proof ${proofUrl} is not a URL. It is the preview the client was shown the home page moving on, so it has to be one they can open.`);
  }
  patch.explore.proof = { url: proofUrl, verified_at: new Date().toISOString() };
}

if (flag("--second-pass")) {
  // COUNTS, never latches. A boolean would answer "did they ask for changes" and lose the
  // question worth asking, which is how many rounds a direction takes before it is settled.
  patch.explore.second_passes = (Number(explore.second_passes) || 0) + 1;
}

// ------------------------------------------------------------------- the canvas read-back
let feedbackCount = null;
const canvasDir = opt("--canvas");
if (canvasDir) {
  const ex = resolve(dir, canvasDir);
  if (!existsSync(ex)) refuse(`--canvas ${canvasDir} does not exist (${ex}). An extract that cannot be read is not a client who changed nothing.`);
  const seedDir = join(dir, ".palate/explore/seed");
  if (!existsSync(seedDir)) refuse(`there is no seed at ${seedDir} to diff against. Run boards-render.mjs before reading a canvas back.`);
  const feedback = diffCanvas(seedDir, ex, boards);
  mkdirSync(join(dir, ".palate/explore"), { recursive: true });
  writeFileSync(join(dir, ".palate/explore/feedback.json"), JSON.stringify(feedback, null, 2) + "\n");
  feedbackCount = feedback.length;
}

// ------------------------------------------------------------------------------- record
if (!made.length && !patch.commission && !patch.explore.cta && !patch.explore.notes
    && !patch.explore.proof && patch.explore.second_passes === undefined && canvasDir === null) {
  badArgs("nothing to record. Pass at least one of --hero, --section, --intensity, --cta, --note, --proof, --second-pass or --canvas.");
}

if (existsSync(manifestPath)) {
  const merge = join(HERE, "manifest-merge.mjs");
  try {
    execFileSync(process.execPath, [merge, "--manifest", manifestPath, "--set", JSON.stringify(patch)], {
      stdio: ["ignore", "ignore", "pipe"],
    });
  } catch (e) {
    refuse(`the manifest could not be written (${(e.stderr || e.message || "").toString().trim().slice(0, 200)}).`);
  }
} else {
  process.stderr.write(`palate-pick: no build-manifest.json at ${manifestPath}; the pick was not recorded anywhere durable.\n`);
}

// -------------------------------------------------------------------------------- report
for (const p of made) {
  const shown = explore.shown_at ? Date.parse(explore.shown_at) : NaN;
  const took = Number.isFinite(shown) ? Math.round((Date.parse(p.picked_at) - shown) / 1000) : null;
  process.stdout.write(
    `palate-pick: ${p.surface} = ${p.variant_id}, rung ${p.rung} of ${N} (position ${p.position})` +
    `${took !== null ? `, time to pick ${took}s` : ", time to pick unknown (no shown_at: boards-render did not stamp this build)"}\n`,
  );
}
if (patch.commission) process.stdout.write(`palate-pick: the client pointed at calibration reference ${patch.commission.intensity_asked}.\n`);
if (patch.explore.cta) process.stdout.write(`palate-pick: call to action "${patch.explore.cta}".\n`);
if (patch.explore.proof) {
  process.stdout.write(
    `palate-pick: motion proof recorded at ${patch.explore.proof.url}. The done gate measures the built home against the picked board from here.\n`,
  );
}
if (patch.explore.second_passes !== undefined) process.stdout.write(`palate-pick: second pass ${patch.explore.second_passes}.\n`);
if (feedbackCount !== null) {
  process.stdout.write(feedbackCount
    ? `palate-pick: ${feedbackCount} change(s) read back from the canvas into .palate/explore/feedback.json. Compose must honour the text edits and the notes on the picked surfaces.\n`
    : "palate-pick: no change was made on the canvas; feedback.json is empty.\n");
}
process.exit(0);

// ============================================================================== the diff

/**
 * What changed between the seed and what came back.
 *
 * The two files descend from the same render, so they can be walked in document order and
 * compared position by position. That is the whole trick and it is why this needs no parser:
 * the canvas edits text and inline styles, it does not restructure a page. When the shapes
 * disagree the common prefix is still compared and the mismatch is SAID, because a diff that
 * quietly gave up looks exactly like a client who changed nothing.
 */
export function diffCanvas(seedDir, extractDir, boards) {
  const out = [];
  const byRung = new Map(boards.map((b) => [Number(b.ambition), b.id]));

  for (const b of boards) {
    const file = `B${b.ambition}.dc.html`;
    const a = join(seedDir, file);
    const z = join(extractDir, file);
    if (!existsSync(a) || !existsSync(z)) continue;
    const before = scanArtboard(readFileSync(a, "utf8"));
    const after = scanArtboard(readFileSync(z, "utf8"));

    if (before.texts.length !== after.texts.length || before.styles.length !== after.styles.length) {
      process.stderr.write(
        `palate-pick: ${file} came back with a different shape (${before.texts.length} to ${after.texts.length} text runs, ` +
        `${before.styles.length} to ${after.styles.length} styled elements). Only the common prefix was compared; ` +
        "read the artboard by hand before Compose.\n",
      );
    }
    const t = Math.min(before.texts.length, after.texts.length);
    for (let i = 0; i < t; i++) {
      if (before.texts[i].text !== after.texts[i].text) {
        out.push({ board: b.id, kind: "text", path: before.texts[i].path, before: before.texts[i].text, after: after.texts[i].text });
      }
    }
    const s = Math.min(before.styles.length, after.styles.length);
    for (let i = 0; i < s; i++) {
      if (before.styles[i].style !== after.styles[i].style) {
        out.push({ board: b.id, kind: "style", path: before.styles[i].path, before: before.styles[i].style, after: after.styles[i].style });
      }
    }
  }

  // The annotations, which are where a client writes a sentence rather than dragging a value.
  const seedCanvas = readJson(join(seedDir, "canvas.json"));
  const backCanvas = readJson(join(extractDir, "canvas.json"));
  if (seedCanvas && backCanvas) {
    const was = new Map((seedCanvas.annotations || []).map((n) => [n.id, n.text]));
    for (const n of backCanvas.annotations || []) {
      const before = was.has(n.id) ? was.get(n.id) : null;
      if (before === n.text) continue;
      out.push({ board: boardForAnnotation(n, backCanvas, byRung), kind: "note", path: n.id, before, after: n.text });
    }
  }
  return out;
}

function readJson(p) { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; } }

/**
 * Which board a note belongs to.
 *
 * An annotation the plugin wrote names its board in its id. One a CLIENT wrote does not, so it
 * is attributed by geometry: the artboard whose horizontal span contains it. A note that
 * belongs to no frame is recorded against the whole set rather than dropped, because an
 * unattributable sentence from a client is still the most valuable line on the canvas.
 */
function boardForAnnotation(note, canvas, byRung) {
  const named = /^board-(.+)$/.exec(note.id || "");
  if (named) return named[1];
  for (const f of canvas.artboards || []) {
    const m = /^B(\d+)\.dc\.html$/.exec(f.file || "");
    if (!m) continue;
    if (note.x >= f.x - 40 && note.x <= f.x + f.w + 40) return byRung.get(Number(m[1])) || null;
  }
  return null;
}

/**
 * Walk an artboard and record its text runs and its inline styles, in document order.
 *
 * The path is an ordinal, `h1[3]`, rather than a CSS selector. A selector would be prettier and
 * would also be a promise this cannot keep: the flattened artboard's classes come from the
 * build and are not stable across a rebuild, where the position of an element in the document
 * is exactly what Compose needs to find it again.
 */
export function scanArtboard(html) {
  const body = /<x-dc\b[^>]*>([\s\S]*)<\/x-dc>/i.exec(html);
  const src = body ? body[1].replace(/<helmet\b[\s\S]*?<\/helmet>/i, "") : html;
  const texts = [];
  const styles = [];
  const counts = new Map();
  let last = null;
  const re = /<\/?([a-zA-Z][\w-]*)\b([^>]*)>|([^<]+)/g;
  let m;
  while ((m = re.exec(src))) {
    if (m[3] !== undefined) {
      const text = m[3].replace(/\s+/g, " ").trim();
      if (text && last) texts.push({ path: last, text });
      continue;
    }
    const tag = m[1].toLowerCase();
    if (m[0].startsWith("</")) { last = null; continue; }
    if (tag === "script" || tag === "style") { last = null; continue; }
    const n = (counts.get(tag) || 0);
    counts.set(tag, n + 1);
    const path = `${tag}[${n}]`;
    last = path;
    const st = /\bstyle\s*=\s*"([^"]*)"/i.exec(m[2] || "");
    if (st) styles.push({ path, style: st[1] });
  }
  return { texts, styles };
}
