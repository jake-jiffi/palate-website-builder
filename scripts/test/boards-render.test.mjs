/**
 * boards-render.test.mjs - the artboards, against a real build in a real browser.
 *
 * Everything this script writes is consumed by something that cannot report a fault. The canvas
 * silently renders a broken image for a src it cannot resolve, silently runs nothing for a
 * module whose import it cannot fetch, and silently mis-frames an artboard whose declared
 * height is wrong. So the assertions here are about the FILE, not about the run finishing:
 * the skeleton the editor requires, one script and no more, every image a bare filename that
 * exists and fits, and a canvas.json whose geometry matches what was rendered.
 *
 * The last block is the one that matters most: a registered board with no page must leave NO
 * seed directory. Half a set handed to a client reads as the whole set.
 *
 * Slow: an npm install, an astro build and a browser. scripts/test/run.sh skips it under
 * --fast. Run: node --test scripts/test/boards-render.test.mjs
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync, mkdirSync, statSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { PROPERTY_LIST, parseRegistry, writeCanvasJson, toArtboard } from "../boards-render.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const CLI = join(ROOT, "scripts", "boards-render.mjs");
const PORT = 8796; // reserved for this suite; 8791 and 8797 belong to the others

let TMP = null;
let SITE = null;
let ready = false;
let skipReason = "";

const BOARDS = [
  {
    id: "b1", name: "The Quiet Room", ambition: 1, section: "services", donor: "therapy-in-london",
    what: "One column, one photograph, and a great deal of air.",
    why: "The people arriving are anxious and have been dismissed once already.",
    feeling: "unhurried, private, adult",
    motion: "Nothing moves on load; a single slow fade carries the photograph in.",
    ctas: ["Book a first visit", "Ask a question"],
  },
  {
    id: "b2", name: "The Long Table", ambition: 2, section: "proof", donor: "the-modern-house",
    what: "A wide table of the work, read left to right.",
    why: "This buyer compares before they commit, so the comparison is the page.",
    feeling: "candid, unhurried",
    motion: "Rows settle into place as the table is scrolled, one after another.",
    ctas: ["See the work", "Start a project", "Ask about a fit"],
  },
];

function registryFor(boards) {
  const entries = boards.map((b) => `  {
    id: ${JSON.stringify(b.id)},
    name: ${JSON.stringify(b.name)},
    href: ${JSON.stringify(`/boards/${b.id}`)},
    ambition: ${b.ambition},
    what: ${JSON.stringify(b.what)},
    why: ${JSON.stringify(b.why)},
    feeling: ${JSON.stringify(b.feeling)},
    donor: ${JSON.stringify(b.donor)},
    section: ${JSON.stringify(b.section)},
    motion: ${JSON.stringify(b.motion)},
    ctas: ${JSON.stringify(b.ctas)},
  },`).join("\n");
  return `export interface Variant {
  id: string; name: string; href: string; ambition: number; what: string; why: string;
  feeling: string; donor: string; section: string; motion: string; ctas: string[];
  clip?: string; lookAt?: string;
}
export const variants: Variant[] = [
${entries}
];
export const landingVariants: Variant[] = [];
export function byAmbition(list: Variant[]): Variant[] {
  return [...list].sort((a, b) => (a.ambition ?? 0) - (b.ambition ?? 0));
}
`;
}

function boardPage(b) {
  return `---
import BoardFrame from "../../layouts/BoardFrame.astro";
import SectionMark from "../../components/SectionMark.astro";
import { variants } from "../../lib/variants";
const variant = variants.find((v) => v.id === ${JSON.stringify(b.id)});
---
{variant && (
  <BoardFrame variant={variant}>
    <section slot="hero" class="bg-brand-bg relative px-6 py-24">
      <SectionMark id="${b.id}-hero" />
      <h1 class="font-display text-brand-text text-5xl">${b.name}</h1>
      <p class="text-brand-muted mt-6 max-w-xl">${b.what}</p>
      <img src="/_fixture/photo.png" alt="A fixture photograph" width="640" height="400" />
    </section>
    <section slot="section" class="bg-brand-bg relative px-6 py-20">
      <SectionMark id="${b.id}-${b.section}" />
      <h2 class="font-display text-brand-text text-3xl">${b.section}</h2>
      {/* A third-party tag IN THE BODY. Astro hoists its own scripts to the head, which the
          artboard never serialises, so without this the stripping assertions would be true by
          construction and would pass on a script-stripper that had been deleted. */}
      <script is:inline src="https://tracker.example.com/t.js"></script>
      {/* And the site's own motion, self-contained and declared, which SHOULD travel. */}
      <script is:inline data-palate-motion>
        document.querySelectorAll("[data-reveal]").forEach((n) => n.classList.add("is-in"));
      </script>
    </section>
  </BoardFrame>
)}
`;
}

const run = async (args, opts = {}) => {
  try {
    const { stdout, stderr } = await promisify(execFile)(process.execPath, [CLI, ...args], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, ...opts });
    return { status: 0, stdout, stderr };
  } catch (e) {
    return { status: e.code ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
};

before(async () => {
  if (!existsSync(join(ROOT, "scripts/reference-capture/node_modules/playwright"))) {
    skipReason = "playwright is not installed (scripts/reference-capture/setup.sh); the artboards are UNPROVEN.";
    return;
  }
  TMP = mkdtempSync(join(tmpdir(), "boards-render-"));
  SITE = join(TMP, "site");
  try {
    execFileSync("bash", ["-c",
      `set -e; export SCAFFOLD_TEMPLATE="${join(ROOT, "templates/astro-project")}"; ` +
      `. "${join(HERE, "lib/scaffold-site.sh")}"; scaffold_site "${SITE}" boardtest`,
    ], { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
  } catch (e) {
    skipReason = `the scaffold fixture could not be stood up: ${(e.stderr || e.message || "").toString().slice(-400)}`;
    return;
  }
  writeFileSync(join(SITE, "src/lib/variants.ts"), registryFor(BOARDS));
  mkdirSync(join(SITE, "src/pages/boards"), { recursive: true });
  rmSync(join(SITE, "src/pages/boards/b1.astro"), { force: true });
  for (const b of BOARDS) writeFileSync(join(SITE, `src/pages/boards/${b.id}.astro`), boardPage(b));
  // A real raster the flattener has to carry into the seed directory.
  mkdirSync(join(SITE, "public/_fixture"), { recursive: true });
  writeFileSync(join(SITE, "public/_fixture/photo.png"), pngFixture(640, 400));
  ready = true;
});

after(() => { if (TMP) rmSync(TMP, { recursive: true, force: true }); });

/** A real PNG: a soft gradient, which is how a website capture actually compresses. */
function pngFixture(w, h) {
  const chunks = [];
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c >>> 0;
  }
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const cc = Buffer.alloc(4); cc.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, cc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    const o = y * (1 + w * 3);
    raw[o] = 0;
    for (let x = 0; x < w; x++) {
      raw[o + 1 + x * 3] = Math.round((x / w) * 255);
      raw[o + 2 + x * 3] = Math.round((y / h) * 255);
      raw[o + 3 + x * 3] = Math.round(((x + y) / (w + h)) * 255);
    }
  }
  chunks.push(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  chunks.push(chunk("IHDR", ihdr));
  chunks.push(chunk("IDAT", deflateSync(raw)));
  chunks.push(chunk("IEND", Buffer.alloc(0)));
  return Buffer.concat(chunks);
}

// ------------------------------------------------------------------ pure units
test("the property list is what the canvas panel edits", () => {
  for (const p of ["color", "background-color", "font-family", "font-size", "padding", "grid-template-columns"]) {
    assert.ok(PROPERTY_LIST.includes(p), `${p} is missing from PROPERTY_LIST`);
  }
});

test("the registry parser ignores the commented-out example", () => {
  const src = readFileSync(join(ROOT, "templates/astro-project/src/lib/variants.ts"), "utf8");
  assert.equal(parseRegistry(src).length, 0, "the shipped template registers nothing, and its example is a comment");
  assert.equal(parseRegistry(registryFor(BOARDS)).length, 2);
});

test("an artboard carries the skeleton the editor replaces, verbatim", () => {
  const a = toArtboard({ html: "<p>hi</p>", css: "p{color:red}", name: "b1 Test" });
  assert.ok(a.startsWith("<!doctype html>"));
  assert.ok(a.includes('<script src="./support.js"></script>'));
  assert.ok(a.includes("<x-dc><helmet><style>"));
  assert.ok(a.includes("</x-dc></body></html>"));
});

test("canvas.json puts the references on row 0 and the boards 120px below", () => {
  const doc = writeCanvasJson({
    boards: [
      { file: "B1.dc.html", id: "b1", ambition: 1, name: "One", height: 2000, feeling: "quiet", what: "A" },
      { file: "B2.dc.html", id: "b2", ambition: 2, name: "Two", height: 2400, feeling: "loud", what: "B" },
    ],
    refs: [{ position: 1, name: "Ref one", slug: "one", why: "restrained" }],
    out: null,
  });
  const refFrame = doc.artboards.find((a) => a.file === "Ref1.dc.html");
  const b1 = doc.artboards.find((a) => a.file === "B1.dc.html");
  const b2 = doc.artboards.find((a) => a.file === "B2.dc.html");
  assert.equal(refFrame.y, 0);
  assert.equal(b1.y, refFrame.h + 120, "120px between rows");
  assert.equal(b2.x - (b1.x + b1.w), 80, "80px between frames in a row");
  assert.equal(b1.h, 2000, "the frame height is the rendered height, never a guess");
  assert.equal(doc.launch.view, "canvas");
  assert.ok(doc.annotations.some((a) => a.id === "cal-q"), "the calibration question is annotated");
  for (const a of doc.annotations) assert.match(a.id, /^[A-Za-z0-9_-]{1,40}$/);
});

// ---------------------------------------------------------------- the real run
test("two boards render to two artboards the canvas can open", async (t) => {
  if (!ready) return t.skip(skipReason);
  const r = await run([SITE, "--port", String(PORT)]);
  assert.equal(r.status, 0, `boards-render failed:\n${r.stderr}`);

  const seed = join(SITE, ".palate/explore/seed");
  for (const f of ["B1.dc.html", "B2.dc.html", "canvas.json", "README.md"]) {
    assert.ok(existsSync(join(seed, f)), `${f} is missing from the seed`);
  }

  for (const f of ["B1.dc.html", "B2.dc.html"]) {
    const a = readFileSync(join(seed, f), "utf8");
    assert.ok(a.startsWith("<!doctype html>"), `${f} does not open with the doctype`);
    assert.ok(a.includes('<script src="./support.js"></script>'), `${f} is missing the support line`);
    assert.ok(a.includes("<x-dc>"), `${f} has no x-dc root`);
    assert.ok(a.includes("<helmet><style>"), `${f} has no helmet`);

    // ONE script, or one plus an inlined motion script. Anything else is a third-party tag
    // that would silently fail inside a canvas with no network.
    const scripts = a.match(/<script\b/g) || [];
    assert.equal(scripts.length, 2, `${f} carries ${scripts.length} script tags; only support.js and the inlined motion script may travel`);
    assert.equal((a.match(/<script src=/g) || []).length, 1, `${f} carries an external script other than support.js`);
    assert.ok(!/tracker\.example\.com/.test(a), `${f} still carries a third-party tag, which cannot load inside a canvas with no network`);
    assert.ok(!/https:\/\/app\.humblytics\.com/.test(a), `${f} still carries the analytics tag`);
    assert.ok(a.includes('data-reveal'), `${f} dropped the site's own motion script, so the board is a still that says it moves`);

    // Every image is a bare filename that exists beside the artboard and fits.
    for (const m of a.matchAll(/<img\b[^>]*\bsrc="([^"]*)"/g)) {
      const src = m[1];
      assert.ok(!/[/:]/.test(src), `${f} references ${src}, which is not a bare filename`);
      const p = join(seed, src);
      assert.ok(existsSync(p), `${f} references ${src}, which is not in the seed directory`);
      assert.ok(statSync(p).size <= 70 * 1024, `${src} is ${Math.round(statSync(p).size / 1024)} KB, over the 70 KB ceiling`);
    }
    assert.ok(!/\bsrcset=/.test(a), `${f} keeps a srcset, which overrides the bare filename with a URL the canvas cannot fetch`);

    // The flattening actually happened: the panel has something to edit.
    assert.ok(/style="[^"]*font-size:/.test(a), `${f} has no inline font-size, so the property panel edits nothing`);
    assert.ok(/style="[^"]*color:/.test(a), `${f} has no inline colour`);
  }

  const canvas = JSON.parse(readFileSync(join(seed, "canvas.json"), "utf8"));
  assert.equal(canvas.artboards.length, 2);
  const [f1, f2] = canvas.artboards;
  assert.equal(f2.x - (f1.x + f1.w), 80, "80px between frames");
  assert.equal(f1.w, 1440);
  assert.ok(f1.h > 800, `the frame height reads ${f1.h}, which is not a rendered page`);
  assert.equal(canvas.annotations.length, 2, "one annotation per board");
  assert.equal(canvas.launch.view, "canvas");

  // The shots the fidelity gate and /explore read.
  for (const id of ["b1", "b2"]) {
    assert.ok(existsSync(join(SITE, ".palate/explore/shots", id, "rendered.html")));
    assert.ok(existsSync(join(SITE, ".palate/explore/shots", id, "hero.png")));
    assert.ok(existsSync(join(SITE, "public/_explore", `${id}.png`)));

    const archived = readFileSync(join(SITE, ".palate/explore/shots", id, "rendered.html"), "utf8");

    // BUILT IN EXPLORE MODE, or the boards do not exist in the output. SectionMark renders
    // nothing without PUBLIC_EXPLORE_MODE, so the archived renders came back with no section
    // ids at all and gate-fidelity skipped with "its sections cannot be identified" on a build
    // that had done everything right. Found by running the whole loop, not by reading it.
    assert.match(archived, new RegExp(`data-section-id="${id}-hero"`),
      `${id}'s archived render carries no section id, so nothing downstream can identify its sections`);

    // SELF-CONTAINED, because it has to outlive the build it came from. The render links
    // /_astro/<hash>.css; Compose rebuilds, the hash changes, the old file is gone, and the
    // archived board renders UNSTYLED. gate-fidelity then measured a page with no palette and
    // no type scale and called both "could not be compared" on an honest build.
    assert.match(archived, /data-palate-archived-css/, `${id}'s archived render carries no stylesheet of its own`);
    assert.ok(!/<link\b[^>]*rel=["']stylesheet["']/i.test(archived),
      `${id}'s archived render still links a stylesheet, which the next build renames`);
  }
  assert.match(r.stdout, /B1\.dc\.html \d+ KB/, "the run does not report the artboard sizes");
});

