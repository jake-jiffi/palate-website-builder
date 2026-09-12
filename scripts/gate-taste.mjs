#!/usr/bin/env node
/**
 * scripts/gate-taste.mjs - the local grade's own ladder, read at done time.
 *
 * ========================== THE FAULT THIS CLOSES ==========================
 *
 * On the eastcoast v3 build the local grade's pairwise ladder judged the built home
 * `somewhat_worse` than both exemplars, at the 12.9th taste percentile, with `flattery.risk:
 * true` - the instrument that says "the honest number is likely lower than this" was already
 * true. Nothing read the file. The done gate ran clean, because every other check measures
 * hygiene, similarity or facts, and a page can pass all three while reading as visibly worse
 * than the library it was supposed to match.
 *
 * `grade-local.mjs` already computes this. It was just never wired to anything that could stop
 * a build. This gate reads its result and refuses to let a build read worse than its exemplar
 * pass quietly.
 *
 * ============================== WHAT IT ASKS ===============================
 *
 * Pass requires BOTH: the ladder's rung is `comparable` or `better`, AND the flattery guard
 * (the appearance head putting this page below the library median, where the instrument is
 * measured to over-score) is not tripped. Either one failing is a refusal, because a rung of
 * `comparable` earned under `flattery.risk: true` is not trustworthy evidence that the page is
 * actually comparable.
 *
 * ============================== FAIL-OPEN ==================================
 *
 * The local grade is a self-check the agent runs voluntarily (`references/local-grade.md`,
 * SKILL.md A.12), not a step the pick or the scaffold writes for it. A build that has not run
 * it yet, or whose ladder was never applicable (no exemplars fetched), skips rather than
 * blocking: this gate can only read a record, it cannot make one. `PALATE_GATE_TASTE=0`
 * releases it with a named skip, the same discipline as `PALATE_GATE_LOOK` and
 * `PALATE_GATE_JUDGE`.
 *
 * A malformed result file is refused as unreadable, never read as a pass: a corrupt record is
 * not evidence the page cleared the bar.
 *
 * Usage: node scripts/gate-taste.mjs <projectDir>
 * Exit: 0 the ladder is comparable or better with no flattery risk, 1 findings, 2 cannot check
 *       (first stderr line `gate-taste: skipped (<reason>)`).
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const dir = resolve(process.argv[2] || ".");

const skip = (reason) => {
  process.stderr.write(`gate-taste: skipped (${reason})\n`);
  process.exitCode = 2;
};

const HOW_TO_RUN = "node scripts/reference-capture/grade-local.mjs --url <the built preview URL>";

/**
 * `grade-local.mjs` writes `local-grade.json` beside `local-grade-state.json` in whatever
 * `--out` directory it was given (default `.palate-shots`). The default location is checked
 * first, and it is the one every build actually uses; a state file recording a different `out`
 * is honoured too, on the chance a build ran it with a custom `--out`, but as of this writing
 * `grade-local.mjs`'s own state object carries no such field, so this second branch is
 * defensive rather than load-bearing.
 */
function resolveResultFile(root) {
  const primary = join(root, ".palate-shots", "local-grade.json");
  if (existsSync(primary)) return primary;

  const stateCandidates = [
    join(root, ".palate", "grade", "local-grade-state.json"),
    join(root, ".palate-shots", "local-grade-state.json"),
  ];
  for (const statePath of stateCandidates) {
    if (!existsSync(statePath)) continue;
    let state;
    try {
      state = JSON.parse(readFileSync(statePath, "utf8"));
    } catch {
      continue;
    }
    const out = typeof state?.out === "string" && state.out ? state.out : null;
    if (!out) continue;
    const candidate = join(root, out, "local-grade.json");
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function main() {
  if (process.env.PALATE_GATE_TASTE === "0") return skip("PALATE_GATE_TASTE=0");

  const resultPath = resolveResultFile(dir);
  if (!resultPath) return skip(`the local grade has not run: ${HOW_TO_RUN}`);

  let result;
  try {
    result = JSON.parse(readFileSync(resultPath, "utf8"));
  } catch {
    return skip(`${resultPath} is not readable JSON`);
  }
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return skip(`${resultPath} is not readable JSON`);
  }

  const ladder = result.ladder && typeof result.ladder === "object" ? result.ladder : null;
  if (!ladder || ladder.applicable !== true) {
    const reason = (ladder && typeof ladder.reason === "string" && ladder.reason) || "no reason given";
    return skip(`the ladder was not applicable: ${reason}`);
  }

  const rung = typeof ladder.rung === "string" ? ladder.rung : null;
  const okRung = rung === "comparable" || rung === "better";
  const flattery = result.flattery && typeof result.flattery === "object" ? result.flattery : null;
  const atRisk = !!flattery?.risk;

  const tastePercentile =
    typeof result.taste?.percentile === "number" ? result.taste.percentile : (typeof flattery?.tastePercentile === "number" ? flattery.tastePercentile : null);

  if (okRung && !atRisk) {
    console.log(
      `gate-taste: the local grade's ladder reads this build ${rung} against its exemplar` +
        (tastePercentile != null ? ` (taste percentile ${tastePercentile}).` : "."),
    );
    return;
  }

  const lines = [];
  const rungLabel = rung ? rung.replace(/_/g, " ") : "unknown";
  lines.push(
    `gate-taste: the local grade's ladder reads this build ${rungLabel} than its exemplar` +
      (tastePercentile != null ? ` at the ${tastePercentile} taste percentile.` : "."),
  );
  if (atRisk) {
    const range = Array.isArray(flattery.honestRange) ? flattery.honestRange : null;
    lines.push(
      `  flattery.risk is true: the appearance head puts this page below the library median, where this` +
        ` instrument is measured to over-score. The honest range is roughly ${range ? `${range[0]} to ${range[1]}` : "lower than the reported score"}.`,
    );
  }
  const findings = Array.isArray(result.findings) ? result.findings : [];
  const first = findings.find((f) => f && (f.detail || f.fix));
  if (first) {
    lines.push(`  ${first.detail || "(no detail)"}${first.fix ? ` Fix: ${first.fix}` : ""}`);
  }
  lines.push(`  Fix it and re-run: ${HOW_TO_RUN}`);
  process.stderr.write(lines.join("\n") + "\n");
  process.exitCode = 1;
}

main();
