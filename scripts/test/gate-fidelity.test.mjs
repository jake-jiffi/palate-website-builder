/**
 * gate-fidelity.test.mjs - does the built home page actually carry the direction the client
 * picked?
 *
 * This is the one promise Explore makes that nothing has ever checked. A client picks rung 3,
 * Compose writes the home page, and whether the thing they chose survived the trip has until
 * now been a matter of the builder's own opinion at the moment they were most invested in the
 * answer. The interesting failure is not a wrong page, it is a plausible one: the same layout
 * in a slightly different accent, the same accent at a slightly different type scale, the
 * picked section quietly dropped.
 *
 * So the assertions are about the gate catching a plausible drift and refusing to claim
 * anything it did not measure.
 *
 * Slow: an npm install, two builds and a browser. run.sh skips it under --fast.
 * Run: node --test scripts/test/gate-fidelity.test.mjs
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const CLI = join(ROOT, "scripts", "gate-fidelity.mjs");
const RENDER = join(ROOT, "scripts", "boards-render.mjs");
const PORT = 8791; // reserved for this suite

let TMP = null;
let SITE = null;
let ready = false;
let skipReason = "";

const REGISTRY = `export interface Variant {
  id: string; name: string; href: string; ambition: number; what: string; why: string;
  feeling: string; donor: string; section: string; motion: string; ctas: string[];
  clip?: string; lookAt?: string;
}
export const variants: Variant[] = [
  {
    id: "b1", name: "The Quiet Room", href: "/boards/b1", ambition: 1,
    what: "One column, one photograph, and a great deal of air.",
    why: "The people arriving are anxious and have been dismissed once already.",
    feeling: "unhurried, private, adult",
    donor: "therapy-in-london", section: "services",
    motion: "Nothing moves on load; the photograph fades in once it is scrolled to.",
    ctas: ["Book a first visit", "Ask a question"],
  },
];
export const landingVariants: Variant[] = [];
export function byAmbition(list: Variant[]): Variant[] {
  return [...list].sort((a, b) => (a.ambition ?? 0) - (b.ambition ?? 0));
}
`;

/** The two sections the board shows, written once and used by both the board and the home. */
const HERO = (mark) => `
<section class="relative px-6 py-24" style="background:#f7f5ee">
  ${mark}
  <div class="mx-auto max-w-3xl">
    <h1 style="font-family:Georgia,serif;font-size:64px;line-height:1.08;color:#1c1b19">Quiet confidence, in a room that holds it</h1>
    <p style="font-family:Helvetica,Arial,sans-serif;font-size:18px;line-height:1.6;color:#1c1b19">We look after the whole thing, slowly, and we tell you what we found. Nothing here asks anything of you before you have read a sentence, which is the point of the room.</p>
    <a href="/contact" style="display:inline-flex;min-height:44px;align-items:center;padding:12px 24px;background:ACCENT;color:#ffffff;font-family:Helvetica,Arial,sans-serif;font-size:16px">Book a first visit</a>
  </div>
</section>`;

const SERVICES = (mark) => `
<section class="relative px-6 py-20" style="background:#f7f5ee">
  ${mark}
  <div class="mx-auto max-w-5xl">
    <h2 style="font-family:Georgia,serif;font-size:32px;line-height:1.2;color:#1c1b19">What we look after</h2>
    <p style="font-family:Helvetica,Arial,sans-serif;font-size:18px;line-height:1.6;color:#1c1b19">Three things, done properly, and we will say so when a fourth is not worth your money at all. That is the whole of the offer and it does not change.</p>
  </div>
</section>`;

const boardPage = () => `---
import BoardFrame from "../../layouts/BoardFrame.astro";
import { variants } from "../../lib/variants";
const variant = variants.find((v) => v.id === "b1");
---
{variant && (
  <BoardFrame variant={variant}>
    <Fragment slot="hero" set:html={${JSON.stringify(HERO('<span data-section-id="b1-hero"></span>').replace("ACCENT", "#2f5d50"))}} />
    <Fragment slot="section" set:html={${JSON.stringify(SERVICES('<span data-section-id="b1-services"></span>').replace("ACCENT", "#2f5d50"))}} />
  </BoardFrame>
)}
`;

const homePage = (accent) => `---
import BaseLayout from "../layouts/BaseLayout.astro";
import { business } from "../lib/business";
---
<BaseLayout title={business.name}>
  <Fragment set:html={${JSON.stringify(HERO('<span data-palate-section="b1-hero"></span>'))}.replace("ACCENT", ${JSON.stringify(accent)})} />
  <Fragment set:html={${JSON.stringify(SERVICES('<span data-palate-section="b1-services"></span>'))}} />
</BaseLayout>
`;