test("the calibration references land on row 0 with the question", async (t) => {
  if (!ready) return t.skip(skipReason);
  const refsDir = join(SITE, ".palate/explore");
  mkdirSync(join(refsDir, "refshots"), { recursive: true });
  const refs = [
    { slug: "aesop", name: "Aesop", position: 1, why: "Restrained: one photograph and a great deal of air.", screenshot: "refshots/aesop.png" },
    { slug: "leoleo", name: "Leo Leo", position: 2, why: "In the middle: confident type, quiet motion.", screenshot: "refshots/leoleo.png" },
    { slug: "utsubo", name: "Utsubo", position: 3, why: "Bold: the entrance is an interaction, not a banner.", screenshot: "refshots/utsubo.png" },
  ];
  for (const r of refs) writeFileSync(join(refsDir, r.screenshot), pngFixture(1440, 900));
  writeFileSync(join(refsDir, "refs.json"), JSON.stringify(refs, null, 2));

  const r = await run([SITE, "--port", String(PORT), "--no-build", "--refs", ".palate/explore/refs.json"]);
  assert.equal(r.status, 0, `boards-render with --refs failed:\n${r.stderr}`);

  const seed = join(SITE, ".palate/explore/seed");
  for (const n of [1, 2, 3]) {
    const f = join(seed, `Ref${n}.dc.html`);
    assert.ok(existsSync(f), `Ref${n}.dc.html is missing`);
    const a = readFileSync(f, "utf8");
    assert.ok(a.startsWith("<!doctype html>"));
    assert.ok(a.includes('<script src="./support.js"></script>'));
    assert.ok(a.includes("<x-dc><helmet><style>"));
    // The canvas rules require a and a:hover to be defined in the helmet.
    assert.match(a, /a\{[^}]*color:/, `Ref${n} does not define a link colour in the helmet`);
    assert.match(a, /a:hover\{[^}]*color:/, `Ref${n} does not define a:hover in the helmet`);
    const img = /<img\b[^>]*\bsrc="([^"]*)"/.exec(a);
    assert.ok(img, `Ref${n} carries no screenshot`);
    assert.ok(!/[/:]/.test(img[1]), `Ref${n} references ${img[1]}, which is not a bare filename`);
    assert.ok(existsSync(join(seed, img[1])));
    assert.ok(statSync(join(seed, img[1])).size <= 70 * 1024, `${img[1]} is over the 70 KB ceiling`);
  }
  assert.ok(readFileSync(join(seed, "Ref1.dc.html"), "utf8").includes("one photograph and a great deal of air"),
    "the reference does not say why it sits where it does on the range");

  const canvas = JSON.parse(readFileSync(join(seed, "canvas.json"), "utf8"));
  const row0 = canvas.artboards.filter((a) => a.y === 0);
  assert.equal(row0.length, 3, "the three references are not all on row 0");
  assert.equal(row0[1].x - (row0[0].x + row0[0].w), 80, "80px between the reference frames");
  const boardRow = canvas.artboards.filter((a) => a.file.startsWith("B"));
  assert.equal(boardRow[0].y, row0[0].h + 120, "the boards are not 120px below the references");
  const q = canvas.annotations.find((a) => a.id === "cal-q");
  assert.ok(q, "there is no calibration annotation");
  assert.ok(q.y < 0, "the calibration question is not above row 0");
  assert.match(q.text, /how bold you want to be/i);

  rmSync(join(refsDir, "refs.json"), { force: true });
});

