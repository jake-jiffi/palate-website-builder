/**
 * The contact endpoint's SMOKE CONTRACT, exercised as code, on BOTH copies of the endpoint.
 *
 * A post-deploy check that submits the contact form has to reach the endpoint without
 * posting a real enquiry to the client's inbox, so the handler grows one header:
 * `x-palate-smoke: 1` makes it validate the body and answer `{ ok: true, smoke: true }`
 * having sent nothing.
 *
 * THERE ARE TWO ENDPOINTS AND ONLY ONE OF THEM IS OBVIOUS. `scripts/add-sanity.sh` copies
 * `templates/cms-sanity/src/pages/api/contact.ts` over the base file, so on any build with a
 * CMS the smoke request would reach the OTHER handler. Without the same contract there it
 * would take the real path and write a formSubmission document into the client's CMS on every
 * deploy, which is worse than the email it was written to avoid. So the suite is parametrised
 * and both files answer the same questions.
 *
 * THE WHOLE RISK IS THE PRODUCTION SIDE, and it runs in both directions.
 *
 *   AN OPEN HEADER LOSES ENQUIRIES.   A proxy, a scanner or a browser extension that
 *                                     injects the header on a real visitor's submission
 *                                     must not make the enquiry evaporate. So in
 *                                     production the header does nothing unless
 *                                     `x-palate-smoke-secret` matches `PALATE_SMOKE_SECRET`.
 *   AN UNSET SECRET MUST FAIL CLOSED. The obvious implementation compares the header
 *                                     against an undefined secret, two blanks match, and
 *                                     the header is wide open on every deployment that
 *                                     never set the variable. Four of the tests below are
 *                                     that one mistake in its four disguises: unset,
 *                                     blank, wrong, and a prefix of the real value.
 *   IGNORED MEANS THE REAL PATH.      Not a 403. A rejected smoke request is a real
 *                                     visitor's enquiry, and it has to go through.
 *
 * The endpoints are TypeScript reading `import.meta.env`. Node 24 strips the types itself, so
 * each file is loaded almost verbatim: the substitutions are listed per file and every one is
 * asserted to have matched, so a rewritten copy can never be what these tests measure.
 *
 * `fetch` is replaced for the duration, and the CMS client is stubbed into the same call log,
 * which is what makes "sent nothing" an assertion rather than a hope.
 *
 * Run: node --test scripts/test/contact-smoke.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const TPL = join(ROOT, "templates", "astro-project");

const dir = mkdtempSync(join(tmpdir(), "contact-smoke-"));
process.on("exit", () => { try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ } });

// The stub the CMS copy's `createClient` is rewritten to. It writes into the same log as the
// fetch stub, so "the smoke path wrote nothing" covers the document as well as the mail.
const CMS_STUB = `const createClient = (_c) => ({ create: async (doc) => { globalThis.__CALLS.push("sanity:" + doc._type); return doc; } });\n`;

/**
 * Load one endpoint as a module, with the substitutions this repo's test habit requires:
 * each one asserted to have matched, so the day the handler stops doing the thing being
 * shimmed, the suite says so instead of measuring a copy.
 */
async function load(name, relSrc, extra = []) {
  const src = join(ROOT, relSrc);
  const raw = readFileSync(src, "utf8");
  let body = raw;
  const subs = [
    // The extensionless import Astro resolves and node does not. The real business record is
    // copied in beside it, so `business.email` is the value the deployed handler reads.
    ["the business import moved", /(from\s+")(\.\.\/\.\.\/lib\/business)(")/, "$1$2.ts$3"],
    // PUBLIC_SITE_ENV is baked in by the Vite `define` in astro.config.mjs, so the handler has
    // to name it as that exact expression or the substitution misses it and it reads undefined
    // in production. Shimming the same expression is therefore also the guard that it does.
    ["the endpoint no longer reads import.meta.env.PUBLIC_SITE_ENV as a literal expression",
      /import\.meta\.env\.PUBLIC_SITE_ENV/g, "globalThis.__SITE_ENV"],
    ...extra,
  ];
  for (const [why, find, repl] of subs) {
    const next = body.replace(find, repl);
    assert.notEqual(next, body, `${name}: ${why}`);
    body = next;
  }
  const base = join(dir, name);
  mkdirSync(join(base, "src", "pages", "api"), { recursive: true });
  mkdirSync(join(base, "src", "lib"), { recursive: true });
  writeFileSync(join(base, "package.json"), JSON.stringify({ name: `contact-smoke-${name}`, type: "module" }));
  copyFileSync(join(TPL, "src", "lib", "business.ts"), join(base, "src", "lib", "business.ts"));
  const mod = join(base, "src", "pages", "api", "contact.ts");
  writeFileSync(mod, body);
  return (await import(pathToFileURL(mod).href)).POST;
}

