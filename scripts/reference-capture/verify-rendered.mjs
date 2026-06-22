#!/usr/bin/env node
/**
 * verify-rendered.mjs - the rendered, multi-viewport, real-motion gate for a BUILT site.
 *
 * The mechanical gate (ux-lint.sh) and the visual loop / reviewer pass read CODE / a
 * still. This one loads the RUNNING site in a real browser at phone / tablet / desktop
 * and asserts what only shows up when it renders. It extends the jiffi rendered gate
 * (no horizontal scroll, no console errors, no blank pages, a visible focus ring, a real
 * 404) with the BOLD-build bug-class checks from references/rendered-bug-classes.md:
 *
 *   (a) NO-JS / LCP-is-never-a-canvas: with JS disabled, the hero shows a FINISHED static
 *       state - no JS-dismissed preloader covering it, no blank <canvas> with no poster.
 *   (b) MOTION-ON reveal reaches the finished state: a REAL wheel scroll (JS on, motion
 *       on - NOT scrollTo, NOT reduced-motion) leaves 0 sections stuck at opacity:0.
 *       Reduced-motion forcing visibility MASKS this bug, so we test the default path.
 *   (c) PINNED scenes RELEASE: a pinned/fixed hero element does not overprint the footer.
 *   (f) HEAVY WebGL degrades on mobile: no above-the-fold <canvas> at 390 (the lazy-split
 *       in motion-and-3d.md Recipe 1b should serve a poster on touch/low-end).
 *
 * It lives beside capture.mjs so it reuses the same installed Playwright + Chromium.
 *
 * Usage:
 *   node verify-rendered.mjs --url <base> [--routes /,/contact,/blog] [--out <dir>]
 *
 * Exit codes:
 *   0  clean (no finding at or above High)
 *   1  findings at or above High
 *   2  bad arguments
 *   3  a browser could not be launched - the gate is BLOCKED, never a pass
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

// ----------------------------------------------------------------- args ----
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) out[a.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
  }
  return out;
}
const args = parseArgs(process.argv.slice(2));
const base = (args.url || '').replace(/\/+$/, '');
if (!base) { console.error('verify-rendered: --url <base> is required'); process.exit(2); }
const routes = (args.routes ? String(args.routes).split(',') : ['/', '/contact', '/blog'])
  .map((r) => r.trim()).filter(Boolean);
const outDir = args.out && args.out !== 'true' ? args.out : '';
if (outDir) mkdirSync(outDir, { recursive: true });

const VIEWPORTS = {
  mobile:  { width: 390,  height: 844  },
  tablet:  { width: 834,  height: 1112 },
  desktop: { width: 1440, height: 900  },
};
// Console / request noise that is not the build's fault (third-party, favicon).
const IGNORE = [/turnstile/i, /challenges\.cloudflare/i, /humblytics/i, /plausible/i, /google-analytics/i, /googletagmanager/i, /favicon/i];
const ignored = (s) => IGNORE.some((re) => re.test(s || ''));

const findings = [];
const add = (sev, route, vp, msg) => findings.push({ sev, route, vp, msg });
const RANK = { High: 3, Medium: 2, Cosmetic: 1 };

// --------------------------------------------------------------- launch ----
// GPU off is the FAST default. --disable-software-rasterizer also kills CPU
// WebGL, so a WebGL hero would render blank; the pre-detect below switches the
// audit to software WebGL only when the home route actually mounts a <canvas>.
const GPU_OFF_ARGS = ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--disable-software-rasterizer'];
// Software WebGL (ANGLE + SwiftShader). --use-angle=swiftshader-webgl AND
// --enable-unsafe-swiftshader are both required on current (post-Chrome-139)
// Chromium, where the automatic SwiftShader WebGL fallback was removed.
const WEBGL_ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'];

// One cheap pre-detect launch: does the home route mount a substantial <canvas>?
// If so the whole audit runs under software WebGL so its screenshots are truthful
// (the per-route assertions are GPU-agnostic). Detecting first keeps the slow
// software path off the many non-WebGL builds and the multi-route audit.
async function detectWebGL() {
  let b;
  try {
    b = await chromium.launch({ headless: true, channel: 'chromium', args: GPU_OFF_ARGS });
    const page = await (await b.newContext({ viewport: VIEWPORTS.desktop })).newPage();
    await page.goto(base + '/', { waitUntil: 'load', timeout: 20000 });
    await page.evaluate(() => new Promise((r) => setTimeout(r, 800)));
    return await page.evaluate(() => {
      for (const c of document.querySelectorAll('canvas')) {
        const r = c.getBoundingClientRect();
        if (r.width > 200 && r.height > 160) return true;
      }
      return false;
    });
  } catch { return false; }
  finally { try { if (b) await b.close(); } catch {} }
}

let browser;
try {
  const webgl = await detectWebGL();
  if (webgl) console.error('verify-rendered: WebGL/canvas hero detected; running the audit under software WebGL (SwiftShader).');
  browser = await chromium.launch({
    headless: true,
    channel: 'chromium',
    args: webgl ? WEBGL_ARGS : GPU_OFF_ARGS,
  });
} catch (e) {
  console.error('verify-rendered: could not launch a browser (' + (e && e.message ? e.message : e) + ').');
  console.error('verify-rendered: run scripts/reference-capture/setup.sh, or run this gate where a browser is available. This is BLOCKED, not a pass.');
  process.exit(3);
}

// --------------------------------------------------------------- audit -----
for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
  const context = await browser.newContext({ viewport: vp });
  for (const route of routes) {
    const page = await context.newPage();
    const errors = [];
    const webglChunkError = { hit: false };
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      // "Failed to load resource" errors carry the URL in location(), not the text,
      // so check both before deciding it is the build's fault.
      const loc = (m.location && m.location().url) || '';
      if (ignored(m.text()) || ignored(loc)) return;
      errors.push('console error: ' + m.text());
    });
    page.on('pageerror', (e) => errors.push('page error: ' + (e && e.message ? e.message : e)));
    page.on('requestfailed', (r) => {
      if (ignored(r.url())) return;
      errors.push('request failed: ' + r.url());
      if (/three|webgl|r3f|fiber|drei/i.test(r.url())) webglChunkError.hit = true;
    });

    let status = 0;
    try {
      const resp = await page.goto(base + route, { waitUntil: 'load', timeout: 20000 });
      status = resp ? resp.status() : 0;
    } catch (e) {
      add('High', route, vpName, 'navigation failed: ' + (e && e.message ? e.message : e));
      await page.close();
      continue;
    }
    if (status >= 500) add('High', route, vpName, 'server returned ' + status);

    // Bug-class (b): a REAL wheel scroll down the page (JS on, motion on), then settle,
    // so reveal animations actually fire on the DEFAULT path - reduced-motion / scrollTo
    // both MASK a reveal stuck at opacity:0 (references/rendered-bug-classes.md).
    await realWheelScroll(page);
    await page.evaluate(() => new Promise((r) => setTimeout(r, 350)));

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 1) add('High', route, vpName, 'horizontal scroll: content is ' + overflow + 'px wider than the viewport');

    const textLen = await page.evaluate(() => (document.body && document.body.innerText ? document.body.innerText.trim().length : 0));
    if (textLen < 1) add('High', route, vpName, 'page renders blank (no text content)');

    // (b) MOTION-ON reveal reaches the finished state: count substantial elements still
    // fully transparent or hidden after the real wheel scroll. >0 = a reveal that never
    // fires for normal visitors (the 55-79%-hidden bug). Tested with JS ON + motion ON.
    const stuckHidden = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('section, main > *, [data-reveal], [data-animate], [class*="reveal"], article'));
      let stuck = 0;
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (r.width < 80 || r.height < 40) continue;            // ignore tiny nodes
        if ((el.innerText || '').trim().length < 8) continue;   // must carry content
        const s = getComputedStyle(el);
        const transparent = parseFloat(s.opacity || '1') < 0.02;
        const hidden = s.visibility === 'hidden';
        if (transparent || hidden) stuck++;
      }
      return stuck;
    });
    if (stuckHidden > 0) {
      add('High', route, vpName, 'motion-on reveal stuck: ' + stuckHidden + ' content section(s) remain at opacity:0 / visibility:hidden after a real wheel scroll (JS on, motion on). Reveal elements must REST at opacity:1 and animate FROM a transient state (references/rendered-bug-classes.md (b)).');
    }

    // (c) PINNED scene RELEASE: after scrolling to the bottom, no fixed/pinned element
    // that originated in the hero still covers the footer / last section.
    const overprint = await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
      const vh = window.innerHeight, vw = window.innerWidth;
      // The footer / last content block, now in view at the bottom of the scroll.
      const last = document.querySelector('footer') || document.body.lastElementChild;
      const lr = last ? last.getBoundingClientRect() : null;
      if (!lr || lr.top >= vh || lr.bottom <= 0) return '';  // last block not in view => fine
      // rect-overlap test: is a fixed hero-scale element painting over the footer's box?
      const overlaps = (a, b) =>
        a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      let culprit = '';
      for (const el of document.querySelectorAll('body *')) {
        const s = getComputedStyle(el);
        if (s.position !== 'fixed') continue;
        if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity || '1') < 0.02) continue;
        const r = el.getBoundingClientRect();
        if (r.height < vh * 0.25 || r.width < vw * 0.4) continue;     // must be hero-scale
        if ((el.innerText || '').trim().length < 8) continue;        // must carry content
        if (el.contains(last) || (last && last.contains(el))) continue; // not the footer itself
        if (overlaps(r, lr)) {
          culprit = (el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : ''));
          break;
        }
      }
      return culprit;
    });
    if (overprint) {
      add('High', route, vpName, 'pinned scene never releases: a fixed hero-scale element (' + overprint + ') overprints the footer / last section at the bottom of the page. A pinned ScrollTrigger must have a finite end + pinSpacing, or use position:sticky in a bounded container (references/rendered-bug-classes.md (c)).');
    }

    // (f) HEAVY WebGL must degrade on mobile: a <canvas> in the above-the-fold hero at
    // 390 means the lazy-split did not serve the poster on touch/low-end.
    if (vpName === 'mobile') {
      await page.evaluate(() => window.scrollTo(0, 0));
      const aboveFoldCanvas = await page.evaluate(() => {
        const vh = window.innerHeight;
        for (const c of document.querySelectorAll('canvas')) {
          const r = c.getBoundingClientRect();
          if (r.top < vh && r.bottom > 0 && r.width > 64 && r.height > 64) return true;
        }
        return false;
      });
      if (aboveFoldCanvas) {
        add('High', route, vpName, 'heavy WebGL on mobile: an above-the-fold <canvas> renders at 390px. Gate the canvas to desktop + fine-pointer + motion and serve the static poster on touch/low-end (motion-and-3d.md Recipe 1b; references/rendered-bug-classes.md (f)).');
      }
      if (webglChunkError.hit) {
        add('High', route, vpName, 'a three.js / WebGL chunk failed to load on mobile - the heavy 3D bundle should not download on the mobile path at all.');
      }
    }

    for (const e of errors) add('High', route, vpName, e);

    // Focus ring: one real keyboard Tab should land on an element with a visible
    // outline (globals.css ships :focus-visible). Desktop only, heuristic -> Medium.
    if (vpName === 'desktop') {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.keyboard.press('Tab');
      const ring = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return { focused: false };
        const s = getComputedStyle(el);
        const visible = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none';
        return { focused: true, visible };
      });
      if (ring.focused && !ring.visible) add('Medium', route, vpName, 'first tab-focused element has no visible focus ring');
    }

    if (outDir) {
      const name = vpName + (route === '/' ? '_home' : route.replace(/[^a-z0-9]+/gi, '_')) + '.png';
      await page.screenshot({ path: outDir + '/' + name, fullPage: true }).catch(() => {});
    }
    await page.close();
  }
  await context.close();
}

// (g) VIEW-TRANSITION navigation re-inits motion: client-side navigate by CLICKING an
// in-app link (Astro ClientRouter does a VT swap, not a fresh load), then assert the
// destination's scroll reveals fire. A not-VT-aware motion module (one that guards behind
// a boot-once flag) animates only the first page, so reveals on the swapped-in page stay
// stuck at opacity:0 - the "only the cinematic page animates" bug. Only fires when there
// is a second internal route to click; a site without client routing reloads and passes.
{
  const context = await browser.newContext({ viewport: VIEWPORTS.desktop });
  const page = await context.newPage();
  try {
    await page.goto(base + '/', { waitUntil: 'load', timeout: 20000 });
    await page.evaluate(() => new Promise((r) => setTimeout(r, 400)));
    const target = await page.evaluate(() => {
      for (const a of document.querySelectorAll('a[href]')) {
        let u; try { u = new URL(a.href, location.href); } catch { continue; }
        if (u.origin === location.origin && u.pathname !== location.pathname && u.pathname !== '/' && !a.hash && !a.target) {
          a.setAttribute('data-vt-probe', '1'); // tag it so we click the right one regardless of href shape (relative / root-absolute / full)
          return u.pathname;
        }
      }
      return null;
    });
    if (target) {
      await page.click('a[data-vt-probe="1"]', { timeout: 5000 }).catch(() => {});
      await page.waitForFunction((p) => location.pathname === p, target, { timeout: 8000 }).catch(() => {});
      const navigated = await page.evaluate((p) => location.pathname === p, target);
      if (navigated) {
        await page.evaluate(() => new Promise((r) => setTimeout(r, 500)));
        await realWheelScroll(page);
        await page.evaluate(() => new Promise((r) => setTimeout(r, 350)));
        const stuck = await page.evaluate(() => {
          let n = 0;
          for (const el of document.querySelectorAll('section, main > *, [data-reveal], [data-animate], [class*="reveal"], article')) {
            const r = el.getBoundingClientRect();
            if (r.width < 80 || r.height < 40) continue;
            if ((el.innerText || '').trim().length < 8) continue;
            const s = getComputedStyle(el);
            if (parseFloat(s.opacity || '1') < 0.02 || s.visibility === 'hidden') n++;
          }
          return n;
        });
        if (stuck > 0) add('High', target + ' (via client-nav)', 'desktop', stuck + ' reveal(s) stuck at opacity:0 / hidden after a View-Transition navigation (clicked an in-app link to ' + target + ', not a fresh load). Motion did not re-init on the swapped-in page: the motion module must re-arm its per-page recipes on astro:page-load, never guard behind a boot-once flag (src/lib/motion.ts setupPage; references/rendered-bug-classes.md).');
      }
    }
  } catch (e) {
    add('Medium', '(client-nav)', 'desktop', 'could not test View-Transition navigation: ' + (e && e.message ? e.message : e));
  }
  await context.close();
}

// (a) NO-JS / LCP-is-never-a-canvas: load the home route with JavaScript DISABLED and
// assert the hero shows a FINISHED static state - text is present, no fixed full-viewport
// overlay covers it (a JS-dismissed preloader), and the largest above-the-fold element is
// not a bare <canvas> with no sibling poster <img>. Desktop viewport.
{
  const context = await browser.newContext({ viewport: VIEWPORTS.desktop, javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto(base + '/', { waitUntil: 'load', timeout: 20000 });
    const nojs = await page.evaluate(() => {
      const vh = window.innerHeight, vw = window.innerWidth;
      const out = { text: 0, overlay: false, canvasHero: false, poster: false };
      out.text = (document.body && document.body.innerText ? document.body.innerText.trim().length : 0);
      // A fixed/absolute element covering most of the viewport with no JS to dismiss it
      // is a preloader stuck over the hero.
      for (const el of document.querySelectorAll('body *')) {
        const s = getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity || '1') < 0.02) continue;
        if (s.position !== 'fixed' && s.position !== 'absolute') continue;
        const r = el.getBoundingClientRect();
        if (r.width > vw * 0.9 && r.height > vh * 0.9 && r.top <= 1 && r.left <= 1) {
          // an opaque-ish full-screen cover near the top of the stack
          const bg = s.backgroundColor || '';
          const opaque = bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
          if (opaque || parseFloat(s.opacity || '1') > 0.5) { out.overlay = true; break; }
        }
      }
      // A substantial above-the-fold <canvas> with no static poster <img> beside it:
      // with JS off the canvas is blank, so the hero LCP is blank unless a poster backs it.
      for (const c of document.querySelectorAll('canvas')) {
        const r = c.getBoundingClientRect();
        if (r.top < vh && r.bottom > 0 && r.width > 200 && r.height > 160) { out.canvasHero = true; break; }
      }
      if (out.canvasHero) {
        for (const img of document.querySelectorAll('img, picture img')) {
          const r = img.getBoundingClientRect();
          if (r.top < vh && r.bottom > 0 && r.width > 120 && r.height > 80) { out.poster = true; break; }
        }
      }
      return out;
    });
    if (nojs.text < 1) add('High', '/', 'no-js', 'with JavaScript disabled the page renders blank - the hero / LCP must be a finished static state (text + a static image/poster), never JS-dependent (references/rendered-bug-classes.md (a)).');
    if (nojs.overlay) add('High', '/', 'no-js', 'a full-viewport overlay (a preloader) covers the hero with JS disabled - preloaders must default HIDDEN and be SHOWN by JS (or guarded by html:not(.js)), never default-visible + JS-dismissed (references/rendered-bug-classes.md (a)).');
    if (nojs.canvasHero && !nojs.poster) add('High', '/', 'no-js', 'the hero LCP is a <canvas> with no static poster <img> - every WebGL hero ships a static poster behind the canvas as the LCP / no-JS / reduced-motion state (references/motion-and-3d.md; rendered-bug-classes.md (a)).');
  } catch (e) {
    add('Medium', '/', 'no-js', 'could not load the page with JS disabled: ' + (e && e.message ? e.message : e));
  }
  await context.close();
}

// 404: an unknown route must serve the branded 404 (a real state), not a 200 and not a
// blank host default.
{
  const context = await browser.newContext({ viewport: VIEWPORTS.desktop });
  const page = await context.newPage();
  let status = 0, textLen = 0;
  try {
    const resp = await page.goto(base + '/__verify_rendered_nonexistent', { waitUntil: 'load', timeout: 20000 });
    status = resp ? resp.status() : 0;
    textLen = await page.evaluate(() => (document.body && document.body.innerText ? document.body.innerText.trim().length : 0));
  } catch { /* navigation issue is reported as the wrong-status finding below */ }
  if (status !== 404) add('High', '(unknown route)', 'desktop', 'unknown routes return ' + status + ', not 404 - add a custom src/pages/404.astro');
  else if (textLen < 20) add('Medium', '/404', 'desktop', '404 page is near-empty; give it on-brand copy and a link home');
  await context.close();
}

