#!/usr/bin/env node
/**
 * scripts/motion-proof.mjs - measure what actually moves on a page.
 *
 * ======================= WHY THIS EXISTS AT ALL =======================
 *
 * The Explore stage hands the client a still and asks them to choose a direction on it, so the
 * one thing a board cannot show is the thing it promises most loudly: the motion note. Compose
 * builds the home page, shows it moving, and records that it did with
 * `palate-pick.mjs --proof <url>`. Until this file, that record was a URL and a timestamp,
 * which is to say the agent's word.
 *
 * On the first real build to use it, the board promised a 0.6x parallax on the hero image. The
 * proof was recorded. Measured afterwards, the image moved 7 per cent of the scroll distance,
 * and the person who opened the preview said there was no motion. The record was not wrong
 * about anything it contained; it simply contained nothing that could be wrong.
 *
 * ========================== WHAT IT MEASURES ==========================
 *
 * Four things, because those are the four kinds of motion a board's note ever promises, and
 * each one leaves a different trace:
 *
 *   header     a sticky bar that shrinks, changes ground or gets out of the way on scroll.
 *              Measured as its height before and after an 800 px scroll.
 *   parallax   an image, a video or a background that travels at its own rate. Measured as the
 *              translateY it gained over that scroll, as a RATIO of the scroll distance, so
 *              "0.6x" in a note and 0.6 here are the same number and can be compared. This is
 *              the measurement that would have caught the 7 per cent.
 *   animated   elements whose computed `animation-name` is not `none`: a declared loop, a
 *              reveal, a draw.
 *   running    elements whose computed style CHANGED between two samples 600 ms apart with no
 *              input at all. A marquee, a video-backed hero, a canvas loop and a JS ticker all
 *              show up here and in none of the above, because none of them declares a CSS
 *              animation.
 *
 * AND THEN IT DOES THE WHOLE THING AGAIN UNDER `prefers-reduced-motion: reduce`, because a
 * page whose motion is its argument still has to answer somebody who has asked their machine
 * to stop moving things, and "we honoured reduced motion" is the other claim nobody measures.
 * `reduced.running` above zero is not automatically a fault (a video the person started, a
 * cursor) but it is a number somebody can look at.
 *
 * IT DOES NOT JUDGE. It prints what it read; `palate-pick.mjs` owns the refusal, because the
 * bar belongs beside the thing that records the proof, not beside the instrument.
 *
 * Usage:
 *   node scripts/motion-proof.mjs <url> [--json <path>]
 * Exit: 0 measured (the JSON summary on stdout), 2 skipped or bad arguments (the reason on
 * stderr, first line `motion-proof: skipped (<reason>)` for a skip).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { invokedDirectly } from "./lib/invoked-directly.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
// The browser ships with the capture engine, the same resolution gate-fidelity.mjs uses.
const engineRequire = createRequire(new URL("./reference-capture/", import.meta.url));

const SCROLL = 800;          // the distance every ratio is measured over
const SETTLE = 700;          // long enough for a transition or a rAF-driven handler to land
const SAMPLE_GAP = 600;      // the brief's gap between the two no-input samples
const MAX_ELEMENTS = 600;    // a bound, so a 3,000-node page is not a minute of sampling

const skip = (reason) => {
  process.stderr.write(`motion-proof: skipped (${reason})\n`);
  process.exitCode = 2;
};

/**
 * Everything that runs INSIDE the page. Playwright serialises this function's source and
 * evaluates it in the document, so it closes over nothing: every value it needs arrives in the
 * one argument.
 */
