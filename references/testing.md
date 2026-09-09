# Testing and verification

## The eval suite (run on every skill change AND every model upgrade)

The skill ships an eval pyramid. Run it whenever the skill changes, and again on every
model upgrade: a model swap shifts the VLM's taste and the sampling behaviour the
divergent spine (Move 1) and the visual loop (Move 3) depend on, so a suite that was
green on one model is not assumed green on the next.

**1. The deterministic gate tests (fast, no model in the loop) - the floor.** Run them
all; every one must be green:

```
for t in scripts/test/*.test.sh; do bash "$t"; done
```

These cover the gates the build leans on: `gate-mcp-depth` (the depth floor, fail-open
contract), `gate-uniqueness` (within-build distinctness), `gate-novelty` (the CONVERGE
concept pre-check + cross-build / type-face recurrence), `gate-done` (the visual +
verifier + novelty "done" gate, fail-open ladder), `ux-lint-eyebrow` (the kicker tell),
and `self-review-fired` (the keystone: a seeded visual defect BLOCKS "done", a clean
build is ALLOWED - `evals/12-self-review-fired.md`).

**2. The two-plane eval over a finished build.** `scripts/eval-runner.mjs` scores one
build on the PROCESS plane (did it draw on the library with depth, AND did DIVERGE
sample wide + CONVERGE score two axes) and the OUTPUT plane (uniqueness + slop + the
cross-build novelty gate):

```
node scripts/eval-runner.mjs --manifest <build>/build-manifest.json --variants <build>/*.html
```

**3. The golden + audacious sets (on-demand, one build per brief).** A full skill build
per brief is heavy, so these run out-of-band: build each brief once into
`<results>/<brief-id>/` (manifest + rendered variant HTML), then aggregate:

```
node scripts/eval-suite.mjs --briefs evals/golden-briefs.json    --results <results>
node scripts/eval-suite.mjs --briefs evals/audacious-briefs.json --results <results>
```

`evals/golden-briefs.json` over-represents the thin everyday verticals (the moat vs
generic slop); `evals/audacious-briefs.json` proves the other failure mode - that the
skill samples wide, advances from the low-typicality tail, decomposes ambition into
buildable mechanics, and still clears the visual loop + every gate
(`evals/11-novelty.md`). `eval-suite` reports a pass-rate and exits 0 only when every
PRESENT build passes (a not-yet-built brief is reported "missing", not failed; add
`--strict` to require every brief built for a CI gate). Run `>= 3` trials per brief and
end-state; every new failure becomes a new case.

## Per-phase verify scripts
Each phase has a verify-{phase}.sh that must pass before the phase is marked complete. See pipeline.md.

## Build-time checks (in CI)
- astro check (typecheck)
- npm run build (must succeed; a logic error here halts, never deploys broken)

## What is actually measured, and on how much of the site

Nothing in this plugin runs Lighthouse. The doctrine used to say "Lighthouse CI, baseline
100s", which promised a gate that does not exist and a number nothing produced.

- **Performance** is a local lab run of Core Web Vitals (`scripts/reference-capture/vitals.mjs`)
  under PageSpeed's own mobile emulation, slow 4G with 4x CPU throttling. It runs on the HOME
  route only, and it is a lab proxy rather than field data: TBT is not INP and is labelled TBT.
  Unthrottled numbers are worthless here, 7.9x apart from the throttled ones on our own site,
  which is why the emulation is not optional.
- **Accessibility** is a SUBSET of axe, described in `references/audit-dimensions.md`, run at
  three viewports. Clearing it is not a WCAG 2.2 AA pass.
- **A route whose own status is meant to be non-200 is not failed for returning it.** `/404`
  answers 404, the browser logs that as a console error, and the console rule filed a High at
  every viewport, so every sweep on the shipped template exited 1 on a fault nobody could fix.
  Only the navigation response itself is exempt: a script error or a missing image on `/404`
  is still a High.
- **Coverage.** `verify-rendered.sh` renders the first **14 routes** by default and says how
  many it dropped. On a bigger site raise it with `--max-routes <n>`, or pass `--routes` to
  name the ones that matter. A 3,400-page site is measured on 14 pages unless you say
  otherwise, and the summary prints exactly that.
- **Re-running after a fix.** `--changed <file,...>` renders only the routes those files can
  reach, and a file the index has never heard of falls wide and says which one.
  `--changed` rebuilds `.palate/index.json` first, since both the blast radius and every
  route's hash are read from it and a stale closure narrows to the wrong routes. A file the
  index cannot place also SETS THE RECORDS ASIDE for that run, because its effect on any hash
  is unknown too. If every selected route is unchanged the run exits 2, skipped rather than
  passed. The saving is a ratio of your own sweep: 25s against 187s on a thirty-route fixture,
  and about 15s of that is the home-route probes, which every run pays whatever it renders. A route whose
  sources have not changed since it last passed is skipped and printed "unchanged, skipped";
  the record lives in `.palate-shots/manifest.json` as `{ sourcesHash, renderedHash,
  passed_at }` per route. Measured on a thirty-route fixture: 25s against a 187s sweep. Run
  the lanes cheap first, ux-lint before rendered, rendered before vitals.
  **The hygiene trend reads inside the loop**, not only on a full sweep: a run that swept a
  different set of routes is compared and its coverage disclosed, and the line names the run it
  compared against. Only a configuration change (vitals on or off, axe missing) refuses a
  comparison, because that is a different quantity rather than a different sample.
