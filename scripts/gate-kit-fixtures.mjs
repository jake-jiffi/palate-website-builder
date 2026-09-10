#!/usr/bin/env node
/**
 * gate-kit-fixtures.mjs - every word a state fixture supplies has to reach the page.
 *
 * A fixture is a plain object handed to a component, so TypeScript cannot check its keys: the map
 * is typed Record<string, unknown> because forty five components have forty five prop shapes. A
 * fixture with the wrong key name therefore renders NOTHING, silently, and the state page shows a
 * piece that looks broken. That is not hypothetical: BenefitShowcase takes points as
 * { label, detail } and the first long fixture wrote { title, body }, so three points rendered
 * empty and it read as a component fault.
 *
 * The check is the only one that can catch it, and it is nearly free: read the BUILT html for
 * each content state and assert every long string the fixture supplies is present. No browser, no
 * heuristics, and it fails with the exact sentence that went missing.
 *
 * Runs against a built site. Silent on a build with no kit.
 *
 * Exit: 0 clean, 1 findings, 2 could not run (never a pass).
 */
import { readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const dir = process.argv[2] || ".";
const base = existsSync(join(dir, "templates/astro-project/src"))
  ? join(dir, "templates/astro-project/src")
  : join(dir, "src");
const statesFile = join(base, "lib/kit-states.ts");
const kitFile = join(base, "lib/kit.ts");

if (!existsSync(statesFile) || !existsSync(kitFile)) {
  console.log("gate-kit-fixtures: skipped (this build ships no kit).");
  process.exit(0);
}

// The built output, wherever this project puts it.
const dist = ["dist/client", "dist", ".vercel/output/static"]
  .map((d) => join(dir, d))
  .find((d) => existsSync(join(d, "kit-frame")));
if (!dist) {
  console.log("gate-kit-fixtures: skipped (no built kit-frame pages; build the site first).");
  process.exit(0);
}

const src = readFileSync(statesFile, "utf8");

/** The fixture maps, read as source: this runs with no build step and no TypeScript loader. */
function mapOf(name) {
  const m = new RegExp(`export const ${name}[^{]*\\{([\\s\\S]*?)\\n\\};`).exec(src);
  if (!m) {
    console.error(`gate-kit-fixtures: could not run: ${relative(dir, statesFile)} has no parsable ${name}. A gate never exits 0 having inspected nothing.`);
    process.exit(2);
  }
  const out = {};
  const re = /^ {2}([A-Za-z]+): \{([\s\S]*?)\n {2}\},$/gm;
  let e;
  while ((e = re.exec(m[1]))) out[e[1]] = e[2];
  return out;
}

const LONG = mapOf("LONG_PROPS");
if (!Object.keys(LONG).length) {
  console.error("gate-kit-fixtures: could not run: LONG_PROPS parsed to zero fixtures.");
  process.exit(2);
}

/** Which piece a variation belongs to, so its page can be found. */
const pieceOf = {};
for (const block of readFileSync(kitFile, "utf8").split(/^ {4}id: "/m).slice(1)) {
  const piece = block.slice(0, block.indexOf('"'));
  for (const v of block.matchAll(/\{ id: "([A-Za-z]+)"/g)) pieceOf[v[1]] = piece;
}

const findings = [];
let checked = 0;

for (const [variation, body] of Object.entries(LONG)) {
  const piece = pieceOf[variation];
  if (!piece) {
    findings.push(`LONG_PROPS carries a fixture for ${variation}, which no piece in the manifest declares`);
    continue;
  }
  const file = join(dist, "kit-frame", piece, variation, "long", "index.html");
  if (!existsSync(file)) {
    findings.push(`${variation} has a long fixture and ${relative(dir, file)} was not built, so nothing renders it`);
    continue;
  }
  const raw = readFileSync(file, "utf8");
  // Attribute values count as content: alt text is written in the fixture and stripping tags
  // would lose it, so the raw markup is searched as well as the visible text.
  const decoded = raw.replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
  const visible = decoded
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
  const haystack = `${visible} ${decoded}`;

  /**
   * Single-line string literals of forty characters or more. Single-line matters: a naive match
   * runs from one string's closing quote to the next one's opening quote and "finds" source code.
   * Anything holding a bracket is source rather than prose and is dropped for the same reason.
   */
  const strings = [...body.matchAll(/"([^"\\\n]{40,})"/g)]
    .map((s) => s[1])
    .filter((s) => !/[{}[\]]|: \[|=> /.test(s));

  for (const s of strings) {
    checked += 1;
    if (!haystack.includes(s.slice(0, 60))) {
      findings.push(`${variation}'s long fixture supplies "${s.slice(0, 60)}..." and it never reaches the page, so the fixture is using a key the component does not take`);
    }
  }
}

if (findings.length) {
  console.error(`gate-kit-fixtures: ${findings.length} finding(s) over ${checked} fixture string(s).`);
  for (const f of findings.slice(0, 20)) console.error(`  - ${f}`);
  if (findings.length > 20) console.error(`  ... and ${findings.length - 20} more`);
  process.exit(1);
}

console.log(`gate-kit-fixtures: clean (${checked} fixture strings across ${Object.keys(LONG).length} long fixtures all reach the page).`);
process.exit(0);