const run = async (args, env = {}) => {
  try {
    const { stdout, stderr } = await promisify(execFile)(process.execPath, [CLI, ...args], {
      encoding: "utf8", maxBuffer: 32 * 1024 * 1024, env: { ...process.env, ...env },
    });
    return { status: 0, stdout, stderr };
  } catch (e) {
    return { status: e.code ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
};

const build = () => execFileSync(join(SITE, "node_modules/.bin/astro"), ["build"], {
  cwd: SITE, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, PUBLIC_EXPLORE_MODE: "true" },
});

function writeManifest(picks) {
  writeFileSync(join(SITE, "build-manifest.json"), JSON.stringify({
    schema: 3, project: SITE, mcp_calls: [],
    explore: { ran: true, shown_at: new Date(Date.now() - 90_000).toISOString(), picks },
  }, null, 2));
}

before(async () => {
  if (!existsSync(join(ROOT, "scripts/reference-capture/node_modules/playwright"))) {
    skipReason = "playwright is not installed (scripts/reference-capture/setup.sh); fidelity is UNPROVEN.";
    return;
  }
  TMP = mkdtempSync(join(tmpdir(), "gate-fidelity-"));
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
  writeFileSync(join(SITE, "src/lib/variants.ts"), REGISTRY);
  mkdirSync(join(SITE, "src/pages/boards"), { recursive: true });
  writeFileSync(join(SITE, "src/pages/boards/b1.astro"), boardPage());
  writeFileSync(join(SITE, "src/pages/index.astro"), homePage("#2f5d50"));
  writeManifest([]);

  // Render the boards, which is what leaves the shots the gate reads.
  try {
    execFileSync(process.execPath, [RENDER, SITE, "--port", "8792"], { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
  } catch (e) {
    skipReason = `boards-render could not produce the shots: ${(e.stderr || e.message || "").toString().slice(-400)}`;
    return;
  }
  ready = true;
});

after(() => { if (TMP) rmSync(TMP, { recursive: true, force: true }); });

test("no picks is a refusal, never a pass", async (t) => {
  if (!ready) return t.skip(skipReason);
  writeManifest([]);
  const r = await run([SITE, "--port", String(PORT)]);
  assert.equal(r.status, 2, "a build with no picks must exit 2");
  assert.match(r.stderr, /no picks recorded/);
});

test("an honest build passes, and says what it could not measure", async (t) => {
  if (!ready) return t.skip(skipReason);
  writeFileSync(join(SITE, "src/pages/index.astro"), homePage("#2f5d50"));
  build();
  writeManifest([{ surface: "hero", variant_id: "b1", rung: 1, position: 1, picked_at: new Date().toISOString() }]);
  const r = await run([SITE, "--port", String(PORT)]);
  assert.equal(r.status, 0, `an honest build should pass:\n${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /b1-hero/, "the gate does not say which section it matched");
  // The appearance head is opt-in and its absence must be reported, never assumed clean.
  assert.match(r.stdout + r.stderr, /unmeasured/i, "the gate did not say the similarity was unmeasured");
});

test("an accent moved past deltaE 6 fails, naming both hexes", async (t) => {
  if (!ready) return t.skip(skipReason);
  // Still a green, still a plausible build, and far enough that a reader would see it.
  writeFileSync(join(SITE, "src/pages/index.astro"), homePage("#1f7fd0"));
  build();
  writeManifest([{ surface: "hero", variant_id: "b1", rung: 1, position: 1, picked_at: new Date().toISOString() }]);
  const r = await run([SITE, "--port", String(PORT)]);
  assert.equal(r.status, 1, `a changed accent should fail:\n${r.stdout}\n${r.stderr}`);
  assert.match(r.stderr, /#2f5d50/, "the failure does not name the picked accent");
  assert.match(r.stderr, /#1f7fd0/i, "the failure does not name the built accent");
  assert.match(r.stderr, /deltaE/i);
});

test("the picked section going missing fails, naming it", async (t) => {
  if (!ready) return t.skip(skipReason);
  writeFileSync(join(SITE, "src/pages/index.astro"),
    homePage("#2f5d50").replace(/<Fragment set:html=\{JSON[\s\S]*$/, "").replace(/\n$/, "") + "\n");
  // Rebuild with only the hero, which is the drift that matters: the client picked a section
  // and the built page does not have it.
  const only = `---
import BaseLayout from "../layouts/BaseLayout.astro";
import { business } from "../lib/business";
---
<BaseLayout title={business.name}>
  <Fragment set:html={${JSON.stringify(HERO('<span data-palate-section="b1-hero"></span>').replace("ACCENT", "#2f5d50"))}} />
</BaseLayout>
`;
  writeFileSync(join(SITE, "src/pages/index.astro"), only);
  build();
  writeManifest([
    { surface: "hero", variant_id: "b1", rung: 1, position: 1, picked_at: new Date().toISOString() },
    { surface: "section", variant_id: "b1", rung: 1, position: 1, picked_at: new Date().toISOString() },
  ]);
  const r = await run([SITE, "--port", String(PORT)]);
  assert.equal(r.status, 1, `a missing picked section should fail:\n${r.stdout}\n${r.stderr}`);
  assert.match(r.stderr, /b1-services/, "the failure does not name the missing section");

  writeFileSync(join(SITE, "src/pages/index.astro"), homePage("#2f5d50"));
  build();
});

test("no built home is a refusal with the reason, never a pass", async (t) => {
  if (!ready) return t.skip(skipReason);
  writeManifest([{ surface: "hero", variant_id: "b1", rung: 1, position: 1, picked_at: new Date().toISOString() }]);
  const r = await run([join(TMP, "not-a-site"), "--port", String(PORT)]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /NOT a pass/);
});
