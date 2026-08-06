/**
 * grade-loop.mjs - the SELF-HEAL loop around the projected grade.
 *
 * verify-rendered.mjs already computes a projected grade and blocks below the bar, naming
 * the gaps. That is a gate, not a loop. Blocking tells an agent it failed; it does not tell
 * it whether the thing it just changed helped, and an agent that cannot see whether it is
 * converging will thrash: it will keep editing, keep re-running, and have no way to tell a
 * real gain from the noise floor.
 *
 * This module closes it. It persists each projection beside the build and turns the next run
 * into a comparison: up, down, or unchanged, with the gaps that moved and the ones that did
 * not. Four properties are load-bearing.
 *
 *   1. NOISE IS NOT PROGRESS. Five consecutive grades of an unchanged page returned
 *      76, 78, 80, 81, 76 - one sd of 2.3 points. So a move of +/-2 reads as UNCHANGED and
 *      never as improvement. A loop that celebrates noise teaches the agent that its last
 *      random edit worked, which is worse than no signal at all.
 *
 *   2. A COMPARISON MUST BE LIKE FOR LIKE. `--no-vitals` drops 14 of the 100 weight, and
 *      an unmeasurable dimension drops out of the denominator entirely, so two runs can
 *      report different numbers for an identical page. Every entry records the exact set of
 *      check ids it scored; a run against a different set reports NO COMPARISON and says why,
 *      rather than printing a delta that means nothing.
 *
 *   3. THE LOOP IS BOUNDED. Two iterations with no material gain is a stall, and a stall is
 *      reported as one: it names the checks that have not moved, says they are structural,
 *      and tells the agent to stop and escalate rather than run a fourth pass. It does NOT
 *      release the gate - a stalled build still blocks - because "it stopped improving" is
 *      not the same fact as "it is good enough", and only a human gets to decide the second.
 *
 *   4. IT FAILS LOUD. An unreadable or unwritable history, or a run with no --out to persist
 *      to, is SAID rather than swallowed. Every silent skip in this product's history
 *      reported a clean result while measuring nothing.
 *
 * The history is bookkeeping, so nothing here is ever fatal to a build: the caller reports
 * the problem and carries on with the gate it already had.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { DIMENSIONS } from './rubric.mjs';

export const HISTORY_FILE = 'grade-history.json';
export const HISTORY_VERSION = 1;
/** Keep the tail bounded; a build that has run 20 iterations has a different problem. */
export const HISTORY_MAX = 20;
/**
 * One sd of run-to-run spread on an UNCHANGED page, measured over five consecutive grades
 * (76, 78, 80, 81, 76). Anything inside this band is the instrument, not the build.
 */
export const NOISE_BAND = 2;
/** Iterations with no material gain before the loop is called stalled. */
export const DEFAULT_STALL_ITERS = 2;
/** A check is "not moving" when its raw score sits inside this band across the window. */
const FROZEN_BAND = 0.05;

const CHECK_META = new Map(
  DIMENSIONS.flatMap((d) => d.checks.map((c) => [c.id, { label: c.label, fix: c.fix, dimension: d.id }])),
);

const round3 = (n) => Math.round(n * 1000) / 1000;

/**
 * What the run MEASURED, as a stable string: the measurement configuration, not the outcome.
 *
 * The distinction is load-bearing and I got it wrong first. Keying the basis on the set of
 * scored checks looked rigorous and was self-defeating: an axe check only enters the
 * projection when it FIRES, so fixing the contrast violation removed `text_contrast` from
 * the set, changed the basis, and made the gate report NO COMPARISON on the run where the
 * agent had just done exactly what it was told. A trend that goes blind whenever a fix lands
 * is worse than no trend.
 *
 * So the basis is the configuration the caller controls: vitals on or off (14 of the 100
 * weight, so the number is genuinely a different quantity across it), axe available or not,
 * and the route set axe swept. Check-set changes WITHIN a basis still shift the denominator a
 * little; those are reported as a caveat on the delta rather than as a refusal to compare.
 */
export function basisOf(ctx = {}) {
  return [
    'vitals:' + (ctx.vitals === false ? 'off' : 'on'),
    'axe:' + (ctx.axe === false ? 'off' : 'on'),
    'routes:' + [...(ctx.routes ?? [])].sort().join('+'),
  ].join(' ');
}

