/**
 * motion-proof.test.mjs - the motion proof is a measurement, so it can be wrong.
 *
 * ===================== WHY THIS SUITE EXISTS =====================
 *
 * A real build recorded its proof of motion with `palate-pick.mjs --proof <url>` on the
 * agent's word. The board's motion note promised a 0.6x parallax on the hero image; when the
 * page was measured the image moved 7% of the scroll, and the person who opened the preview
 * said "there is no motion". Nothing in the plugin could have said otherwise, because the
 * proof was a URL and a timestamp: a claim, shaped like a record.
 *
 * So the probe has to produce numbers a fixture can disagree with. These assertions are the
 * disagreement: a page that genuinely moves reports a parallax ratio and an animation count,
 * a page that does not reports zeros, and the reduced-motion pass reports what survives
 * somebody asking their machine to stop moving things.
 *
 * Run: node --test scripts/test/motion-proof.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createServer } from "node:http";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const CLI = join(ROOT, "scripts", "motion-proof.mjs");

/**
 * A page that moves in all three ways the probe measures: a sticky header that shrinks, an
 * image driven off the scroll position at 0.4 of the distance, and a looping CSS animation
 * that switches itself off under reduced motion. Each of the three is a different measurement,
 * so a probe that only sees one of them fails here rather than in a client's browser.
 */
const MOVING = `<!doctype html><meta charset="utf-8"><title>Moving</title>
<style>
  body { margin: 0; font-family: system-ui, sans-serif; }
  header { position: sticky; top: 0; height: 120px; background: #222; color: #fff; }
  header.small { height: 60px; }
  section { min-height: 1400px; padding: 24px; }
  .pulse { width: 100px; height: 100px; background: #e2553d; animation: slide 1s infinite alternate; }
  @keyframes slide { from { transform: translateX(0); } to { transform: translateX(140px); } }
  @media (prefers-reduced-motion: reduce) { .pulse { animation: none; } }
</style>
<header id="top">Header</header>
<section id="one">
  <img id="para" width="400" height="300" alt="a still"
       src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==">
  <div class="pulse"></div>
</section>
<section id="two"><p>More copy, further down the page.</p></section>
<script>
  addEventListener("scroll", () => {
    document.getElementById("para").style.transform = "translateY(" + (scrollY * 0.4) + "px)";
    document.getElementById("top").classList.toggle("small", scrollY > 100);
  });
</script>`;

/** The same shape of page with nothing moving on it at all. */
const STATIC = `<!doctype html><meta charset="utf-8"><title>Still</title>
<style>
  body { margin: 0; font-family: system-ui, sans-serif; }
  header { height: 120px; background: #222; color: #fff; }
  section { min-height: 1400px; padding: 24px; }
</style>
<header id="top">Header</header>
<section id="one">
  <img id="para" width="400" height="300" alt="a still"
       src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==">
</section>
<section id="two"><p>More copy, further down the page.</p></section>`;

async function serve(html) {
  const s = createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  });
  await new Promise((ok) => s.listen(0, "127.0.0.1", ok));
  return { url: `http://127.0.0.1:${s.address().port}/`, close: () => new Promise((ok) => s.close(ok)) };
}

const run = async (args) => {
  try {
    const { stdout, stderr } = await promisify(execFile)(process.execPath, [CLI, ...args], { encoding: "utf8" });
    return { status: 0, stdout, stderr };
  } catch (e) {
    return { status: e.code ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
};

test("a page that moves reports the parallax, the animation and the header", async () => {
  const site = await serve(MOVING);
  try {
    const r = await run([site.url]);
    assert.equal(r.status, 0, `the probe did not finish:\n${r.stdout}${r.stderr}`);
    const out = JSON.parse(r.stdout);
    assert.equal(out.url, site.url);
    const best = Math.max(0, ...out.parallax.map((p) => p.ratio));
    assert.ok(best > 0.3, `the hero image moves at 0.4 of the scroll and the probe read ${best}`);
    assert.ok(out.parallax.some((p) => /para/.test(p.selector)), `no selector named the moving image: ${JSON.stringify(out.parallax)}`);
    assert.ok(out.animated >= 1, `a looping CSS animation is on the page and animated was ${out.animated}`);
    assert.ok(out.running >= 1, `the animation changes the page with no input and running was ${out.running}`);
    assert.notEqual(out.header.before, out.header.after, "the sticky header shrinks on scroll and the probe read one height");
  } finally { await site.close(); }
});

test("the reduced-motion pass reports what survives somebody asking for less", async () => {
  const site = await serve(MOVING);
  try {
    const r = await run([site.url]);
    assert.equal(r.status, 0, `the probe did not finish:\n${r.stdout}${r.stderr}`);
    const out = JSON.parse(r.stdout);
    assert.equal(out.reduced.running, 0, "the page stops its loop under reduce and the probe still saw it running");
    assert.equal(out.reduced.animated, 0, "the page drops its animation under reduce and the probe still counted it");
  } finally { await site.close(); }
});

test("a page that does not move reports zeros", async () => {
  const site = await serve(STATIC);
  try {
    const r = await run([site.url]);
    assert.equal(r.status, 0, `the probe did not finish:\n${r.stdout}${r.stderr}`);
    const out = JSON.parse(r.stdout);
    assert.equal(out.animated, 0);
    assert.equal(out.running, 0);
    assert.equal(out.header.before, out.header.after);
    for (const p of out.parallax) {
      assert.ok(p.ratio < 0.05, `nothing on this page moves and ${p.selector} read ${p.ratio}`);
    }
  } finally { await site.close(); }
});

test("--json writes the same summary to a file", async () => {
  const site = await serve(MOVING);
  const dir = mkdtempSync(join(tmpdir(), "motion-proof-"));
  try {
    const out = join(dir, "proof.json");
    const r = await run([site.url, "--json", out]);
    assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
    assert.deepEqual(JSON.parse(readFileSync(out, "utf8")), JSON.parse(r.stdout));
  } finally { await site.close(); rmSync(dir, { recursive: true, force: true }); }
});

test("a URL that does not load is a skip, not a measurement of nothing", async () => {
  // Port 1 on loopback: nothing listens there, and a refused connection is the commonest
  // shape of this in a real build (the preview died, or the tunnel was never up).
  const r = await run(["http://127.0.0.1:1/"]);
  assert.equal(r.status, 2, `a dead URL must skip, not pass:\n${r.stdout}${r.stderr}`);
  assert.match(r.stderr.split("\n")[0], /^motion-proof: skipped \(/, `the first stderr line is the skip line: ${r.stderr}`);
});

test("no URL is bad arguments", async () => {
  const r = await run([]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /url/i);
});