- **What the hash covers.** A route's own source, its whole import closure, the content
  entries it renders (the collection its `getCollection` call names, so editing a post
  re-renders the post and its listing), and the SHARED inputs no closure has to name: the Astro config, `package.json` and the lockfile, everything
  under `src/styles` and `src/layouts`, and the CSS those layouts import, which is how the
  brand package's `tokens.css` and `fonts.css` are reached. Change one of those and every
  record goes, with the run printing `global inputs changed, all routes re-rendered`.
- **The sweep before hand-over is `--full`**, which ignores every unchanged-route record.
  Remote content, `public/` assets and environment values stay outside the hash,
  so an unchanged source can still render differently.
  Converge incrementally, certify on a full sweep.

## Post-deploy smoke checks
- workers.dev returns 200
- robots.txt, sitemap, llms.txt return 200
- a test POST to /api/contact, run by `verify-form-roundtrip.sh` from both host verifiers

## The form round-trip test

The gate fills the contact form with valid values, presses send, and reads what the endpoint
answered. Reading the markup cannot tell a working form from one whose submit handler never
bound, whose endpoint returns 500, or whose Turnstile key is wrong: all three render
identically. Pressing the button separates them.

**The smoke header is what makes it safe to run.** The request carries `x-palate-smoke: 1`,
and `src/pages/api/contact.ts` answers it by validating the body and returning
`{ ok: true, smoke: true }` having sent nothing. A 2xx carrying that flag is the only pass.
A 2xx WITHOUT it is a failure, not a pass: it means the header was ignored, the submission
took the real path, and against a deployed site that is a fake enquiry in the client's inbox
and, with a CMS wired, a document in their content.

**In production the header does nothing** unless `x-palate-smoke-secret` matches
`PALATE_SMOKE_SECRET`, and an unset or blank secret refuses every request rather than
matching every request. That guard is not aimed at an attacker. It is aimed at a proxy or a
browser extension adding a header to a real visitor's submission on a deployment where nobody
set the variable, which would make the enquiry evaporate. A refused smoke request therefore
goes through the real path rather than being rejected, because whoever sent it may be a
customer who never chose the header.

Where it runs:

- **Against the preview**, inside `verify-rendered.mjs`. Any route carrying a contact form is
  found during the desktop pass and submitted once afterwards, in its own browser context so
  the audit pass never carries the header. A form is a contact form when it declares
  `action="/api/contact"` OR carries a name, an email and a message field: the shipped
  `ContactForm.astro` has no action at all and posts with `fetch`, so the attribute alone
  would never match the template this was written for. Where the form posts is then measured
  rather than assumed, and a form posting to a third party is reported as UNMEASURED with the
  destination named, never as clean.
- **Against the deployed URL**, by `scripts/verify-form-roundtrip.sh <url>`, which
  `verify-vercel.sh` and `verify-cloudflare.sh` both call after their 200 check. It exits 0
  on a proven round trip, 1 on a failure, and **2 with a printed reason** when the deployment
  serves no `/api/contact`, because a brochure site has not failed by having no form. Set
  `PALATE_SMOKE_SECRET` in the environment it runs in when the target is production.
- **The endpoint's own contract** is exercised as code by
  `scripts/test/contact-smoke.test.mjs`, against BOTH copies of the handler. `add-sanity.sh`
  copies `templates/cms-sanity/src/pages/api/contact.ts` over the base file, so the two carry
  a marked, byte-identical smoke block and the suite compares it.

**The mobile nav and any dialog are worked in the same pass.** The gate finds a closed
disclosure, clicks it, asserts the element it controls became visible, presses Escape and
asserts it closed. Navs are probed at 390 and dialogs at both 390 and 1440, because a nav at
desktop is normally already open. An overlay that cannot be dismissed from the keyboard leaves
a keyboard visitor tabbing through the whole sheet to get out, and looks perfect in a
screenshot; a native `<dialog>` gets Escape for free unless the `cancel` event is prevented,
which is one invisible line. The finding is deduplicated on the control's label, because one
nav or one dialog is normally one shared component.

A trigger is discoverable through `aria-controls`, `aria-haspopup="dialog"`, `commandfor` or
`data-dialog-target`. A `<dialog>` whose opener is bound in a module with none of those cannot
be found from the DOM and is not probed: wire the trigger to the dialog with one of them and
it is covered.

**Editing the endpoint re-renders the pages.** `src/pages/api/contact.ts` is in no page's
import closure, so `src/pages/api` is part of the global digest the unchanged-route skip
folds in. Without that, every page would read as unchanged on exactly the run where the
endpoint is what moved, and the round trip would be skipped on the change it exists to catch.
