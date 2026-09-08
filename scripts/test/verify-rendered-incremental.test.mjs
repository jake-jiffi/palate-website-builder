/**
 * Incremental re-verify: the per-route record in the shots manifest, and --changed.
 *
 * A BROWSER SUITE. It is in the SLOW list in run.sh, so --fast skips it; run it by hand.
 *
 * The defect it pins: one verify pass ran over thirty minutes, a check failed at minute
 * twenty-five, and the next pass re-shot the whole site because one file had changed. The
 * gate had no memory, so every re-run after every fix paid for the whole site again.
 *
 * Three directions, because a cache that is wrong is worse than no cache:
 *   1. a second run over UNCHANGED source keeps the first run's record, hashes and all,
 *      so the skip rests on a hash rather than on a wall clock;
 *   2. --changed renders the blast radius and nothing else, measurably faster;
 *   3. a file the index has never heard of falls WIDE and says why, because a narrowed
 *      gate that guessed is the failure this whole feature could introduce.
 *
 * The server is an in-process node:http listener on port 0, so two of these can run at
 * once in sibling worktrees without a port to collide over.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const VR = join(HERE, '..', 'reference-capture', 'verify-rendered.mjs');

// A page with real text (the gate skips axe on a blank page, which would make the
// per-route cost unrepresentative) and no internal links, so the view-transition probe
// returns early and the fixed overhead stays small enough for the ratio to mean something.
const page = (title, body) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${title}</title>
<style>body{margin:0;font:16px/1.6 system-ui;color:#1a1a1a;background:#fff}
main{max-width:60rem;margin:0 auto;padding:2rem}h1{font-size:2.5rem}
a,button{color:#0b4a6f;min-height:44px;display:inline-block}
:focus-visible{outline:3px solid #0b4a6f}</style></head>
<body><main><h1>${title}</h1>${body}</main></body></html>`;

const filler = (n) => Array.from({ length: n }, (_, i) =>
  `<section><h2>Section ${i + 1}</h2><p>A paragraph of ordinary body copy that gives the ` +
  'accessibility pass something real to read on this route.</p></section>').join('');

/**
 * A generated fixture: `count` static routes, each importing one of two shared components,
 * plus the index the gate reads to decide what to render.
 *
 * `sharedFor(i)` decides which component route i imports, so a test can size the blast
 * radius it wants without a second fixture.
 */
function makeFixture(count, sharedFor) {
  const root = mkdtempSync(join(tmpdir(), 'palate-incremental-'));
  mkdirSync(join(root, 'src', 'pages'), { recursive: true });
  mkdirSync(join(root, 'src', 'components'), { recursive: true });
  mkdirSync(join(root, '.palate'), { recursive: true });
  for (const c of ['Alpha', 'Beta']) {
    writeFileSync(join(root, 'src', 'components', `${c}.astro`), `<div class="${c.toLowerCase()}">${c}</div>\n`);
  }
  const routes = [];
  const html = new Map();
  html.set('/', page('Home', filler(2)));
  for (let i = 1; i <= count; i++) {
    const id = String(i).padStart(2, '0');
    const shared = sharedFor(i);
    const src = `src/pages/p${id}.astro`;
    writeFileSync(join(root, src), `---\nimport ${shared} from '../components/${shared}.astro';\n---\n<${shared} />\n<h1>Page ${id}</h1>\n`);
    routes.push({
      path: `/p${id}`,
      source: src,
      kind: 'static',
      dependsOn: [`src/components/${shared}.astro`],
      links: [],
    });
    html.set(`/p${id}`, page(`Page ${id}`, filler(3)));
  }
  writeFileSync(join(root, '.palate', 'index.json'), JSON.stringify({
    root, routes, entries: [], counts: { routes: routes.length, entries: 0, drafts: 0 },
    links: { parsed: 0, files: 0, orphans: [], dead: [], stale: 0 },
  }, null, 2));
  return { root, html, index: join(root, '.palate', 'index.json') };
}

function serve(html) {
  const server = createServer((req, res) => {
    const path = (req.url || '/').split('?')[0].replace(/\/$/, '') || '/';
    const body = html.get(path);
    if (!body) { res.writeHead(404, { 'content-type': 'text/html' }); res.end(page('Not found', '<p>No such page.</p>')); return; }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(body);
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

/**
 * Run the gate and hand back BOTH streams: the findings go to stdout, every diagnostic to
 * stderr, and a run that exits 1 on a High finding must still say what it found.
 *
 * ASYNCHRONOUS, AND THAT IS NOT A STYLE CHOICE. The fixture server runs in this process, so
 * a synchronous spawn holds the event loop and the server answers nothing: the first draft
 * used spawnSync, every navigation timed out at twenty seconds, and a clean fixture came
 * back with a High finding on all three routes. A harness that starves its own server
 * measures the harness.
 */
function runGate(argv) {
  const started = Date.now();
  return new Promise((done) => {
    const p = spawn('node', [VR, ...argv], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { out += d; });
    p.on('close', (status) => done({ ms: Date.now() - started, out, status }));
  });
}

test('a second run over unchanged source keeps the first run\'s per-route record', async (t) => {
  const fx = makeFixture(3, () => 'Alpha');
  const server = await serve(fx.html);
  const url = `http://127.0.0.1:${server.address().port}`;
  const out = join(fx.root, '.palate-shots');
  t.after(() => { server.close(); rmSync(fx.root, { recursive: true, force: true }); });

  const first = await runGate(['--url', url, '--index', fx.index, '--out', out, '--no-vitals']);
  const m1 = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'));
  assert.ok(m1.routes, `the first run wrote no routes map (exit ${first.status})\n${first.out.slice(-1200)}`);
  assert.deepEqual(Object.keys(m1.routes).sort(), ['/p01', '/p02', '/p03']);
  for (const rec of Object.values(m1.routes)) {
    assert.match(rec.sourcesHash, /^[0-9a-f]{64}$/);
    assert.match(rec.renderedHash, /^[0-9a-f]{64}$/);
    assert.ok(Date.parse(rec.passed_at) > 0);
  }

  const second = await runGate(['--url', url, '--index', fx.index, '--out', out, '--no-vitals']);
  const m2 = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'));
  assert.deepEqual(m2.routes, m1.routes, 'the second run rewrote records it should have carried forward');
  // PER ROUTE, not the tally. The first version matched /unchanged, skipped/, which the
  // summary line also carries, so deleting the per-route line left the test green.
  for (const r of ['/p01', '/p02', '/p03']) {
    assert.match(second.out, new RegExp(`${r} unchanged, skipped`), `the second run did not name ${r} as skipped`);
  }

  // A route with a changed source is NOT skipped: the record must rest on the hash.
  writeFileSync(join(fx.root, 'src', 'pages', 'p02.astro'), '<h1>Page 02, edited</h1>\n');
  await runGate(['--url', url, '--index', fx.index, '--out', out, '--no-vitals']);
  const m3 = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'));
  assert.notEqual(m3.routes['/p02'].sourcesHash, m1.routes['/p02'].sourcesHash);
  assert.notEqual(m3.routes['/p02'].passed_at, m1.routes['/p02'].passed_at);
  assert.equal(m3.routes['/p01'].passed_at, m1.routes['/p01'].passed_at, 'an untouched route was re-rendered');
});
