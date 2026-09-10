#!/usr/bin/env node
/**
 * gate-kit-complete.mjs - the manifest and the components cannot drift.
 *
 * The manifest (src/lib/kit.ts) is what Compose reads when choosing a section, so a variation
 * declared there with no component is a section Compose can pick and cannot render. A component
 * with no entry is invisible: it exists, nobody can find it, and it rots.
 *
 * It also enforces the parts of Jake's "finished" definition that are checkable statically:
 * every variation declares its states, documents when to use it and what content it needs, and
 * every piece that takes a list handles the empty case.
 *
 * Exit: 0 clean, 1 findings, 2 could not run (never a pass).
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const dir = process.argv[2] || ".";
const base = existsSync(join(dir, "templates/astro-project/src"))
  ? join(dir, "templates/astro-project/src")
  : join(dir, "src");
const manifestPath = join(base, "lib/kit.ts");
const kitRoot = join(base, "components/kit");

if (!existsSync(manifestPath)) {
  console.log(`gate-kit-complete: skipped (no ${relative(dir, manifestPath)}); this build ships no kit.`);
  process.exit(0);
}
if (!existsSync(kitRoot)) {
  console.error(`gate-kit-complete: could not run: the manifest exists but ${relative(dir, kitRoot)} does not.`);
  process.exit(2);
}

const src = readFileSync(manifestPath, "utf8");

/**
 * Parsed from the source rather than imported, because this gate must run against a plugin
 * checkout with no build step and no TypeScript loader. The shapes it reads are the ones the
 * manifest is required to have, so a manifest that stops matching them fails loudly here.
 */
function parsePieces(text) {
  const pieces = [];
  const pieceRe = /\{\s*\n?\s*id:\s*"([a-z]+)",\s*name:\s*"([^"]+)",([\s\S]*?)\n  \},\n/g;
  let m;
  while ((m = pieceRe.exec(text))) {
    const [, id, name, body] = m;
    if (!/variations:\s*\[/.test(body)) continue;
    const piece = { id, name, when: /when:\s*"([^"]*)"/.exec(body)?.[1] || "",
      where: /where:\s*"([^"]*)"/.exec(body)?.[1] || "", variations: [] };
    const varRe = /\{\s*id:\s*"([A-Za-z]+)",\s*name:\s*"([^"]+)",\s*\n?\s*when:\s*"([^"]*)",\s*\n?\s*needs:\s*\[([^\]]*)\],\s*\n?\s*states:\s*\[([^\]]*)\]/g;
    let v;
    while ((v = varRe.exec(body))) {
      piece.variations.push({
        id: v[1], name: v[2], when: v[3],
        needs: (v[4].match(/"[^"]+"/g) || []).length,
        states: (v[5].match(/"[^"]+"/g) || []).map((s) => s.replace(/"/g, "")),
      });
    }
    pieces.push(piece);
  }
  return pieces;
}

const pieces = parsePieces(src);
if (!pieces.length) {
  console.error("gate-kit-complete: could not run: the manifest parsed to zero pieces, so nothing was checked. A gate never exits 0 having inspected nothing.");
  process.exit(2);
}

const findings = [];
let declared = 0;

