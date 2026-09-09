/**
 * gate-facts.test.mjs - does the site contradict itself, and can the check say so without
 * crying wolf?
 *
 * THE COMPLAINT. An engineer's 3,400-page build said "42 reviews" in some places and "41
 * reviews" in others, and nothing noticed. The single-source rule this repo already has is
 * about PROVENANCE (one record, every surface reads it) and says nothing about CONSISTENCY,
 * because a number typed into two hand-written pages was never in the record to begin with.
 *
 * THE FAILURE MODE THAT MATTERS IS NOT THE MISS, IT IS THE FALSE ALARM. A consistency check
 * that fires on a blog post legitimately quoting a 2019 figure, or on a code sample, or on the
 * same phone number written two conventional ways, gets switched off inside a week and then
 * catches nothing at all. So most of what follows asserts SILENCE, and the assertions that
 * fire are deliberately narrow.
 *
 * Run: node --test scripts/test/gate-facts.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const CLI = join(ROOT, "scripts", "gate-facts.mjs");
const DONE = join(ROOT, "scripts", "gate-done.sh");
const DEEP = join(HERE, "fixtures", "manifest-deep.json");

const { extractFacts, disagreements } = await import(join(ROOT, "scripts", "gate-facts.mjs"));

const TMP = mkdtempSync(join(tmpdir(), "gate-facts-"));
process.on("exit", () => { try { rmSync(TMP, { recursive: true, force: true }); } catch { /* best effort */ } });

let n = 0;
/** A throwaway project with a built dist. `pages` maps a route to its body markup. */
function site(pages, { head = "" } = {}) {
  const dir = join(TMP, `site-${++n}`);
  for (const [route, body] of Object.entries(pages)) {
    const file = route === "/" ? "index.html" : `${route.replace(/^\//, "")}/index.html`;
    const abs = join(dir, "dist", file);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, `<!doctype html><html><head><title>t</title>${head}</head><body>${body}</body></html>`);
  }
  return dir;
}

