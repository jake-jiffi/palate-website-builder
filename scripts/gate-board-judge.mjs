#!/usr/bin/env node
/**
 * scripts/gate-board-judge.mjs - every Explore board is compared with its own donor.
 *
 * ========================== WHAT IT IS PROTECTING ==========================
 *
 * Canvas-first Explore makes the boards fast and complete. It does not make them GOOD. The
 * visual rubric that every board already clears measures hygiene: on the eastcoast v2 build five
 * boards scored 25 to 28 out of 30 and were bland. The one instrument that has ever separated
 * "impressive" from "fine" is the pairwise comparison against a library reference, and it bound
 * only on a high-intensity brief, in `gate-done.sh`, on the BUILT site, never on a board and
 * never on a calm commission.
 *
 * So every board is now judged against the one thing it has to answer to: the library reference
 * it was drawn from, whose hero is already beside it on the canvas. Both orderings, the lower
 * rung on disagreement, and a board judged clearly worse than its donor is REDRAWN rather than
 * shown. At every intensity, because a calm brand is not a reason to hand someone a weak
 * drawing.
 *
 * ================================ TWO PHASES ================================
 *
 *   node scripts/gate-board-judge.mjs <projectDir>
 *     States the comparisons. Writes `.palate/explore/judge-request.json` and prints its path.
 *     The caller dispatches each comparison to a FRESH subagent, one per ordering, because two
 *     orderings judged in one context is not the position-bias control, it is asking a judge to
 *     agree with itself.
 *
 *   node scripts/gate-board-judge.mjs <projectDir> --judgements <file>
 *     Reads `[{ id, verdict }]`, scores every pair, records
 *     `manifest.explore.board_judgements`, and refuses any board at `clearly_worse`.
 *
 * THE JUDGEMENTS ARE RECORDED EVEN WHEN THE GATE REFUSES. A refusal that leaves no trace gets
 * re-argued rather than fixed, and `gate-explore.mjs` reads exactly this record when it asks
 * whether every shown board was judged at all.
 *
 * Exit 0 = pass, 2 = skip (first stderr line `gate-board-judge: skipped (<reason>)`) or refusal.
 * The caller separates the two on that first line, the way gate-done.sh does.
 * `PALATE_GATE_JUDGE=0` releases it.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { invokedDirectly } from "./lib/invoked-directly.mjs";
import { pluginRootRefusal } from "../hooks/project-dir.mjs";
import { parseRegistry } from "./boards-render.mjs";
import { buildBoardPair, scoreBoardPair, BOARD_QUESTION, RUNGS } from "./reference-capture/ladder-local.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

const skip = (reason) => {
  process.stderr.write(`gate-board-judge: skipped (${reason})\n`);
  process.exitCode = 2;
};

function readJSON(p) {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
}

/** Written through manifest-merge, never by read-modify-write: the hook writes this file too. */
function record(projectDir, judgements) {
  const merge = join(HERE, "manifest-merge.mjs");
  const manifest = join(projectDir, "build-manifest.json");
  if (!existsSync(manifest) || !existsSync(merge)) return;
  const patch = { explore: { board_judgements: judgements } };
  try {
    execFileSync(process.execPath, [merge, "--manifest", manifest, "--set", JSON.stringify(patch)], {
      stdio: ["ignore", "ignore", "pipe"],
    });
  } catch { /* the record is a record; a merge failure must not wedge the judging */ }
}