const ENDPOINTS = [
  {
    name: "base",
    POST: await load("base", "templates/astro-project/src/pages/api/contact.ts"),
    // Turnstile, then Resend.
    realPath: [/challenges\.cloudflare\.com/, /api\.resend\.com/],
  },
  {
    name: "cms-sanity",
    POST: await load("cms-sanity", "templates/cms-sanity/src/pages/api/contact.ts", [
      ["the CMS copy no longer imports createClient from @sanity/client",
        /import \{ createClient \} from "@sanity\/client";\n/, CMS_STUB],
    ]),
    // Turnstile, then the durable document, then Resend.
    realPath: [/challenges\.cloudflare\.com/, /^sanity:formSubmission$/, /api\.resend\.com/],
  },
];

test("the smoke contract is byte-identical in both copies of the endpoint", () => {
  // add-sanity.sh copies one file over the other, so the two can only be trusted to answer the
  // same way while this block is the same bytes. The suite above proves the behaviour on both;
  // this proves neither can quietly grow a second opinion between suite runs.
  const grab = (rel) => {
    const t = readFileSync(join(ROOT, rel), "utf8");
    const m = t.match(/\/\/ ---- SMOKE CONTRACT BEGIN ----\n[\s\S]*?\/\/ ---- SMOKE CONTRACT END ----\n/);
    assert.ok(m, `${rel} has no marked smoke-contract block`);
    return m[0];
  };
  const a = grab("templates/astro-project/src/pages/api/contact.ts");
  const b = grab("templates/cms-sanity/src/pages/api/contact.ts");
  assert.ok(a.includes("PALATE_SMOKE_SECRET"), "the block no longer contains the production guard");
  assert.equal(a, b, "the two contact endpoints' smoke contracts have drifted");
});

const VALID = { name: "Verify Bot", email: "smoke@example.com", message: "Automated smoke check, please ignore." };
const SMOKE = { "x-palate-smoke": "1" };

/**
 * One call against a handler with every outbound effect stubbed and logged.
 *
 * `env` arrives through `locals.runtime.env`, which is the Cloudflare shape and the one both
 * handlers prefer; on Vercel the same object is `import.meta.env`. Either way it is where the
 * runtime secrets live.
 */
async function post(POST, { body = VALID, headers = {}, siteEnv = "", env = {}, turnstile = true } = {}) {
  globalThis.__SITE_ENV = siteEnv || undefined;
  globalThis.__CALLS = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    globalThis.__CALLS.push(String(url));
    if (String(url).includes("challenges.cloudflare.com")) {
      return new Response(JSON.stringify({ success: turnstile }), { status: 200 });
    }
    return new Response("{}", { status: 200 });
  };
  try {
    const request = new Request("https://example.test/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
    const res = await POST({
      request,
      locals: { runtime: { env: {
        RESEND_API_KEY: "re_test", TURNSTILE_SECRET: "ts_test",
        SANITY_PROJECT_ID: "p", SANITY_DATASET: "production", SANITY_API_WRITE_TOKEN: "sk_test",
        ...env,
      } } },
    });
    let parsed = null;
    try { parsed = JSON.parse(await res.text()); } catch { /* a non-JSON body is itself a finding */ }
    return { status: res.status, body: parsed, calls: globalThis.__CALLS };
  } finally {
    globalThis.fetch = realFetch;
  }
}