for (const p of pieces) {
  if (!p.when) findings.push(`piece "${p.id}" does not say WHEN to use it`);
  if (!p.where) findings.push(`piece "${p.id}" does not say WHERE it belongs on a page`);
  if (!p.variations.length) findings.push(`piece "${p.id}" declares no variations`);
  for (const v of p.variations) {
    declared++;
    const file = join(kitRoot, p.id, `${v.id}.astro`);
    if (!existsSync(file)) {
      findings.push(`"${p.name} / ${v.name}" is declared but ${relative(dir, file)} does not exist, so Compose can pick a section that cannot render`);
      continue;
    }
    /**
     * A STATE MAY BE DELEGATED, and refusing to follow that would force duplication.
     *
     * NavSimple genuinely has an open state: it renders NavMobileSheet, which owns the
     * aria-expanded, the Escape handling and the focus return. Demanding NavSimple carry its own
     * copy would mean two implementations of one behaviour, which is how they drift. So the
     * check reads the component PLUS any kit component it imports, one level deep, which is as
     * far as composition goes in this kit.
     */
    let body = readFileSync(file, "utf8");
    for (const imp of body.matchAll(/from\s+"\.{1,2}\/([A-Za-z/]+)\.astro"/g)) {
      const rel = imp[1];
      const candidates = [
        join(kitRoot, p.id, `${rel}.astro`),
        join(kitRoot, `${rel}.astro`),
      ];
      for (const c of candidates) if (existsSync(c)) body += "\n" + readFileSync(c, "utf8");
    }
    if (!v.when) findings.push(`${v.id} does not say when to reach for it rather than its siblings`);
    if (!v.needs) findings.push(`${v.id} does not state the content it needs`);
    if (!/interface\s+Props/.test(body)) findings.push(`${v.id} has no Props interface, so its content contract is unstated`);
    if (v.states.includes("empty") && !/kit-empty/.test(body)) {
      findings.push(`${v.id} declares an empty state and never renders .kit-empty, so an empty list breaks the layout`);
    }
    if (v.states.includes("loading") && !/data-loading|kit-spinner|aria-busy/.test(body)) {
      findings.push(`${v.id} declares a loading state and shows no loading affordance`);
    }
    if ((v.states.includes("success") || v.states.includes("error")) && !/aria-live/.test(body)) {
      findings.push(`${v.id} declares success or error and has no aria-live region, so the outcome is silent to a screen reader`);
    }
    if (v.states.includes("open") && !/aria-expanded|<details|<dialog/.test(body)) {
      findings.push(`${v.id} declares an open state with no aria-expanded, <details> or <dialog>`);
    }
    /**
     * NO COMPONENT MAY DEFAULT AN IDENTITY FIELD.
     *
     * A piece that defaults `company`, `role`, `customer` or `name` turns an omission into a
     * fabrication: a build passing a real quote, a real name and a real location, and simply
     * not passing `company`, silently attributes those words to a firm nobody named. Three
     * components shipped exactly that, one of them directly contradicting its own header
     * comment, which said a company is never added to a quote that did not come with one.
     *
     * Sample COPY is fine. A quote with nothing attached attributes nothing to anybody. It is
     * the ATTRIBUTION that must never be invented, and an omitted prop must stay omitted.
     */
    const destructure = /const\s*\{([\s\S]*?)\}\s*=\s*Astro\.props/.exec(body);
    if (destructure) {
      /**
       * IDENTITY IS ANY PROP THAT NAMES SOMEBODY, not a list of five words I thought of.
       *
       * The first version matched `name` exactly and therefore missed `siteName` and
       * `businessName`, which are the two that actually ship: forget the site name and a real
       * client's header and footer carry an invented joinery firm on every page. So the rule is
       * shape-based (anything ending in Name, plus the identity nouns) and the exceptions are
       * named rather than the matches.
       */
      const IDENTITY = /(^|\n)\s*([A-Za-z]*(?:[Nn]ame|company|Company|customer|Customer|author|Author|attribution|Attribution|brand|Brand))\s*=\s*["'`][^"'`]+["'`]/g;
      /** Generic placeholders that name nobody are fine: "Us" is not a person or a firm. */
      const GENERIC = /^(us|you|them|your (?:solution|approach|team)|current|alternative|option [ab])$/i;
      /**
       * `accessibleName` and its siblings name the SECTION for a screen reader, not a person or
       * a firm. Defaulting "What our customers say" is correct and desirable: a section with no
       * accessible name is an accessibility defect, so the fallback must exist.
       */
      const NOT_IDENTITY = /^(accessible|aria|sr|screenReader|label|heading|field|input|button|class|tag|file|event|domain|host)/;
      for (const d of destructure[1].matchAll(IDENTITY)) {
        const value = /=\s*["'`]([^"'`]+)["'`]/.exec(d[0])?.[1] || "";
        if (NOT_IDENTITY.test(d[2])) continue;
        if (GENERIC.test(value.trim())) continue;
        findings.push(`${v.id} defaults the identity field "${d[2]}" to "${value}", so a build that omits it puts an invented person or firm on a real client's site`);
      }

      /**
       * AN ASSET PATH THAT DEFAULTS IS A 404 ON EVERY SITE BUT THIS ONE.
       *
       * A component defaulting `src`, `poster` or `image` to a path renders a broken-image
       * marker on any project that does not happen to carry that exact file, which is all of
       * them. The unset state belongs to the component: fall back to the .kit-media ratio box.
       */
      const ASSET = /(^|\n)\s*([A-Za-z]*(?:src|Src|poster|Poster|image|Image|logo|Logo|avatar|Avatar))\s*=\s*["'`](\/[^"'`]+|https?:[^"'`]+)["'`]/g;
      for (const a of destructure[1].matchAll(ASSET)) {
        const value = /=\s*["'`]([^"'`]+)["'`]/.exec(a[0])?.[1] || "";
        findings.push(`${v.id} defaults the asset "${a[2]}" to ${value}, which 404s on every site that does not carry that exact file`);
      }
    }

    if (!/^\s*\/\*[\s\S]{60,}?\*\//m.test(body) && !/^---[\s\S]{0,400}?\/\*\*/m.test(body)) {
      findings.push(`${v.id} has no header comment explaining what it is and when to use it`);
    }
  }
}

// The reverse direction: a component nobody declared.
for (const pieceDir of readdirSync(kitRoot)) {
  const pd = join(kitRoot, pieceDir);
  if (!statSync(pd).isDirectory()) continue;
  const piece = pieces.find((p) => p.id === pieceDir);
  for (const f of readdirSync(pd)) {
    if (!f.endsWith(".astro")) continue;
    const id = f.replace(/\.astro$/, "");
    if (!piece || !piece.variations.some((v) => v.id === id)) {
      findings.push(`${relative(dir, join(pd, f))} exists but no manifest entry declares it, so Compose can never choose it`);
    }
  }
}

if (findings.length) {
  console.error(`gate-kit-complete: ${findings.length} finding(s) over ${pieces.length} piece(s) and ${declared} declared variation(s).`);
  for (const f of findings.slice(0, 40)) console.error(`  - ${f}`);
  if (findings.length > 40) console.error(`  ... and ${findings.length - 40} more`);
  process.exit(1);
}

console.log(`gate-kit-complete: clean (${pieces.length} pieces, ${declared} variations, every one declared, built, documented and stateful).`);
process.exit(0);