/** id -> raw, for every check the projection actually scored. */
export function checksOf(projected) {
  const out = {};
  for (const d of projected?.dimensions ?? []) {
    for (const c of d.checks ?? []) out[c.id] = round3(c.raw ?? 0);
  }
  return out;
}

/** id -> points recoverable across the whole rubric, for the checks scoring under the bar. */
export function recoverableOf(projected) {
  const out = {};
  for (const f of projected?.findings ?? []) out[f.id] = round3(f.recoverable ?? 0);
  return out;
}

/** One history row from a projection. */
export function entryFor(projected, ctx = {}) {
  return {
    at: ctx.at ?? new Date().toISOString(),
    url: ctx.url ?? null,
    routes: ctx.routes ?? null,
    vitals: ctx.vitals !== false,
    axe: ctx.axe !== false,
    overall: projected.overall,
    band: projected.band?.band ?? null,
    measuredWeight: projected.measuredWeight ?? null,
    minGrade: ctx.minGrade ?? null,
    blocked: !!ctx.blocked,
    basis: basisOf(ctx),
    checks: checksOf(projected),
    recoverable: recoverableOf(projected),
  };
}

// ------------------------------------------------------------------ io ----
/**
 * Read the history. Returns `{ entries, error }`: a MISSING file is a first run and carries
 * no error, but a file that exists and will not parse is an error the caller must speak.
 * Losing the trend silently is exactly the failure this module exists to prevent.
 */
export function readHistory(file) {
  let raw;
  try {
    raw = readFileSync(file, 'utf8');
  } catch (e) {
    if (e && e.code === 'ENOENT') return { entries: [], error: null, fresh: true };
    return { entries: [], error: 'could not be read: ' + (e?.message ?? e), fresh: false };
  }
  try {
    const parsed = JSON.parse(raw);
    const entries = Array.isArray(parsed?.entries) ? parsed.entries.filter((e) => e && Number.isFinite(e.overall)) : null;
    if (!entries) return { entries: [], error: 'is not a grade history (no `entries` array)', fresh: false };
    return { entries, error: null, fresh: false };
  } catch (e) {
    return { entries: [], error: 'is not valid JSON: ' + (e?.message ?? e), fresh: false };
  }
}

/** Append and truncate. Returns `{ error }`; a write failure is reported, never thrown. */
export function writeHistory(file, entries, entry) {
  const next = [...entries, entry].slice(-HISTORY_MAX);
  try {
    writeFileSync(file, JSON.stringify({ version: HISTORY_VERSION, entries: next }, null, 2) + '\n');
    return { error: null, entries: next };
  } catch (e) {
    return { error: 'could not be written: ' + (e?.message ?? e), entries: next };
  }
}

// ------------------------------------------------------------ analysis ----
/**
 * The trailing run of entries measured on the SAME basis as `basis`. That run is "this loop":
 * changing the measurement basis mid-way starts a new one, because the numbers either side of
 * the change are not the same quantity.
 */
export function comparableTail(entries, basis) {
  const out = [];
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].basis !== basis) break;
    out.unshift(entries[i]);
  }
  return out;
}

/**
 * improved / regressed / unchanged / incomparable / first.
 *
 * `denominatorNote` is set when the two runs scored a different SET of checks inside the same
 * basis: an axe check that fired last time and not this time, or a check that went
 * inapplicable. Part of the move is then the denominator rather than the page, and the
 * message says so instead of taking full credit.
 */
export function compare(current, previous) {
  if (!previous) return { verdict: 'first', delta: null, previous: null, denominatorNote: null };
  if (previous.basis !== current.basis) {
    return { verdict: 'incomparable', delta: null, previous, denominatorNote: null };
  }
  const now = Object.keys(current.checks ?? {});
  const then = Object.keys(previous.checks ?? {});
  const gone = then.filter((id) => !now.includes(id));
  const added = now.filter((id) => !then.includes(id));
  const denominatorNote = gone.length || added.length
    ? `the scored set also changed (${[
        gone.length ? 'no longer scored: ' + gone.join(', ') : '',
        added.length ? 'newly scored: ' + added.join(', ') : '',
      ].filter(Boolean).join('; ')}), so part of this move is the denominator, not the page`
    : null;
  const delta = current.overall - previous.overall;
  const verdict = Math.abs(delta) <= NOISE_BAND ? 'unchanged' : delta > 0 ? 'improved' : 'regressed';
  return { verdict, delta, previous, denominatorNote };
}

