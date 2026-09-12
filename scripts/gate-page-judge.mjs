#!/usr/bin/env node
/**
 * scripts/gate-page-judge.mjs - the built pages are judged against the picture they were
 * composed from, on the entrance AND on the ending, by the same instrument that judged the
 * boards.
 *
 * ========================== WHAT IT IS PROTECTING ==========================
 *
 * The board judge answers one question well: is this DRAWING as good as the library reference
 * it was drawn from. It answers it before the canvas is published, and after that nothing asked
 * the same question about the thing the client actually receives.
 *
 * The eastcoast v3 build is what that costs. The home page was lifted from the picked board
 * with six edits that each looked safe and which between them inverted the pick, and eighteen
 * inner pages were kit assembly nobody held against anything. Every mechanical gate passed,
 * because every mechanical gate measures whether a page RENDERED: the console was clean, the
 * routes were in the sitemap, the tokens resolved. None of them can see bland, and bland is the
 * whole reason the pairwise comparison exists.
 *
 * ============================== WHAT IT ASKS ===============================
 *
 * One judgement per PAGE TYPE, on the route somebody actually looked at (`compose.pages`, which
 * `palate-pick.mjs --looked` writes and `gate-look.mjs` requires one of per type). A site with
 * nine services is judged on one service page, for the same reason it is looked at once.
 *
 * WHAT EACH PAGE ANSWERS TO:
 *   the home page   the picked BOARD, because the board is a drawing of this page and the pick
 *                   is a promise about it
 *   every other     the board's DONOR, the library reference in the client's field, because no
 *                   board ever drew a service page and the donor is the only picture of the
 *                   standard that exists
 *
 * On two surfaces each, the entrance and the ending, because a verdict about the top of a page
 * is not a verdict about the page: the closing call to action and the footer are what an
 * assembled page is most likely to have left to the kit. The lower of the two orderings stands,
 * the LOWEST surface stands, and the bar is the board judge's own (`REFUSED_RUNGS`): comparable
 * or better, at every intensity.
 *
 * ================================ THREE MODES ===============================
 *
 * phase 1   (no flags)          shoot every looked route, state the comparisons in
 *                               `.palate/compose/judge-request.json`, stop.
 * phase 2   `--judgements <f>`  score them, record `compose.page_judgements`, refuse anything
 *                               below the bar.
 * `--check` (done time)         read the record ALONE: no browser, no subagents. Every looked
 *                               page type carries a judgement, none of them is below the bar,
 *                               and each one still describes the HTML on disk.
 *
 * A refusal is RECORDED. A verdict that leaves no trace gets re-argued rather than fixed.
 *
 * Exit 0 = pass, 1 = findings, 2 = cannot check (first stderr line
 * `gate-page-judge: skipped (<reason>)`). `PALATE_GATE_JUDGE=0` releases it, exactly as it
 * releases the board judge: one switch for one instrument.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { invokedDirectly } from "./lib/invoked-directly.mjs";
import { pluginRootRefusal } from "../hooks/project-dir.mjs";
import { pageTypeOf, routeSlug, normaliseRoute } from "./lib/route-kind.mjs";
import {
  fingerprint, readJSON, cropFoot, mergeManifest, refusedRung, WORSE_PHRASE,
} from "./gate-board-judge.mjs";
import { buildBoardPair, scoreBoardPair, PAGE_QUESTION, PAGE_FOOT_QUESTION, RUNGS } from "./reference-capture/ladder-local.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const engineRequire = createRequire(new URL("./reference-capture/", import.meta.url));

/** The desktop frame every board was drawn at, so the two pictures are the same size of thing. */
const WIDTH = 1440;
const FOLD = 900;

/**
 * THE TWO SURFACES A BUILT PAGE IS READ ON, and what the refusal calls each one.
 *
 * `noun` is the word the sentence needs ("somewhat worse than the donor's ENDING"), which is
 * not the same word as the file name and not the same word as the surface key. Writing the
 * sentence out of the file name is how a refusal ends up saying "worse than the donor's
 * foot.png" to somebody who has to act on it.
 */