test("an SVG over the ceiling is refused rather than shipped broken", async (t) => {
  if (!ready) return t.skip(skipReason);
  // A RASTER ALMOST ALWAYS FITS. The ladder walks down to 640 wide at quality 38, and 1440x900
  // of pure per-pixel noise lands at 33 KB there, so a photograph cannot exercise the refusal.
  // An SVG can and does: it is already lossless, re-encoding a diagram as a photograph would be
  // worse in every way, so it travels whole or not at all. A 90 KB path-heavy logo is ordinary.
  const big = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
    Array.from({ length: 2600 }, (_, i) => `<path d="M${i % 97}.${i % 7} ${i % 89}.${i % 3}l1.5 2.25 3.75-1.125z" fill="#2f5d50"/>`).join("") +
    `</svg>`;
  assert.ok(Buffer.byteLength(big) > 70 * 1024, "the fixture SVG is not actually over the ceiling");
  writeFileSync(join(SITE, "public/_fixture/big.svg"), big);
  const page = readFileSync(join(SITE, "src/pages/boards/b1.astro"), "utf8");
  writeFileSync(join(SITE, "src/pages/boards/b1.astro"),
    page.replace('src="/_fixture/photo.png"', 'src="/_fixture/big.svg"'));

  const rebuilt = await run([SITE, "--port", String(PORT)]);
  assert.equal(rebuilt.status, 2, "an SVG over the ceiling must exit 2");
  assert.match(rebuilt.stderr, /b1/, "the refusal does not name the board");
  assert.match(rebuilt.stderr, /cannot be downsampled under 70 KB/);
  assert.ok(!existsSync(join(SITE, ".palate/explore/seed")), "a seed was left behind");

  writeFileSync(join(SITE, "src/pages/boards/b1.astro"), page);
  rmSync(join(SITE, "public/_fixture/big.svg"), { force: true });
  // Put the seed back so the next test has one to destroy.
  const restored = await run([SITE, "--port", String(PORT)]);
  assert.equal(restored.status, 0, `the restore build failed:\n${restored.stderr}`);
});

