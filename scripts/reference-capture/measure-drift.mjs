#!/usr/bin/env node
/**
 * measure-drift.mjs - cross-section visual-consistency metric for a BUILT site.
 *
 * SPIKE (sec-gj4.11 / source-triage item 5). The skill has NO computed
 * consistency measure today: gate-uniqueness.mjs measures the INVERSE
 * (near-duplication ACROSS Explore variants), and the visual-rubric Philosophy
 * axis is an interpretive VLM read, not a number. This loads a built page and
 * reports how many DISTINCT values each section uses for the locked constraint
 * set (anti-patterns.md "inconsistent visual language across sections": type
 * scale, spacing unit, corner radius, border weight, accent colours). One
 * coherent system held across sections => few distinct values + low variance;
 * "generated section by section and never reconciled" => many.
 *
 * REPORT-ONLY by design. Low drift is necessary-but-NOT-sufficient for good
 * design (a page can be consistently boring), so this is a FLOOR to read
 * ALONGSIDE the Variety / Philosophy axes, never a quality maximand. The A/B
 * protocol and kill criteria live in references/design-spec-spike.md.
 *
 * Reuses the SAME installed Playwright as screenshot-build.mjs (co-located).
 *
 * Usage:
 *   node measure-drift.mjs --url <http://localhost:PORT> [--out <file.json>]
 * Exit codes: 0 always (report-only; never a gate). 2 = bad args.
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

// GPU off: this measures layout/type/colour, no WebGL needed (fast path).
const LAUNCH_ARGS = ['--disable-gpu', '--disable-dev-shm-usage', '--disable-software-rasterizer'];
if (process.env.PALATE_CAPTURE_NO_SANDBOX === '1') LAUNCH_ARGS.unshift('--no-sandbox');

function parseArgs(argv) {
  const a = { url: '', out: '' };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--url') a.url = argv[++i];
    else if (argv[i] === '--out') a.out = argv[++i];
  }
  if (!a.url) { console.error('usage: node measure-drift.mjs --url <http://localhost:PORT> [--out <file.json>]'); process.exit(2); }
  if (!/^https?:\/\//.test(a.url)) a.url = 'http://' + a.url;
  return a;
}

const uniq = (arr) => Array.from(new Set(arr));
const round = (n, step) => Math.round(n / step) * step;

async function main() {
  const args = parseArgs(process.argv);
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: 'chromium', args: LAUNCH_ARGS });
  } catch (e) {
    console.error('measure-drift: could not launch a browser:', e.message || String(e));
    process.exit(2);
  }

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  try {
    await page.goto(args.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (e) {
    console.error('measure-drift: navigation warning:', (e.message || String(e)).split('\n')[0]);
  }
  await page.waitForTimeout(1000);
  // Step down so lazy/below-fold sections lay out, then return to top.
  try {
    await page.evaluate(async () => {
      await new Promise((res) => {
        let y = 0; const step = Math.round(window.innerHeight * 0.9);
        const t = setInterval(() => { window.scrollBy(0, step); y += step; if (y >= document.body.scrollHeight) { clearInterval(t); res(); } }, 90);
        setTimeout(() => { clearInterval(t); res(); }, 6000);
      });
      window.scrollTo(0, 0);
    });
  } catch { /* a short page is fine */ }
  await page.waitForTimeout(300);

  const raw = await page.evaluate(() => {
    const isNeutral = (r, g, b) => (Math.max(r, g, b) - Math.min(r, g, b)) < 16; // greyscale = neutral
    const parseRGB = (s) => { const m = (s || '').match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map((x) => parseFloat(x)); if (p.length >= 4 && p[3] === 0) return null; return p; };
    const sections = Array.from(document.querySelectorAll('main > section, [data-section-id], main > div > section, body > section'));
    const perSection = [];
    for (const sec of sections) {
      const cs = getComputedStyle(sec);
      const padY = parseFloat(cs.paddingTop || '0') + parseFloat(cs.paddingBottom || '0');
      const fonts = [], radii = [], borders = [], accents = [];
      const nodes = sec.querySelectorAll('h1,h2,h3,h4,h5,h6,p,a,span,li,button,div,img,section,article');
      for (const el of nodes) {
        const s = getComputedStyle(el);
        const fs = parseFloat(s.fontSize || '0'); if (fs >= 8) fonts.push(Math.round(fs));
        const br = parseFloat(s.borderTopLeftRadius || '0'); if (br > 0) radii.push(Math.round(br));
        const bw = parseFloat(s.borderTopWidth || '0'); if (bw > 0) borders.push(Math.round(bw));
        for (const c of [s.backgroundColor, s.color]) {
          const p = parseRGB(c); if (p && !isNeutral(p[0], p[1], p[2])) accents.push([p[0], p[1], p[2]].map((v) => Math.round(v / 16) * 16).join(','));
        }
      }
      perSection.push({ padY: Math.round(padY), fonts, radii, borders, accents });
    }
    return perSection;
  }).catch(() => []);

  await ctx.close();
  await browser.close();

  // Aggregate the distinct-value counts across all sections (the drift signal).
  const allFonts = raw.flatMap((s) => s.fonts);
  const allRadii = raw.flatMap((s) => s.radii);
  const allBorders = raw.flatMap((s) => s.borders);
  const allAccents = raw.flatMap((s) => s.accents);
  const pads = raw.map((s) => s.padY).filter((p) => p > 0);
  const mean = pads.length ? pads.reduce((a, b) => a + b, 0) / pads.length : 0;
  const spacingCV = mean ? Math.sqrt(pads.reduce((a, b) => a + (b - mean) ** 2, 0) / pads.length) / mean : 0;

  const dims = {
    sections: raw.length,
    typeScaleSteps: uniq(allFonts).length,             // distinct font sizes page-wide
    spacingDistinct: uniq(pads).length,                 // distinct section paddings
    spacingCV: Number(spacingCV.toFixed(2)),            // section-rhythm variance
    radiiDistinct: uniq(allRadii).length,               // distinct corner radii
    borderWidthsDistinct: uniq(allBorders).length,      // distinct border weights
    accentColorsDistinct: uniq(allAccents).length,      // distinct non-neutral colours
  };
  // Transparent composite: excess distinct values + scaled rhythm variance. Lower
  // = one system held across sections. NOT a threshold; compare A vs B builds.
  dims.driftScore = Number((
    dims.typeScaleSteps + dims.radiiDistinct + dims.borderWidthsDistinct +
    dims.accentColorsDistinct + dims.spacingCV * 5
  ).toFixed(2));

  const report = { tool: 'measure-drift.mjs', url: args.url, note: 'report-only FLOOR; read with Variety/Philosophy, never maximise', ...dims };
  console.log(JSON.stringify(report, null, 2));
  if (args.out) writeFileSync(args.out, JSON.stringify(report, null, 2) + '\n');
  process.exit(0);
}

main();