export const PAGE_SURFACES = {
  entrance: { noun: "entrance", question: PAGE_QUESTION, still: "entrance.png", board: "hero.png", donor: "donor.jpg" },
  foot: { noun: "ending", question: PAGE_FOOT_QUESTION, still: "foot.png", board: "foot.png", donor: "donor-foot.png" },
};
const SURFACE_ORDER = ["entrance", "foot"];

const skip = (reason) => {
  process.stderr.write(`gate-page-judge: skipped (${reason})\n`);
  process.exitCode = 2;
};
const refuse = (lines) => {
  for (const l of lines) process.stderr.write(`gate-page-judge: ${l}\n`);
  process.exitCode = 1;
};

/**
 * The built HTML for a route, in the order the adapters produce it.
 *
 * Exactly `gate-look.mjs`'s resolution, and deliberately the same three candidates: the Vercel
 * adapter leaves a bare `dist/` behind on some versions. A gate that asked for a look at a page
 * and then could not find the page it asked about would refuse an honest build.
 */
export function builtHtml(dir, route) {
  const r = normaliseRoute(route);
  const rel = r === "/" ? "index.html" : join(r.replace(/^\//, ""), "index.html");
  for (const root of ["dist/client", "dist"]) {
    const p = join(dir, root, rel);
    if (existsSync(p)) return p;
  }
  return null;
}

/**
 * ONE ROUTE PER PAGE TYPE, the one somebody looked at.
 *
 * `compose.pages` is already one entry per route (a second look replaces the first), so the
 * only reduction owed here is by TYPE, and the first look on a type is the one judged: the
 * ninth service page teaches nothing the first did not, and judging all nine would buy
 * eighteen subagents to be told the same thing.
 */
export function judgedRoutes(manifest) {
  const pages = Array.isArray(manifest?.compose?.pages) ? manifest.compose.pages : [];
  const byType = new Map();
  for (const p of pages) {
    if (!p || typeof p.verdict !== "string" || !p.verdict.trim()) continue;
    const type = typeof p.page_type === "string" && p.page_type ? p.page_type : pageTypeOf(p.route);
    if (!byType.has(type)) byType.set(type, { route: normaliseRoute(p.route), page_type: type });
  }
  return [...byType.values()];
}

/** A static server over the build output, so absolute asset paths resolve as they do in life. */
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif", ".woff2": "font/woff2",
  ".woff": "font/woff", ".ico": "image/x-icon",
};
function serve(root, port) {
  return new Promise((ok, no) => {
    const s = createServer((req, res) => {
      let pathname;
      try { pathname = decodeURIComponent(new URL(req.url, "http://l").pathname); }
      catch { res.writeHead(400); res.end(); return; }
      const p = join(root, pathname);
      for (const f of [p, join(p, "index.html")]) {
        try {
          if (statSync(f).isFile()) {
            res.writeHead(200, { "Content-Type": TYPES[f.slice(f.lastIndexOf("."))] || "application/octet-stream" });
            res.end(readFileSync(f));
            return;
          }
        } catch { /* next candidate */ }
      }
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<!doctype html><title>404</title>");
    });
    s.on("error", no);
    s.listen(port, () => ok(s));
  });
}
async function serveOnFreePort(root, first) {
  let last = null;
  for (let p = first; p < first + 6; p++) {
    try { return { server: await serve(root, p), port: p }; }
    catch (e) { last = e; if (e && e.code === "EADDRINUSE") continue; throw e; }
  }
  throw last;
}

/** What a page type answers to: the picked board for the home, the board's donor for the rest. */
const againstFor = (shotsDir, pageType, surface) =>
  join(shotsDir, PAGE_SURFACES[surface][pageType === "home" ? "board" : "donor"]);
const againstLabel = (pageType) => (pageType === "home" ? "the board" : "the donor");

export async function main(argv = process.argv.slice(2)) {
  /**
   * A FLAG WITH NO VALUE IS A REFUSAL, never a silent fall-through. `--judgements` with nothing
   * after it returns the same null as "no --judgements at all", so the run would re-state the
   * comparisons and print a phase 1 success over an operator who believed they had just scored
   * them. The board judge learned this the same way.
   */
  const flagError = [];
  const flag = (name) => {
    const i = argv.indexOf(name);
    if (i < 0) return null;
    const v = argv[i + 1];
    if (!v || v.startsWith("--")) { flagError.push(name); return null; }
    return v;
  };
  const positional = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--")));

  // The release valve is read FIRST, so a build that has switched the judge off never has to
  // have its artefacts in order to get past it.
  if (process.env.PALATE_GATE_JUDGE === "0") return skip("PALATE_GATE_JUDGE=0");

  const judgementsArg = flag("--judgements");
  const serveUrl = flag("--serve");
  const port = Number(flag("--port") || 8801);
  const checkOnly = argv.includes("--check");
  if (flagError.length) {
    refuse([
      `${flagError.join(", ")} was given with no value. Name the file: ` +
        "--judgements <projectDir>/.palate/compose/judgements.json. NOT a pass.",
    ]);
    return;
  }

  const projectDir = resolve(positional[0] || ".");
  // NEVER JUDGE THE PLUGIN'S OWN FILES.
  const refusal = pluginRootRefusal(projectDir);
  if (refusal) {
    refuse([`refused: ${refusal}. Name the site directory explicitly. NOT a pass.`]);
    return;
  }

  const manifestPath = join(projectDir, "build-manifest.json");
  const manifest = readJSON(manifestPath);
  if (!manifest) return skip(`no readable build-manifest.json under ${projectDir}`);

  const picks = Array.isArray(manifest?.explore?.picks) ? manifest.explore.picks : [];
  const pick = picks.find((p) => p?.surface === "hero") || picks[0];
  // BEFORE THE PICK THERE IS NO PICTURE to hold a page against, so nothing is owed.
  if (!pick || !pick.variant_id) return skip("no pick recorded");

  const routes = judgedRoutes(manifest);
  if (!routes.length)
    return skip("no page has a recorded look yet, so there is no route to judge (palate-pick.mjs --looked)");

  const shotsDir = join(projectDir, ".palate/explore/shots", pick.variant_id);
  const requestPath = join(projectDir, ".palate/compose/judge-request.json");

  // ------------------------------------------------------------------ done-time check
  if (checkOnly) return check(projectDir, manifest, routes);

  // ------------------------------------------------------------------ phase 2
  if (judgementsArg) return phase2(projectDir, requestPath, judgementsArg, manifest);

  // ------------------------------------------------------------------ phase 1
  /**
   * A LOOKED ROUTE WITH NO BUILT PAGE IS A REFUSAL, not a quiet omission. The look says somebody
   * opened it; if the page is not in the build output then either the look is about something
   * that no longer exists or the build is incomplete, and judging the rest would report a clean
   * comparison over a site missing a page somebody signed off.
   */
  const html = new Map();
  const unbuilt = [];
  for (const r of routes) {
    const p = builtHtml(projectDir, r.route);
    if (p) html.set(r.route, p);
    else unbuilt.push(r.route);
  }
  if (unbuilt.length) {
    refuse([
      `${unbuilt.join(", ")} ${unbuilt.length === 1 ? "has" : "have"} a recorded look and no built page under ` +
        `${join(projectDir, "dist")}, so there is nothing to compare with the direction. Build the site, or ` +
        "remove the look for a route that no longer exists. NOT a pass.",
    ]);
    return;
  }

  /**
   * ALREADY JUDGED IS NOT RE-JUDGED, keyed on the HTML the verdict was about.
   *
   * A verifier round runs phase 1 every time. Without this it would re-shoot every page and ask
   * for twelve fresh comparisons on a build where nothing had changed, then throw the standing
   * verdicts away with the request they were bound to. The HTML fingerprint is the honest key:
   * a page rebuilt since (the one case where re-judging is the point) does not match.
   */
  const held = new Map((Array.isArray(manifest?.compose?.page_judgements) ? manifest.compose.page_judgements : [])
    .map((j) => [j?.route, j]));
  const stale = routes.filter((r) => {
    const j = held.get(r.route);
    if (!j || !RUNGS.some((x) => x.id === j.rung)) return true;
    return j.fingerprints?.html_sha !== fingerprint(html.get(r.route));
  });
  if (!stale.length) {
    // A STANDING REFUSAL IS STILL A REFUSAL. Re-stating the comparison would ask a fresh
    // subagent the same question about the same page until one of them said something kinder.
    const worse = routes.filter((r) => refusedRung(held.get(r.route).rung));
    if (worse.length) {
      refuse(worse.map((r) =>
        `${r.route} stands judged ${WORSE_PHRASE[held.get(r.route).rung]} than ${againstLabel(r.page_type)} and has ` +
        "not been recomposed. A page ships only when it reads comparable or better on both surfaces. NOT a pass."));
      return;
    }
    process.stdout.write(
      `gate-page-judge: already judged: ${routes.map((r) => `${r.route} ${held.get(r.route).rung}`).join(", ")}. ` +
        "Every looked route carries a verdict for the page on disk, so no comparison is restated. " +
        "Rebuild a page to judge it again.\n",
    );
    return;
  }

  /**
   * NO SHARP IS A SKIP, not an entrance-only pass. Judging every page on its entrance because a
   * local dependency is missing would quietly hand back the half of the instrument this gate
   * exists to add, and the entrance is the half that was never the problem.
   */
  let sharp = null;
  try { sharp = engineRequire("sharp"); } catch { sharp = null; }
  if (!sharp) return skip(`sharp not installed: run ${join(HERE, "reference-capture", "setup.sh")}`);

  let playwright = null;
  try { playwright = engineRequire("playwright"); } catch { playwright = null; }
  if (!playwright) return skip(`playwright not installed: run ${join(HERE, "reference-capture", "setup.sh")}`);

  /** The pictures the pages answer to. Missing ones mean the boards were never rendered. */
  const wantedShots = [...new Set(routes.flatMap((r) =>
    SURFACE_ORDER.map((s) => againstFor(shotsDir, r.page_type, s))))];
  const missing = wantedShots.filter((p) => !existsSync(p));
  if (missing.length)
    return skip(
      `the picked direction ${pick.variant_id} has no ${missing.map((m) => m.slice(shotsDir.length + 1)).join(", ")} ` +
        `on disk: run node ${join(HERE, "gate-board-judge.mjs")} ${projectDir} first, which renders and crops them`,
    );

  const distRoot = ["dist/client", "dist"].map((d) => join(projectDir, d)).find((d) => existsSync(join(d, "index.html")));
  if (!distRoot && !serveUrl) return skip(`no built site under ${join(projectDir, "dist")} and no --serve URL`);

  const browser = await playwright.chromium.launch();
  let server = null;
  const pairs = [];
  try {
    let base = serveUrl;
    if (!base) {
      const served = await serveOnFreePort(distRoot, port);
      server = served.server;
      base = `http://127.0.0.1:${served.port}`;
    }
    base = base.replace(/\/$/, "");
    const ctx = await browser.newContext({ viewport: { width: WIDTH, height: FOLD }, deviceScaleFactor: 1 });
    const runToken = randomBytes(4).toString("hex");

    for (const r of routes) {
      const slug = routeSlug(r.route);
      const outDir = join(projectDir, ".palate-shots/compose", slug);
      mkdirSync(outDir, { recursive: true });
      const url = `${base}${r.route === "/" ? "/" : r.route}`;
      const pg = await ctx.newPage();
      try {
        const res = await pg.goto(url, { waitUntil: "networkidle", timeout: 45000 }).catch(() => null);
        if (!res || !res.ok()) {
          refuse([`${r.route} did not load at ${url} (${res ? res.status() : "no response"}), so it could not be shot. NOT a pass.`]);
          return;
        }
        await pg.waitForTimeout(300);
        const entrance = join(outDir, "entrance.png");
        await pg.screenshot({ path: entrance, fullPage: false });
        /**
         * THE ENDING IS A CROP OF THE WHOLE PAGE, never the whole page. A judge handed a
         * capture thousands of pixels tall reads the top and answers about the entrance again,
         * which is the verdict this surface exists to stop standing in for the page.
         */
        const full = join(outDir, "full.png");
        await pg.screenshot({ path: full, fullPage: true });
        await cropFoot(sharp, full, join(outDir, "foot.png"));
      } finally {
        await pg.close().catch(() => {});
      }

      for (const surface of SURFACE_ORDER) {
        const spec = PAGE_SURFACES[surface];
        const candidate = join(outDir, spec.still);
        const against = againstFor(shotsDir, r.page_type, surface);
        pairs.push({
          ...buildBoardPair({
            id: slug,
            surface,
            question: spec.question,
            boardPath: candidate,
            donorPath: against,
            donorSlug: pick.variant_id,
            runToken,
          }),
          /**
           * THE PAIR ID CARRIES THE RUN TOKEN as well as the comparison ids do, so a request
           * from an earlier run cannot be scored against this one's record by a reader that
           * keys on the pair.
           */
          id: `${slug}:${surface}@${runToken}`,
          route: r.route,
          page_type: r.page_type,
          candidate,
          /** THE PIXELS THESE ANSWERS WILL BE ABOUT, and the HTML they came from. */
          candidate_sha: fingerprint(candidate),
          html_sha: fingerprint(html.get(r.route)),
        });
      }
    }
  } finally {
    await browser.close().catch(() => {});
    if (server) server.close();
  }
  mkdirSync(dirname(requestPath), { recursive: true });
  writeFileSync(
    requestPath,
    JSON.stringify(
      {
        runToken: pairs[0].runToken,
        // NO TOP-LEVEL QUESTION. The two surfaces ask different things and the dispatching
        // doctrine says to pass "the question" verbatim, so one question beside both pairs is
        // an instruction to ask the entrance's question over a page ending.
        questions: "each pair carries its own question: dispatch that pair's `question` verbatim",
        rungs: RUNGS.map((r) => r.id),
        pairs,
      },
      null,
      2,
    ) + "\n",
  );
  process.stdout.write(
    `gate-page-judge: ${routes.length} page type(s) on ${pairs.length} surface(s), ${pairs.length * 2} comparisons ` +
      `stated in ${requestPath}\n` +
      "  Dispatch each comparison to a FRESH subagent (one per ordering, never both in one context), then run\n" +
      `  node ${join(HERE, "gate-page-judge.mjs")} ${projectDir} --judgements <file> with [{ id, candidate_is, verdict }] per comparison.\n`,
  );
}

// -------------------------------------------------------------------------- phase 2
function phase2(projectDir, requestPath, judgementsArg, manifest) {
  const request = readJSON(requestPath);
  if (!request || !Array.isArray(request.pairs) || !request.pairs.length)
    return skip(`no comparisons stated yet: run node ${join(HERE, "gate-page-judge.mjs")} ${projectDir} first`);

  /**
   * THE REQUEST MUST STILL DESCRIBE THESE PAGES.
   *
   * A page refused below is recomposed and rebuilt, and the standing request would then hand
   * the old verdicts to the new page. Both bindings matter and they fail differently: the
   * still can change when the page has not (fonts settle, a carousel moves), and the HTML can
   * change when the still happens to look the same.
   */
  for (const p of request.pairs) {
    if (p.candidate_sha && fingerprint(p.candidate) !== p.candidate_sha)
      return refuse([
        `the ${PAGE_SURFACES[p.surface]?.noun ?? "still"} of ${p.route} changed since the comparisons were stated. ` +
          "Re-run phase 1 so the verdicts describe the pixels on disk. NOT a pass.",
      ]);
    if (p.html_sha) {
      const now = builtHtml(projectDir, p.route);
      if (!now || fingerprint(now) !== p.html_sha)
        return refuse([
          `${p.route} was rebuilt since the comparisons were stated, so these judgements are stale: they describe a ` +
            "page that is no longer on disk. Re-run phase 1. NOT a pass.",
        ]);
    }
  }

  const judgements = readJSON(resolve(judgementsArg));
  if (!Array.isArray(judgements))
    return refuse([`${judgementsArg} must hold an array of { id, candidate_is, verdict }. NOT a pass.`]);

  /**
   * THE COUNT IS CHECKED BEFORE ANYTHING IS SCORED, so a partial file cannot pass by scoring
   * only the surfaces it happens to cover. A missing judgement has to look different from a
   * completed one.
   */
  const want = request.pairs.length * 2;
  if (judgements.length !== want)
    return refuse([
      `${judgements.length} judgement(s) returned for ${request.pairs.length} comparison pair(s), which needs ${want} ` +
        "(each surface judged in both orders, by a fresh subagent each time). NOT a pass.",
    ]);

  const wantedIds = new Set(request.pairs.flatMap((p) => p.comparisons.map((c) => c.id)));
  const strays = judgements.filter((j) => !wantedIds.has(j?.id)).map((j) => j?.id ?? "(missing id)");
  if (strays.length)
    return refuse([
      `judgement(s) for comparison(s) nobody asked about: ${strays.join(", ")}. Copy each id verbatim from ` +
        `${requestPath}. NOT a pass.`,
    ]);

  const readings = new Map();
  for (const pair of request.pairs) {
    const mine = judgements.filter((j) => pair.comparisons.some((c) => c.id === j.id));
    try { readings.set(pair.id, scoreBoardPair(pair, mine)); }
    catch (e) { return refuse([`${e.message}. NOT a pass.`]); }
  }

  const rungOrder = RUNGS.map((r) => r.id);
  const judgedAt = new Date().toISOString();
  const byRoute = new Map();
  for (const pair of request.pairs) {
    if (!byRoute.has(pair.route)) byRoute.set(pair.route, []);
    byRoute.get(pair.route).push(pair);
  }
  const scored = [];
  for (const [route, ps] of byRoute) {
    const surfaces = ps.map((p) => p.surface);
    const rungs = Object.fromEntries(ps.map((p) => [p.surface, readings.get(p.id).rung]));
    // THE LOWEST SURFACE STANDS, for the same reason the lower ordering does: a page is as good
    // as its weakest half, and averaging is how a weak ending gets carried by a strong hero.
    const rung = surfaces.map((s) => rungs[s]).reduce((a, r) => (rungOrder.indexOf(r) < rungOrder.indexOf(a) ? r : a));
    scored.push({
      route,
      page_type: ps[0].page_type,
      surfaces,
      rungs,
      rung,
      against: Object.fromEntries(ps.map((p) => [p.surface, p.comparisons[0].B])),
      fingerprints: {
        entrance_sha: ps.find((p) => p.surface === "entrance")?.candidate_sha ?? null,
        foot_sha: ps.find((p) => p.surface === "foot")?.candidate_sha ?? null,
        html_sha: ps[0].html_sha ?? null,
      },
      consistent: ps.every((p) => readings.get(p.id).consistent),
      judged_at: judgedAt,
      run_token: request.runToken,
      verdicts: Object.fromEntries(ps.map((p) => [p.surface, readings.get(p.id).verdicts])),
    });
  }

  /**
   * THE JUDGEMENTS ARE RECORDED EVEN WHEN THE GATE REFUSES, and the record REPLACES the entry
   * for each route it covers rather than appending: two verdicts about one route is a record
   * that says two things, and the done-time check would read whichever it met first.
   */
  const kept = (Array.isArray(manifest?.compose?.page_judgements) ? manifest.compose.page_judgements : [])
    .filter((j) => j && !byRoute.has(j.route));
  const written = [...kept, ...scored.map(({ verdicts, ...j }) => j)];
  const recordError = mergeManifest(projectDir, { compose: { page_judgements: written } }, (back) => {
    const got = Array.isArray(back?.compose?.page_judgements) ? back.compose.page_judgements : null;
    return Boolean(got) && got.length === written.length;
  });
  if (recordError) return refuse([`the judgements were scored but not recorded: ${recordError}. NOT a pass.`]);

  const overrides = Array.isArray(manifest?.compose?.overrides) ? manifest.compose.overrides : [];
  const worse = scored.filter((s) => refusedRung(s.rung));
  if (worse.length) {
    const lines = [];
    for (const s of worse) {
      for (const surface of s.surfaces) {
        if (!refusedRung(s.rungs[surface])) continue;
        lines.push(
          `${s.route} ${surface}: ${WORSE_PHRASE[s.rungs[surface]]} than ${againstLabel(s.page_type)}'s ` +
            `${PAGE_SURFACES[surface].noun}: ${s.verdicts[surface][0]} / ${s.verdicts[surface][1]}. A page ships ` +
            "only when it reads comparable or better on both surfaces. Recompose it from the picture it answers " +
            "to and rebuild before judging again.",
        );
      }
      /**
       * THE DEPARTURES THIS ROUTE ALREADY DECLARED, printed beside the refusal. A deliberate
       * departure and drift read identically in a verdict, and the reason is the only thing
       * that tells them apart: without it the operator argues with the judge about a decision
       * they themselves recorded.
       */
      for (const o of overrides.filter((o) => o && normaliseRoute(o.route) === s.route))
        lines.push(`  override on ${s.route}, ${o.section}: ${o.reason}`);
    }
    refuse(lines);
    return;
  }

  const shaky = scored.filter((s) => !s.consistent).map((s) => s.route);
  // The pass line names WHAT each page answered to, from what was actually judged. Saying "the
  // board and the donor" over a set with no home page in it is a claim about a comparison
  // nobody made, and the pass line is the sentence an operator reads and reports.
  const answeredTo = [
    scored.some((s) => s.page_type === "home") ? "the board" : null,
    scored.some((s) => s.page_type !== "home") ? "the donor" : null,
  ].filter(Boolean).join(" and ");
  process.stdout.write(
    `Page judge passed: ${scored.length} page type(s) judged against ${answeredTo}, ` +
      "both orders each, read at the lowest surface: " +
      scored.map((s) => `${s.route} ${s.rung} (entrance ${s.rungs.entrance}, ending ${s.rungs.foot})`).join(", ") +
      "." + (shaky.length ? ` Unstable across the swap, read at the lower rung: ${shaky.join(", ")}.` : "") + "\n",
  );
}

// -------------------------------------------------------------------------- done-time check
/**
 * The record ALONE, which is all the done gate can afford to read.
 *
 * It cannot shoot pages and it cannot dispatch subagents, so it asks the three questions a
 * record can answer: is there a verdict for every page type somebody looked at, is any of them
 * below the bar, and does each one still describe the HTML on disk. The last is the one that
 * matters most in practice: a page refused, patched and rebuilt would otherwise keep sailing on
 * the verdict its old pixels earned.
 */
function check(projectDir, manifest, routes) {
  const held = new Map((Array.isArray(manifest?.compose?.page_judgements) ? manifest.compose.page_judgements : [])
    .map((j) => [normaliseRoute(j?.route), j]));
  const findings = [];
  for (const r of routes) {
    const j = held.get(r.route);
    if (!j || !RUNGS.some((x) => x.id === j.rung)) {
      findings.push(
        `${r.route} (${r.page_type}) was looked at and never judged against the direction it was composed from.`,
      );
      continue;
    }
    if (refusedRung(j.rung)) {
      findings.push(
        `${r.route} (${r.page_type}) stands judged ${WORSE_PHRASE[j.rung]} than ${againstLabel(r.page_type)} ` +
          `(entrance ${j.rungs?.entrance ?? "?"}, ending ${j.rungs?.foot ?? "?"}).`,
      );
      continue;
    }
    const now = builtHtml(projectDir, r.route);
    if (!now) { findings.push(`${r.route} carries a verdict and no built page.`); continue; }
    if (j.fingerprints?.html_sha && j.fingerprints.html_sha !== fingerprint(now))
      findings.push(`${r.route} was rebuilt after it was judged, so its verdict describes a page that no longer exists.`);
  }
  if (findings.length) {
    refuse([
      ...findings,
      `Judge them: node ${join(HERE, "gate-page-judge.mjs")} ${projectDir}, dispatch the comparisons, then ` +
        "--judgements <file>.",
    ]);
    return;
  }
  process.stdout.write(
    `gate-page-judge: ${routes.length} page type(s) judged comparable or better on both surfaces ` +
      `(${routes.map((r) => `${r.route} ${held.get(r.route).rung}`).join(", ")}).\n`,
  );
}

if (invokedDirectly(import.meta.url))
  main().catch((e) => {
    process.stderr.write(`gate-page-judge: ${e && e.message ? e.message : e}. NOT a pass.\n`);
    process.exitCode = 1;
  });