for (const ep of ENDPOINTS) {
  const call = (opts) => post(ep.POST, opts);
  const T = (what, fn) => test(`${ep.name}: ${what}`, fn);

  T("the smoke header validates and answers without sending", async () => {
    const r = await call({ headers: SMOKE });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(r.body, { ok: true, smoke: true });
    assert.deepEqual(r.calls, [], "the smoke path reached " + r.calls.join(", "));
  });

  T("the smoke path validates the body rather than waving it through", async () => {
    for (const [what, body] of [
      ["a missing name", { ...VALID, name: "" }],
      ["a whitespace name", { ...VALID, name: "   " }],
      ["a missing message", { ...VALID, message: "" }],
      ["an address with no domain", { ...VALID, email: "nobody@" }],
      ["an address with no at sign", { ...VALID, email: "nobody.example.com" }],
      ["a body that is not an object", "hello"],
    ]) {
      const r = await call({ headers: SMOKE, body });
      assert.equal(r.status, 400, `${what} was accepted: ${JSON.stringify(r.body)}`);
      assert.deepEqual(r.calls, [], `${what} still reached ${r.calls.join(", ")}`);
    }
  });

  T("the real path validates too, so the smoke path is not guarding a different endpoint", async () => {
    const r = await call({ body: { ...VALID, email: "nobody@" } });
    assert.equal(r.status, 400);
    assert.deepEqual(r.calls, [], "an invalid enquiry reached " + r.calls.join(", "));
  });

  T("without the header the real path runs and does not claim to be a smoke test", async () => {
    const r = await call({});
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(r.body, { ok: true });
    assert.equal(r.calls.length, ep.realPath.length, "expected the real path, got " + r.calls.join(", "));
    ep.realPath.forEach((re, i) => assert.match(r.calls[i], re));
  });

  T("a header value other than 1 is not a smoke request", async () => {
    // "1 " is deliberately absent: HTTP strips surrounding whitespace from a header value, so
    // it arrives as "1" and asserting otherwise would test the Headers class, not this file.
    for (const v of ["0", "01", "true", "yes", ""]) {
      const r = await call({ headers: { "x-palate-smoke": v } });
      assert.notEqual(r.body?.smoke, true, `"${v}" was treated as a smoke request`);
    }
  });

  T("in production an unset secret fails closed", async () => {
    const r = await call({ headers: SMOKE, siteEnv: "production" });
    assert.notEqual(r.body?.smoke, true, "the smoke header worked in production with no secret configured");
    assert.match(r.calls[0] ?? "", /challenges\.cloudflare\.com/, "the request did not take the real path");
  });

  T("in production a blank secret fails closed, and two blanks do not match", async () => {
    // The whitespace case is refused twice over: HTTP normalises the sent header to "", and the
    // guard refuses a blank secret before it compares anything. Either one alone would hold.
    for (const secret of ["", "   "]) {
      const r = await call({
        headers: { ...SMOKE, "x-palate-smoke-secret": secret },
        siteEnv: "production",
        env: { PALATE_SMOKE_SECRET: secret },
      });
      assert.notEqual(r.body?.smoke, true, `a blank secret ("${secret}") opened the smoke path`);
    }
  });

  T("in production a wrong secret fails closed", async () => {
    for (const sent of ["nope", "s3cret-but-longer", "s3cre"]) {
      const r = await call({
        headers: { ...SMOKE, "x-palate-smoke-secret": sent },
        siteEnv: "production",
        env: { PALATE_SMOKE_SECRET: "s3cret" },
      });
      assert.notEqual(r.body?.smoke, true, `the secret "${sent}" was accepted against "s3cret"`);
    }
  });

  T("in production a missing secret header fails closed even when the secret is set", async () => {
    const r = await call({ headers: SMOKE, siteEnv: "production", env: { PALATE_SMOKE_SECRET: "s3cret" } });
    assert.notEqual(r.body?.smoke, true, "no secret header was treated as a match");
  });

  T("in production the matching secret opens the smoke path and still sends nothing", async () => {
    const r = await call({
      headers: { ...SMOKE, "x-palate-smoke-secret": "s3cret" },
      siteEnv: "production",
      env: { PALATE_SMOKE_SECRET: "s3cret" },
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(r.body, { ok: true, smoke: true });
    assert.deepEqual(r.calls, [], "the authorised smoke path reached " + r.calls.join(", "));
  });

  T("a refused smoke request is the visitor's enquiry, so it goes through rather than 403", async () => {
    // The reason "ignored" is the contract and a rejection is not: the header can arrive on a
    // real submission the visitor never chose, and dropping it loses the enquiry outright.
    const r = await call({ headers: SMOKE, siteEnv: "production" });
    assert.equal(r.status, 200, "a refused smoke request did not complete as an ordinary enquiry");
    assert.deepEqual(r.body, { ok: true });
  });
}