test("a calibration reference missing its screenshot is refused", async (t) => {
  if (!ready) return t.skip(skipReason);
  const refsDir = join(SITE, ".palate/explore");
  writeFileSync(join(refsDir, "refs.json"), JSON.stringify([
    { slug: "aesop", name: "Aesop", position: 1, why: "Restrained.", screenshot: "refshots/gone.png" },
  ]));
  const r = await run([SITE, "--port", String(PORT), "--no-build", "--refs", ".palate/explore/refs.json"]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /aesop/, "the refusal does not name the reference");
  rmSync(join(refsDir, "refs.json"), { force: true });
});

test("a registered board with no page leaves NO seed behind", async (t) => {
  if (!ready) return t.skip(skipReason);
  const seed = join(SITE, ".palate/explore/seed");
  // Its own setup, not the previous test's leftovers: every refusal clears the seed, so
  // whether one is on disk here depends on which tests ran before this one.
  const seeded = await run([SITE, "--port", String(PORT)]);
  assert.equal(seeded.status, 0, `the setup render failed:\n${seeded.stderr}`);
  assert.ok(existsSync(seed), "the setup render wrote no seed");

  const three = [...BOARDS, {
    id: "b3", name: "The Loud Room", ambition: 3, section: "menu", donor: "utsubo",
    what: "A full-bleed type wall.", why: "This launch has to be seen from across a room.",
    feeling: "brash, certain", motion: "The wall scrubs with the scroll.",
    ctas: ["Get tickets", "See the line-up"],
  }];
  writeFileSync(join(SITE, "src/lib/variants.ts"), registryFor(three));

  const r = await run([SITE, "--port", String(PORT), "--no-build"]);
  assert.equal(r.status, 2, "a board with no page must exit 2");
  assert.match(r.stderr, /b3/, "the failure does not name the board");
  assert.ok(!existsSync(seed), "a partial seed was left on disk, and half a set reads as the whole set");

  writeFileSync(join(SITE, "src/lib/variants.ts"), registryFor(BOARDS));
});