/**
 * Has the loop stopped converging? The window is the last `stallIters + 1` comparable runs;
 * the loop is stalled when the BEST score since the anchor is no better than the anchor by
 * more than the noise band. Best, not last, so an agent that goes 61 -> 75 -> 62 is not told
 * it is stalled when it clearly found something and then broke it again.
 */
export function detectStall(tail, stallIters = DEFAULT_STALL_ITERS) {
  const need = Math.max(2, stallIters + 1);
  if (tail.length < need) return { stalled: false, iterations: tail.length, window: tail, blockers: [] };
  const window = tail.slice(-need);
  const anchor = window[0];
  const best = Math.max(...window.slice(1).map((e) => e.overall));
  if (best - anchor.overall > NOISE_BAND) {
    return { stalled: false, iterations: tail.length, window, blockers: [] };
  }
  return { stalled: true, iterations: tail.length, window, blockers: frozenChecks(window) };
}

/**
 * The checks that are under the bar in EVERY run of the window and have not moved across it.
 * These are what is structurally blocking: the agent has had `n` attempts and none of them
 * touched these, which usually means they are design judgements rather than defects to patch.
 */
export function frozenChecks(window) {
  const last = window[window.length - 1];
  const out = [];
  for (const [id, raw] of Object.entries(last.checks ?? {})) {
    if (raw >= 0.75) continue;
    const series = window.map((e) => e.checks?.[id]);
    if (series.some((v) => !Number.isFinite(v))) continue; // not measured throughout: not evidence
    if (Math.max(...series) - Math.min(...series) > FROZEN_BAND) continue;
    out.push({ id, raw, series, recoverable: last.recoverable?.[id] ?? 0, ...(CHECK_META.get(id) ?? {}) });
  }
  return out.sort((a, b) => b.recoverable - a.recoverable);
}

// ------------------------------------------------------------- message ----
const pts = (n) => (n ?? 0).toFixed(1);
const signed = (n) => (n > 0 ? '+' + n : String(n));

/** The trend sentence: the answer to "did what I just did help?". */
export function trendLine(cmp, iterations) {
  const it = ` (iteration ${iterations} of this loop)`;
  const caveat = cmp.denominatorNote ? ` NOTE: ${cmp.denominatorNote}.` : '';
  switch (cmp.verdict) {
    case 'first':
      return 'FIRST MEASUREMENT: there is no previous run to compare against, so there is no trend yet. The next run will report whether your changes moved it.';
    case 'incomparable':
      return `NO COMPARISON: the previous run measured a different configuration (${cmp.previous.basis}), so the two numbers are not the same quantity. Re-run with the same flags and routes to get a trend.`;
    case 'improved':
      return `IMPROVING: ${cmp.previous.overall} -> ${cmp.previous.overall + cmp.delta}, UP ${cmp.delta}${it}. Keep going in the same direction.${caveat}`;
    case 'regressed':
      return `REGRESSED: ${cmp.previous.overall} -> ${cmp.previous.overall + cmp.delta}, DOWN ${Math.abs(cmp.delta)}${it}. The last change made it WORSE - revert it before trying something else.${caveat}`;
    default:
      return `UNCHANGED: ${cmp.previous.overall} -> ${cmp.previous.overall + cmp.delta}, a move of ${signed(cmp.delta)}${it}. Run-to-run spread on an unchanged page is about ${NOISE_BAND} points, so this is noise, not progress: what you changed did not move the score.${caveat}`;
  }
}

/** The per-gap list, with each gap's own movement since the previous comparable run. */
export function gapLines(projected, previous, limit = 5) {
  return (projected.findings ?? [])
    .filter((f) => (f.recoverable ?? 0) > 0.05)
    .slice(0, limit)
    .map((f) => {
      const was = previous?.checks?.[f.id];
      let moved = '';
      if (Number.isFinite(was)) {
        const d = round3((f.raw ?? 0) - was);
        moved = Math.abs(d) < 0.01 ? ' [unchanged since last run]' : ` [${d > 0 ? 'up' : 'down'} from ${was} last run]`;
      }
      return `  - ${f.label ?? f.id} (worth ${pts(f.recoverable)} pts)${moved}: ${f.detail ?? ''} FIX: ${f.fix ?? ''}`;
    })
    .join('\n');
}

const EXCLUDED =
  'NOT INCLUDED IN THIS NUMBER: the grader also runs a SigLIP appearance head and a pairwise ' +
  'vision ladder against library exemplars. Together they own most of the design dimension and ' +
  'neither can run locally, so they are EXCLUDED here, not guessed. Clearing this bar does not ' +
  'mean the public grade will match it.';