/** Run the gate. Never throws: the exit code is part of what is being asserted. */
function run(dir) {
  try {
    const out = execFileSync(process.execPath, [CLI, dir], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout || ""}${e.stderr || ""}` };
  }
}
/** stdout and stderr together, the way gate-done.sh captures a sub-gate. */
function runMerged(dir) {
  const r = run(dir);
  if (r.code === 0) {
    // execFileSync only hands back stdout on success, so re-run capturing both streams.
    const merged = execFileSync("bash", ["-c", `node ${JSON.stringify(CLI)} ${JSON.stringify(dir)} 2>&1; exit 0`], { encoding: "utf8" });
    return { code: 0, out: merged };
  }
  return r;
}

const labels = (html) => extractFacts(html).map((f) => `${f.label}=${f.value}`);

// ------------------------------------------------------------------ extraction

test("a labelled count is a fact, and the label is normalised", () => {
  assert.deepEqual(labels("<p>Rated by 42 reviews this year.</p>"), ["reviews=42"]);
  assert.deepEqual(labels("<p>1 review so far.</p>"), ["reviews=1"]);
  // The value is normalised, so a thousands separator is not a second opinion.
  assert.deepEqual(labels("<p>4,200 reviews</p>"), ["reviews=4200"]);
});

test("a bare number is not a fact", () => {
  // The whole design: a number bound to a label the page states, never any number.
  assert.deepEqual(labels("<p>We have 42 of them and 41 of those.</p>"), []);
});

test("stars and rating are ONE label, and 4.9 and 4.90 are ONE value", () => {
  assert.deepEqual(labels("<p>4.9 stars</p>"), ["rating=4.9"]);
  assert.deepEqual(labels("<p>Our rating: 4.90</p>"), ["rating=4.9"]);
  assert.deepEqual(labels("<p>4.9 out of 5</p>"), ["rating=4.9"]);
  assert.deepEqual(labels("<p>4.9/5 stars</p>"), ["rating=4.9"]);
});

test("a date is not a rating", () => {
  // FOUND BY READING THE OUTPUT: `1/5/2024` was read as a rating of one, so any site printing
  // a day/month date in May argued with its own star rating. The slash form now refuses a
  // neighbour on either side.
  assert.deepEqual(labels("<p>Posted 1/5/2024. Sale ends 4/5/2026.</p>"), []);
});

test("a five-star CATEGORY claim is not a measured rating", () => {
  // "5 star service" is a boast, not an average, and reading it as one puts every site that
  // says both "5 star service" and "4.9 stars" permanently in disagreement with itself.
  assert.deepEqual(labels("<p>Five star service. 5 star treatment.</p>"), []);
});

test("years is the experience claim, not any span of years", () => {
  assert.deepEqual(labels("<p>Over 20 years of experience.</p>"), ["years experience=20"]);
  assert.deepEqual(labels("<p>25 years in business.</p>"), ["years in business=25"]);
  assert.deepEqual(labels("<p>Backed by a 3 year warranty.</p>"), []);
  assert.deepEqual(labels("<p>We moved here over 20 years ago.</p>"), []);
});

test("two different year claims in one sentence are two labels, not a contradiction", () => {
  // MEASURED, not imagined: this fired on the clean fixture built to test exactly that. The
  // sentence is ordinary and both halves are true, so the qualifier has to be part of the label.
  assert.deepEqual(
    labels("<p>25 years in the trade, 20 years in business under this name.</p>"),
    ["years in the trade=25", "years in business=20"],
  );
  assert.deepEqual(disagreements({
    "/": extractFacts("<p>25 years in the trade, 20 years in business.</p>"),
    "/about": extractFacts("<p>20 years in business.</p>"),
  }), []);
});

test("a phone number ignores spaces, brackets and the country code", () => {
  assert.deepEqual(labels('<a href="tel:+61298765432">Call</a>'), ["phone=0298765432"]);
  // The commonest markup there is: the href and the link text are the same number twice.
  assert.deepEqual(labels('<a href="tel:+61298765432">(02) 9876 5432</a>'), ["phone=0298765432"]);
  assert.deepEqual(labels("<p>Call (02) 9876 5432 today.</p>"), ["phone=0298765432"]);
  assert.deepEqual(labels("<p>Call +61 2 9876 5432 today.</p>"), ["phone=0298765432"]);
  assert.deepEqual(labels("<p>Call 1300 123 456.</p>"), ["phone=1300123456"]);
  // Too short to be a number anyone is reachable on. An emergency link is not a business line.
  assert.deepEqual(labels('<a href="tel:000">Emergency</a>'), []);
});

test("a year range and a price are not phone numbers", () => {
  assert.deepEqual(labels("<p>Trading 2019 - 2024. From $1,299 installed.</p>").filter((l) => l.startsWith("phone")), []);
});

test("an ABN is eleven digits under its own label", () => {
  assert.deepEqual(labels("<p>ABN 12 345 678 901</p>"), ["ABN=12345678901"]);
  assert.deepEqual(labels("<p>ABN: 12345678901</p>"), ["ABN=12345678901"]);
});

test("an opening-hours line carries its days as the label and a 24-hour range as the value", () => {
  assert.deepEqual(labels("<p>Mon-Fri 9am-5pm</p>"), ["hours mon-fri=09:00-17:00"]);
  assert.deepEqual(labels("<p>Monday to Friday: 9:00am - 5:00pm</p>"), ["hours mon-fri=09:00-17:00"]);
  assert.deepEqual(labels("<p>Saturday 9-1</p>"), ["hours sat=09:00-13:00"]);
});

test("a rating stacked above the word reviews is not nine reviews", () => {
  // A stat block renders the number and its label as separate elements, so the text collapses
  // to "4.9 reviews". Without the guard, the tail of the rating reads as a review count and
  // every site with a stat block permanently disagrees with its own review number.
  assert.deepEqual(labels("<div><span>4.9</span><span>reviews</span></div>"), []);
});

test("one claim is one fact, however many patterns notice it", () => {
  // "4.9/5 stars" answers two of the rating patterns. Counted twice it inflates every total
  // this gate prints, and on a real page it is one claim written once.
  assert.deepEqual(labels("<p>4.9/5 stars</p>"), ["rating=4.9"]);
});

test("every fact carries the context it was read from", () => {
  const [f] = extractFacts("<p>Trusted by 42 reviews from real customers.</p>");
  assert.ok(f.context.includes("42 reviews"), f.context);
});

// -------------------------------------------------------------- what is excluded

test("a code or pre block is not the site making a claim", () => {
  assert.deepEqual(labels("<pre>const n = 99; // 99 reviews</pre>"), []);
  assert.deepEqual(labels("<p>Use <code>42 reviews</code> as the label.</p>"), []);
});

test("a dated entry is excluded: a 2019 post legitimately says 38 reviews", () => {
  const post = `<article><h1>Our year</h1><p><time datetime="2019-06-01">1 June 2019</time></p>
    <p>We passed 38 reviews this month.</p></article>`;
  assert.deepEqual(labels(post), []);
});

test("a listing card carrying a date is excluded too", () => {
  const list = `<ul><li><a href="/blog/x"><h2>Old news</h2>
    <time datetime="2019-06-01">1 June 2019</time><p>38 reviews and counting.</p></a></li></ul>`;
  assert.deepEqual(labels(list), []);
});

test("a page whose own JSON-LD calls it an article is a dated entry, whole", () => {
  // The scaffold's post page emits BlogPosting. That is the page declaring itself a dated
  // entry, which is a stronger signal than any guess about the URL.
  const html = `<html><head><script type="application/ld+json">{"@type":"BlogPosting","headline":"x"}</script></head>
    <body><p>We passed 38 reviews this month.</p></body></html>`;
  assert.deepEqual(extractFacts(html), []);
});

test("an undated article still speaks", () => {
  // The exclusion is DATED content, not the <article> element. A services page wrapped in
  // <article> is the site's current claim and must still be compared.
  assert.deepEqual(labels("<article><p>42 reviews</p></article>"), ["reviews=42"]);
});

// ----------------------------------------------------------------- disagreement

test("two values for one label across pages is a disagreement, named on both sides", () => {
  const found = disagreements({
    "/": extractFacts("<p>42 reviews</p>"),
    "/about": extractFacts("<p>41 reviews</p>"),
  });
  assert.equal(found.length, 1);
  assert.equal(found[0].label, "reviews");
  assert.deepEqual(found[0].values.map((v) => v.value).sort(), ["41", "42"]);
  const pages = found[0].values.flatMap((v) => v.pages).sort();
  assert.deepEqual(pages, ["/", "/about"]);
});

test("one value everywhere is silent, and a label appearing once is silent", () => {
  assert.deepEqual(disagreements({
    "/": extractFacts("<p>42 reviews</p>"),
    "/about": extractFacts("<p>42 reviews</p>"),
    "/contact": extractFacts("<p>42 reviews</p>"),
  }), []);
  assert.deepEqual(disagreements({ "/": extractFacts("<p>42 reviews</p>"), "/about": [] }), []);
});

test("disagreements accepts a Map as well as an object", () => {
  const m = new Map([["/", extractFacts("<p>42 reviews</p>")], ["/about", extractFacts("<p>41 reviews</p>")]]);
  assert.equal(disagreements(m).length, 1);
});

// ------------------------------------------------------------------------- CLI

test("42 on one page and 41 on another fires exactly once, naming both pages", () => {
  const dir = site({ "/": "<p>Rated by 42 reviews.</p>", "/about": "<p>Read all 41 reviews.</p>" });
  const r = runMerged(dir);
  assert.equal(r.code, 0, r.out);                       // ADVISORY: never blocks
  assert.match(r.out, /gate-facts: 1 disagreement\(s\)/, r.out);
  assert.match(r.out, /\[reviews\]/, r.out);
  assert.match(r.out, /\b42\b/, r.out);
  assert.match(r.out, /\b41\b/, r.out);
  assert.match(r.out, /\/about/, r.out);
});

test("one value across every page is silent, and the clean line says how much it read", () => {
  const dir = site({ "/": "<p>42 reviews</p>", "/about": "<p>42 reviews</p>", "/contact": "<p>42 reviews</p>" });
  const r = runMerged(dir);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /gate-facts: clean/, r.out);
  assert.match(r.out, /inspected 3 page\(s\)/, r.out);
});

test("two different phone numbers fire", () => {
  const dir = site({ "/": '<a href="tel:+61298765432">Call</a>', "/contact": "<p>Call (02) 9876 5433.</p>" });
  const r = runMerged(dir);
  assert.match(r.out, /gate-facts: 1 disagreement\(s\)/, r.out);
  assert.match(r.out, /\[phone\]/, r.out);
});

test("the same phone written two conventional ways is NOT a disagreement", () => {
  const dir = site({ "/": "<p>+61 2 9876 5432</p>", "/contact": "<p>(02) 9876 5432</p>" });
  assert.match(runMerged(dir).out, /gate-facts: clean/);
});

test("4.9 stars against 4.7 rating is one label with two values", () => {
  const dir = site({ "/": "<p>4.9 stars</p>", "/reviews": "<p>Our rating: 4.7</p>" });
  const r = runMerged(dir);
  assert.match(r.out, /gate-facts: 1 disagreement\(s\)/, r.out);
  assert.match(r.out, /\[rating\]/, r.out);
});

test("4.9 stars against a 4.90 rating is silent", () => {
  assert.match(runMerged(site({ "/": "<p>4.9 stars</p>", "/reviews": "<p>Our rating: 4.90</p>" })).out, /gate-facts: clean/);
});

test("a post saying 38 reviews does not argue with the home page", () => {
  const dir = site({
    "/": "<p>41 reviews</p>",
    "/blog/2019": '<article><time datetime="2019-06-01">1 June 2019</time><p>We passed 38 reviews.</p></article>',
  });
  assert.match(runMerged(dir).out, /gate-facts: clean/);
});

test("a 404 page is never compared", () => {
  const dir = site({ "/": "<p>Call (02) 9876 5432.</p>" });
  mkdirSync(join(dir, "dist"), { recursive: true });
  writeFileSync(join(dir, "dist", "404.html"), "<html><body><p>Call (02) 9876 9999.</p></body></html>");
  const r = runMerged(dir);
  assert.match(r.out, /gate-facts: clean/, r.out);
  assert.match(r.out, /inspected 1 page\(s\)/, r.out);
});

test("a label with many values is a list, set aside by name rather than reported", () => {
  // A product grid rates every card and a multi-branch site has a phone per location. Every
  // value is correct, and calling twelve of them a contradiction is the false alarm that gets
  // a check switched off. It is NAMED, though: a check that quietly stops looking is worse.
  const dir = site({
    "/": "<p>4.9 stars</p>", "/a": "<p>4.7 stars</p>", "/b": "<p>4.5 stars</p>",
    "/c": "<p>4.2 stars</p>", "/d": "<p>3.9 stars</p>",
  });
  const r = runMerged(dir);
  assert.match(r.out, /gate-facts: clean/, r.out);
  assert.match(r.out, /set aside as a list/, r.out);
  assert.match(r.out, /rating \(5 values\)/, r.out);
});

test("a real disagreement still fires beside a list that was set aside", () => {
  const dir = site({
    "/": "<p>4.9 stars. 42 reviews.</p>", "/a": "<p>4.7 stars</p>", "/b": "<p>4.5 stars</p>",
    "/c": "<p>4.2 stars</p>", "/about": "<p>3.9 stars. 41 reviews.</p>",
  });
  const r = runMerged(dir);
  assert.match(r.out, /gate-facts: 1 disagreement\(s\)/, r.out);
  assert.match(r.out, /\[reviews\]/, r.out);
  assert.match(r.out, /set aside as a list/, r.out);
});

test("no built output is a SKIP with a reason, never a pass", () => {
  const dir = join(TMP, "unbuilt");
  mkdirSync(join(dir, "src", "pages"), { recursive: true });
  const r = run(dir);
  assert.equal(r.code, 2, r.out);
  assert.match(r.out, /gate-facts: skipped \(/, r.out);
  assert.match(r.out, /NOT a pass/, r.out);
});

test("a built output with no page in it is a SKIP, never a pass", () => {
  const dir = join(TMP, "emptydist");
  mkdirSync(join(dir, "dist", "_astro"), { recursive: true });
  writeFileSync(join(dir, "dist", "_astro", "x.html"), "<html><body><p>42 reviews</p></body></html>");
  const r = run(dir);
  assert.equal(r.code, 2, r.out);
  assert.match(r.out, /gate-facts: skipped \(/, r.out);
});

test("a page too big to be prose is not inspected, and inspecting nothing is a SKIP", () => {
  const dir = join(TMP, "huge");
  mkdirSync(join(dir, "dist"), { recursive: true });
  writeFileSync(join(dir, "dist", "index.html"), `<html><body><p>42 reviews</p>${"x".repeat(2_100_000)}</body></html>`);
  const r = run(dir);
  assert.equal(r.code, 2, r.out);
  assert.match(r.out, /gate-facts: skipped \(/, r.out);
});

test("it refuses to grade the plugin itself", () => {
  const r = run(ROOT);
  assert.equal(r.code, 2, r.out);
  assert.match(r.out, /gate-facts: refused:/, r.out);
});

// -------------------------------------------------------- folded into the done gate

/** A project the done gate will actually read: manifest, verifier report and shots. */
function doneProject(name, pages) {
  const dir = join(TMP, name);
  mkdirSync(join(dir, ".palate-shots"), { recursive: true });
  cpSync(DEEP, join(dir, "build-manifest.json"));
  writeFileSync(join(dir, ".palate-shots", "desktop-full.png"), Buffer.from("89504e470d0a1a0a", "hex"));
  writeFileSync(join(dir, ".palate-shots", "manifest.json"), JSON.stringify({ status: "captured", console_errors: 0, shots: { desktop_full: "desktop-full.png" } }));
  writeFileSync(join(dir, ".palate-shots", "errors.json"), "[]");
  writeFileSync(join(dir, "verify-report.json"), JSON.stringify({
    verdict: "pass",
    visual: { ran: true, pass: true, console_errors: 0, iterations: [{ i: 1, axes: { philosophy: 5 }, score: 25, shots: { desktop_full: ".palate-shots/desktop-full.png" } }] },
    shots_dir: ".palate-shots",
  }));
  for (const [route, body] of Object.entries(pages || {})) {
    const file = route === "/" ? "index.html" : `${route.replace(/^\//, "")}/index.html`;
    const abs = join(dir, "dist", file);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, `<!doctype html><html><head><title>t</title></head><body>${body}</body></html>`);
  }
  return dir;
}

function done(dir) {
  try {
    return { code: 0, out: execFileSync("bash", ["-c", `bash ${JSON.stringify(DONE)} ${JSON.stringify(join(dir, "build-manifest.json"))} 2>&1; exit 0`], { encoding: "utf8" }) };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout || ""}${e.stderr || ""}` };
  }
}

test("the done gate folds the count in and does not block on it", () => {
  const dir = doneProject("done-clash", { "/": "<p>42 reviews</p>", "/about": "<p>41 reviews</p>" });
  const r = done(dir);
  assert.match(r.out, /Done gate: /, r.out);
  assert.match(r.out, /facts=1 disagreement\(s\)/, r.out);
  assert.doesNotMatch(r.out, /Done gate FAILED/, r.out);
});

test("the summary names the command that prints the detail", () => {
  // A count with no route to it is a finding nobody can act on. The operator should not have
  // to already know this script exists, and the line has to be INDENTED or the Stop hook drops
  // it: it forwards a matched headline's indented continuation lines and nothing else.
  const dir = doneProject("done-detail", { "/": "<p>42 reviews</p>", "/about": "<p>41 reviews</p>" });
  const r = done(dir);
  assert.match(r.out, /^ {2}Facts: 1 label\(s\) carry two values across pages\./m, r.out);
  assert.match(r.out, /node "[^"]*gate-facts\.mjs" "[^"]*done-detail"/, r.out);
});

test("the done gate reports a clean facts pass as clean, and says nothing more", () => {
  const dir = doneProject("done-clean", { "/": "<p>42 reviews</p>", "/about": "<p>42 reviews</p>" });
  const r = done(dir);
  assert.match(r.out, /facts=clean/, r.out);
  // No pointer when there is nothing to point at: the summary is read every build.
  assert.doesNotMatch(r.out, /^ {2}Facts:/m, r.out);
});

test("with no dist the done gate reports facts as skipped, with a reason", () => {
  const dir = doneProject("done-nodist", null);
  const r = done(dir);
  assert.match(r.out, /facts=skipped/, r.out);
  assert.match(r.out, /facts: /, r.out);          // the reason travels in the count clause
  assert.doesNotMatch(r.out, /facts=clean/, r.out);
});