const pageScript = async ({ scroll, settle, gap, max }) => {
  const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const els = () => Array.from(document.querySelectorAll("*")).slice(0, max);

  const selectorFor = (el) => {
    const tag = el.tagName.toLowerCase();
    if (el.id) return tag + "#" + el.id;
    const cls = (el.getAttribute("class") || "").trim().split(/\s+/).filter(Boolean)[0];
    return cls ? tag + "." + cls : tag;
  };
  const translateY = (el) => {
    const t = getComputedStyle(el).transform;
    if (!t || t === "none") return 0;
    try { return new DOMMatrixReadOnly(t).m42; } catch { return 0; }
  };
  // Only the properties motion actually shows up in. Reading every property would report a
  // font finishing loading as movement.
  const sample = (el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return [s.transform, s.opacity, s.backgroundPosition, s.filter, s.clipPath,
      Math.round(r.top), Math.round(r.left), Math.round(r.width), Math.round(r.height)].join("|");
  };

  // --- the sticky header: the first full-width bar pinned at the top of the viewport -------
  const header = els().find((el) => {
    const s = getComputedStyle(el);
    if (s.position !== "sticky" && s.position !== "fixed") return false;
    const r = el.getBoundingClientRect();
    return r.height > 0 && r.top <= 4 && r.width >= innerWidth * 0.5;
  }) || null;

  // --- the parallax candidates: media inside the first two sections ------------------------
  const sections = Array.from(document.querySelectorAll("section")).slice(0, 2);
  const scopes = sections.length
    ? sections
    : Array.from((document.querySelector("main") || document.body).children).slice(0, 2);
  const candidates = [];
  const seen = new Set();
  for (const scope of scopes) {
    for (const el of [scope, ...scope.querySelectorAll("*")]) {
      if (seen.has(el) || candidates.length >= 40) continue;
      const tag = el.tagName.toLowerCase();
      const bg = getComputedStyle(el).backgroundImage;
      if (tag !== "img" && tag !== "video" && (!bg || bg === "none")) continue;
      seen.add(el);
      candidates.push({ el, selector: selectorFor(el), before: translateY(el) });
    }
  }

  const headerBefore = header ? Math.round(header.getBoundingClientRect().height) : null;

  // --- scroll, then let whatever the scroll started finish ---------------------------------
  window.scrollTo(0, scroll);
  await sleep(settle);
  const travelled = Math.max(1, Math.round(window.scrollY));

  const headerAfter = header ? Math.round(header.getBoundingClientRect().height) : null;
  const parallax = candidates.map((c) => ({
    selector: c.selector,
    ratio: Math.round((Math.abs(translateY(c.el) - c.before) / travelled) * 1000) / 1000,
  }));

  // --- declared animations ------------------------------------------------------------------
  const animated = els().filter((el) => {
    const n = getComputedStyle(el).animationName;
    return n && n !== "none";
  }).length;

  // --- and what changes on its own, which is the half no declaration covers ------------------
  const watched = els();
  const first = watched.map(sample);
  await sleep(gap);
  const second = watched.map(sample);
  let running = 0;
  for (let i = 0; i < watched.length; i++) if (first[i] !== second[i]) running++;

  return {
    header: { before: headerBefore, after: headerAfter },
    parallax,
    animated,
    running,
    scrolled: travelled,
  };
};

/**
 * @param {string} url
 * @returns {Promise<object|null>} the summary, or null once a skip has been recorded
 */
export async function measureMotion(url) {
  let playwright;
  try { playwright = engineRequire("playwright"); }
  catch {
    skip(`playwright is not installed (${join(HERE, "reference-capture", "setup.sh")}), so nothing was measured`);
    return null;
  }

  let browser;
  try {
    browser = await playwright.chromium.launch();
  } catch (e) {
    skip(`the browser would not start (${String(e.message || e).split("\n")[0].slice(0, 160)})`);
    return null;
  }

  const args = { scroll: SCROLL, settle: SETTLE, gap: SAMPLE_GAP, max: MAX_ELEMENTS };
  try {
    // Two contexts rather than two launches: the reduced pass is a different person's
    // settings, not a different page.
    const pass = async (reducedMotion) => {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion });
      try {
        const page = await ctx.newPage();
        await page.goto(url, { waitUntil: "load", timeout: 25_000 });
        return await page.evaluate(pageScript, args);
      } finally { await ctx.close(); }
    };

    let full;
    try {
      full = await pass("no-preference");
    } catch (e) {
      skip(`${url} did not load (${String(e.message || e).split("\n")[0].slice(0, 160)})`);
      return null;
    }
    // The reduced pass is a SECOND fact about the same page, so its failure is not the page
    // failing to load: report the measurement and say the reduced half is unknown.
    let reduced = null;
    try { reduced = await pass("reduce"); } catch { reduced = null; }

    return {
      url,
      header: full.header,
      parallax: full.parallax,
      animated: full.animated,
      running: full.running,
      scrolled: full.scrolled,
      reduced: reduced ? { animated: reduced.animated, running: reduced.running } : null,
    };
  } finally {
    // `process.exitCode`, never `process.exit()`: killing the process here leaves a Chromium
    // behind and truncates whatever was already on stdout.
    await browser.close().catch(() => {});
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const jsonAt = argv.indexOf("--json");
  const jsonPath = jsonAt >= 0 ? argv[jsonAt + 1] : null;
  if (jsonAt >= 0 && !jsonPath) {
    process.stderr.write("motion-proof: --json needs the path to write the summary to.\n");
    process.exitCode = 2;
    return;
  }
  const url = argv.find((a, i) => !a.startsWith("--") && argv[i - 1] !== "--json");
  if (!url) {
    process.stderr.write("motion-proof: give the url of the page to measure: node scripts/motion-proof.mjs <url> [--json <path>]\n");
    process.exitCode = 2;
    return;
  }
  if (!/^https?:\/\/\S+$/.test(url)) {
    process.stderr.write(`motion-proof: ${url} is not an http(s) url.\n`);
    process.exitCode = 2;
    return;
  }

  const summary = await measureMotion(url);
  if (!summary) return;   // the skip has been written and the exit code set

  const text = JSON.stringify(summary, null, 2);
  if (jsonPath) {
    const at = resolve(jsonPath);
    mkdirSync(dirname(at), { recursive: true });
    writeFileSync(at, text + "\n");
  }
  process.stdout.write(text + "\n");
}

if (invokedDirectly(import.meta.url)) await main();