/**
 * The whole message an agent sees when the projection is under the bar. It has to carry four
 * things in terms it can act on: the score and the bar, the ranked gaps with fixes, the fact
 * that it should fix and RE-RUN plus the exact command, and whether the last iteration helped.
 */
export function blockMessage({ projected, cmp, stall, minGrade, rerun, notes = [] }) {
  const head =
    `projected grade ${projected.overall}/100 (${projected.band?.band ?? '?'}) is below the ${minGrade} bar, ` +
    `measured on ${projected.measuredWeight} of the grader's 100 weight.`;

  if (stall.stalled) {
    const path = stall.window.map((e) => e.overall).join(' -> ');
    const blockers = stall.blockers.length
      ? stall.blockers
          .slice(0, 5)
          .map((b) => `  - ${b.label ?? b.id} (worth ${pts(b.recoverable)} pts): stuck at ${b.raw} across all ${stall.window.length} runs. FIX: ${b.fix ?? ''}`)
          .join('\n')
      : '  (no single check is frozen: the score is moving around without net gain, which usually means the edits are cosmetic)';
    return [
      head,
      `STALLED: ${stall.iterations} iterations, ${path}, no material gain (best since the anchor is within the ${NOISE_BAND}-point noise band).`,
      'STOP ITERATING. Another pass of the same kind will not clear the bar. These have not moved at all across the loop:',
      blockers,
      // Precision matters here. Every check this projection scores is measured off the rendered
      // page - a hex, a font stack, a control height, a paint time. None of them is a matter of
      // taste, so a frozen check is never "the judge disagreed": it means the edit did not reach
      // the served page. Telling an agent these are design judgements would send it to rewrite a
      // hero when the real fault is that it never rebuilt.
      'Every check above is MECHANICAL: it is measured off the rendered page, not judged. A check that has not moved in ' +
        `${stall.window.length} runs means the edit is not reaching it. Confirm in order: (1) the change is in the source, ` +
        '(2) the site was REBUILT, (3) the URL you are measuring is serving the rebuilt page. Read the `detail` for each ' +
        'check in .palate-shots/design.json - it names the exact measured value.',
      'If all three hold and the number still will not move, stop and hand it to the human with .palate-shots/design.json and ' +
        `.palate-shots/${HISTORY_FILE}. To accept the build at this score deliberately, set PALATE_MIN_GRADE=${projected.overall} ` +
        'for the run; it is recorded in the history, never silent.',
      // The command is printed here too. The instruction is to stop repeating the same kind of
      // pass, not to stop measuring: an agent that makes one deliberate structural change still
      // needs to re-measure it, and should not have to reconstruct the invocation to do it.
      'After ONE deliberate change of a different kind, this is the command that re-measures it:\n  ' + rerun,
      EXCLUDED,
      ...notes,
    ].join('\n');
  }

  const gaps = gapLines(projected, cmp.previous);
  return [
    head,
    trendLine(cmp, stall.iterations),
    `${(projected.findings ?? []).filter((f) => (f.recoverable ?? 0) > 0.05).length} gap(s) left, ranked by points recoverable:`,
    gaps || '  (no single gap is worth more than 0.05 points: the deficit is spread thin)',
    'NOW: fix the gaps above, rebuild, then RE-RUN THIS EXACT COMMAND to re-measure and see whether it moved:',
    '  ' + rerun,
    EXCLUDED,
    ...notes,
  ].join('\n');
}

/** The one-line summary printed on every run, pass or fail, so the trend is never invisible. */
export function summaryLine({ projected, cmp, stall, minGrade }) {
  // With the gate off there is no bar to pass, and saying "PASSES the 0 bar" would read as an
  // endorsement of a build nothing judged.
  const state = minGrade > 0
    ? `${projected.overall >= minGrade ? 'PASSES' : 'is BELOW'} the ${minGrade} bar`
    : 'is UNGATED (PALATE_MIN_GRADE=0), so nothing here passed or failed';
  return (
    `verify-rendered: projected grade ${projected.overall}/100 (${projected.band?.band ?? '?'}) ${state}, ` +
    `on ${projected.measuredWeight} of the 100 weight this gate can see. ${trendLine(cmp, stall.iterations)} ` +
    'The vision ladder and appearance head are NOT included and own most of the design dimension.'
  );
}