export function main(argv = process.argv.slice(2)) {
  const flag = (name) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : null; };
  // A flag's VALUE is not a positional. Without this, `--judgements <file>` with no directory
  // named would resolve the project to the judgements file and then report it as not an Explore
  // build, which reads as "nothing to judge" rather than as the operator's slip that it is.
  const positional = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--")));

  // The release valve is read FIRST, so a build that has switched the judge off never has to
  // have its artefacts in order to get past it.
  if (process.env.PALATE_GATE_JUDGE === "0") return skip("PALATE_GATE_JUDGE=0");

  const projectDir = resolve(positional[0] || ".");

  // NEVER JUDGE THE PLUGIN'S OWN FILES. The scaffold ships a template variants.ts, so a run from
  // a plugin checkout would state comparisons about the example entries.
  const refusal = pluginRootRefusal(projectDir);
  if (refusal) {
    process.stderr.write(`gate-board-judge: refused: ${refusal}. Name the site directory explicitly. NOT a pass.\n`);
    process.exitCode = 2;
    return;
  }

  const registryPath = join(projectDir, "src/lib/variants.ts");
  if (!existsSync(registryPath)) return skip("not an Explore build: no src/lib/variants.ts");
  const boards = parseRegistry(readFileSync(registryPath, "utf8"));
  if (!boards.length) return skip("no boards registered");

  const shotsDir = join(projectDir, ".palate/explore/shots");
  const requestPath = join(projectDir, ".palate/explore/judge-request.json");
  const judgementsFile = flag("--judgements");

  // ------------------------------------------------------------------ phase 1
  if (!judgementsFile) {
    /**
     * A BOARD WITH NO EVIDENCE ON DISK IS A SKIP, NOT A PASS, and the skip names the command
     * that produces the evidence. There is nothing to compare, and quietly judging the boards
     * that happen to have their files would report a clean run over a partial one.
     */
    const missing = [];
    for (const b of boards) {
      if (!existsSync(join(shotsDir, b.id, "hero.png"))) missing.push(`${b.id}/hero.png`);
      if (!existsSync(join(shotsDir, b.id, "donor.jpg"))) missing.push(`${b.id}/donor.jpg`);
    }
    if (missing.length)
      return skip(
        `no board or donor hero for ${missing.join(", ")}: run node scripts/boards-render.mjs ${projectDir} ` +
          `(with .palate/explore/donor-heroes.json present, which is what fetches each donor hero) first`,
      );

    const runToken = randomBytes(4).toString("hex");
    const pairs = boards.map((b) =>
      buildBoardPair({
        id: b.id,
        boardPath: join(shotsDir, b.id, "hero.png"),
        donorPath: join(shotsDir, b.id, "donor.jpg"),
        donorSlug: b.donor,
        runToken,
      }),
    );
    mkdirSync(dirname(requestPath), { recursive: true });
    writeFileSync(
      requestPath,
      JSON.stringify({ runToken, question: BOARD_QUESTION, rungs: RUNGS.map((r) => r.id), pairs }, null, 2) + "\n",
    );
    process.stdout.write(
      `gate-board-judge: ${pairs.length} board(s), ${pairs.length * 2} comparisons stated in ${requestPath}\n` +
        `  Dispatch each comparison to a FRESH subagent (one per ordering, never both in one context), then run\n` +
        `  node scripts/gate-board-judge.mjs ${projectDir} --judgements <file> with [{ id, verdict }] per comparison.\n`,
    );
    return;
  }

  // ------------------------------------------------------------------ phase 2
  const request = readJSON(requestPath);
  if (!request || !Array.isArray(request.pairs) || !request.pairs.length)
    return skip(`no comparisons stated yet: run node scripts/gate-board-judge.mjs ${projectDir} first`);
  const judgements = readJSON(resolve(judgementsFile));
  if (!Array.isArray(judgements)) {
    process.stderr.write(`gate-board-judge: ${judgementsFile} must hold an array of { id, verdict }. NOT a pass.\n`);
    process.exitCode = 2;
    return;
  }

  /**
   * THE COUNT IS CHECKED BEFORE ANYTHING IS SCORED, so a partial file cannot pass by scoring
   * only the boards it happens to cover. A missing judgement has to look different from a
   * completed one, which is the failure the grader's own ladder sat dead through.
   */
  const want = request.pairs.length * 2;
  if (judgements.length !== want) {
    process.stderr.write(
      `gate-board-judge: ${judgements.length} judgement(s) returned for ${request.pairs.length} board(s), which needs ${want} ` +
        `(each board judged in both orders, by a fresh subagent each time). NOT a pass.\n`,
    );
    process.exitCode = 2;
    return;
  }

  const wantedIds = new Set(request.pairs.flatMap((p) => p.comparisons.map((c) => c.id)));
  const strays = judgements.filter((j) => !wantedIds.has(j?.id)).map((j) => j?.id ?? "(missing id)");
  if (strays.length) {
    process.stderr.write(
      `gate-board-judge: judgement(s) for comparison(s) nobody asked about: ${strays.join(", ")}. ` +
        `Copy each id verbatim from ${requestPath}. NOT a pass.\n`,
    );
    process.exitCode = 2;
    return;
  }

  const judgedAt = new Date().toISOString();
  const scored = [];
  for (const pair of request.pairs) {
    const mine = judgements.filter((j) => pair.comparisons.some((c) => c.id === j.id));
    let s;
    try {
      s = scoreBoardPair(pair, mine);
    } catch (e) {
      process.stderr.write(`gate-board-judge: ${e.message}. NOT a pass.\n`);
      process.exitCode = 2;
      return;
    }
    scored.push({ ...s, donor: pair.donor ?? null, run_token: request.runToken, judged_at: judgedAt });
  }

  record(projectDir, scored.map((s) => ({
    id: s.id,
    donor: s.donor,
    rung: s.rung,
    consistent: s.consistent,
    run_token: s.run_token,
    judged_at: s.judged_at,
  })));

  const worse = scored.filter((s) => s.rung === "clearly_worse");
  if (worse.length) {
    for (const s of worse)
      process.stderr.write(
        `gate-board-judge: ${s.id} (${s.donor}) judged clearly worse than its donor: ${s.verdicts[0]} / ${s.verdicts[1]}. ` +
          `Redraw it from the donor's hero before the canvas is published.\n`,
      );
    process.exitCode = 2;
    return;
  }

  const shaky = scored.filter((s) => !s.consistent).map((s) => s.id);
  process.stdout.write(
    `Board judge passed: ${scored.length} board(s) judged against their own donors, both orders each ` +
      `(${scored.map((s) => `${s.id} ${s.rung}`).join(", ")}).` +
      (shaky.length ? ` Unstable across the swap, read at the lower rung: ${shaky.join(", ")}.` : "") +
      "\n",
  );
}

if (invokedDirectly(import.meta.url)) main();