await browser.close();

// ------------------------------------------------------------- helpers -----
// A REAL wheel scroll to the bottom of the page (NOT scrollTo): this is what fires
// scroll-reveal / ScrollTrigger on the default motion path. scrollTo and reduced-motion
// both bypass the very code path the reveal bug lives in.
async function realWheelScroll(page) {
  try {
    const total = await page.evaluate(() => document.body.scrollHeight);
    const vh = await page.evaluate(() => window.innerHeight);
    const steps = Math.max(4, Math.ceil(total / Math.max(200, vh * 0.7)));
    for (let i = 0; i < steps; i++) {
      await page.mouse.wheel(0, Math.max(200, vh * 0.7));
      await page.evaluate(() => new Promise((r) => setTimeout(r, 80)));
    }
  } catch { /* a page with no scroll is fine */ }
}

// --------------------------------------------------------------- report ----
findings.sort((a, b) => (RANK[b.sev] || 0) - (RANK[a.sev] || 0));
for (const f of findings) console.log(`${f.route} @${f.vp}  [${f.sev}]  ${f.msg}`);
const highest = findings.reduce((m, f) => Math.max(m, RANK[f.sev] || 0), 0);
console.error(`verify-rendered: ${findings.length} finding(s) across ${routes.length} route(s) x 3 viewports + the no-JS + 404 probes`);
process.exit(highest >= RANK.High ? 1 : 0);
