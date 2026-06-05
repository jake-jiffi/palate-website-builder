---
name: jiffi-website-builder
description: >
  The complete Jiffi web delivery skill, three modes in one. (1) Builds production-grade Astro websites end to end: Sanity CMS, Cloudflare Workers hosting (build in CI, deploy artifact), GitHub CI/CD, custom domain, analytics, forms, search, full SEO and AI-crawler readiness, the client's brand package, optional CRO + Ads module. (2) Converts raw brand assets into a published private npm package (@jiffi-projects/{slug}-brand) with four-format tokens, fonts, components, and brand docs, standalone or as the brand step of a build. (3) Curates its own built-in reference library: pass it a website and it studies the site, files design notes, and gets smarter so future builds use what it learned. Trigger whenever Jake asks to build, scaffold, or start a client website; migrate from Webflow; build or convert a brand into a package; or add/study/refresh a site in the reference library ("add Linear to your references", "learn from this site"). One skill to manage and grow.
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash, Skill, WebSearch, WebFetch, mcp__website-references]
---

# Jiffi Website Builder

One skill, three capabilities, designed to compound in value over time. It builds websites, it builds brand packages, and it curates its own reference library, so every site you teach it makes the next build better. One thing to install, one thing to grow.

## Mode dispatch (read this first)

Decide which of three modes the request is, then jump to that section. When a request spans modes (a full build that also needs a brand package), run the modes in the order the build pipeline calls for.

| If the request is... | Mode | Go to |
|----------------------|------|-------|
| "build/scaffold/start a site for {client}", "migrate {client} from Webflow", "Jiffi standard build" | **BUILD SITE** | "Mode: Build a website" |
| "build a brand repo / brand package for {client}", "convert these brand assets", "turn this brand into code" (no website) | **BUILD BRAND** | "Mode: Build a brand package" |
| "add {site} to the reference library", "study this site", "learn from {url}", "refresh the {site} reference" | **CURATE** | "Mode: Curate the reference library" |

The three modes share infrastructure (slug derivation, the reference library, state patterns) but produce different things. CURATE is the self-improvement mode: it doesn't build anything for a client, it makes this skill smarter. BUILD SITE may call BUILD BRAND internally (Phase 0) when a site needs a brand package that doesn't exist yet.

Do not use this skill for: one-page landing pages with no CMS, pure web applications, or editing an already-scaffolded site (use the sub-skills inside that project).

---

## Mode: Build a website

Brief plus domain in, real Astro site out. The build runs in two stages on ONE codebase, and the process below is mandatory, not advisory (see "The non-negotiable build contract").

### Two stages, one codebase
A build has a `stage`, recorded in `.jiffi-skill-state.json`:

- **preview** (the default for "redesign this", "make it look good", "let me see it first"): runs Phase 0 (brand) + Phase A (scaffold the real SSR + Sanity-wired Astro project) + the preview verification gate, then STOPS. Deliverable: a **shareable Vercel preview deployment** (a live `*.vercel.app` link the client can open and leave Vercel Toolbar Comments on) via `scripts/deploy-preview.sh` - this is the default so previews are shareable for feedback. The preview runs on the bundled `content.ts` fallback layer, so NO Sanity project, custom domain, GitHub repo or PRODUCTION deploy is touched (a preview deployment is throwaway) - the SSR adapter, the Sanity data layer, the draft-mode endpoints and the visual-editing channel are all already wired in. Use `--local-preview` for a local dev-server link instead (faster for solo iteration, no cloud). This is the real production codebase, just not provisioned; promoting it later is a continuation, never a rebuild.
- **production** ("make it production-ready", "take it live", "ship it"): runs `scripts/promote-to-production.sh` (which re-checks the preview is a real Astro project) then continues Phases B-F on the SAME project - provisioning Sanity, deploying the SSR worker, seeding the CMS from `content.ts`. Never starts over.

A request that says nothing about stage defaults to preview. At the end of a preview, hand over the `SHAREABLE_URL` from `deploy-preview.sh` - an open-for-anyone link (the script auto-enables Vercel Protection Bypass via the CLI, so the client needs no login) - and note that "make it production-ready" promotes it. With `--local-preview`, hand over the local `npm run dev` link instead.

### The non-negotiable build contract (this is what makes it production-grade)
These are hard requirements. If any cannot be met, STOP and say so. NEVER substitute a shortcut.

1. **The deliverable is a real Astro project scaffolded from `templates/astro-project/`.** Never hand-write HTML/CSS/JS files as the deliverable. Loose `.html` files at the project root are the freestyle anti-pattern and are forbidden.
2. **Preflight runs first and must pass** (`scripts/preflight.sh`). If tools are missing, install them (or instruct/auto-install per environment); do not proceed half-configured.
3. **Phase A scaffolds from the template, then `scripts/verify-is-real-astro.sh` MUST pass** before the preview is considered done. This gate fails the build if the output is not a genuine Astro project that compiles. It is the anti-freestyle checkpoint.
4. **Every phase records state and verifies before being marked complete.** No skipping, no "I'll just do the visible part".
5. **The brand system comes from the brand package (or vendored brand), applied through the template's BaseLayout and Tailwind preset.** Not ad-hoc inline styles invented per page.
6. **Resolve the working directory by detection, never by assumption.** Run `detect-environment.sh` first and build under the WORK_ROOT it returns. Do not hardcode `/mnt/...` paths, do not assume a folder is writable, never build inside the skill's own directory. Establish a real, user-visible project folder up front (`request_cowork_directory`) so the deliverable is never stranded in a temp session folder the person cannot find.
7. **The site is SSR + Sanity-wired from the first file.** Server-rendered on the host (Vercel by default, Cloudflare as the backup), every page reading through the Sanity data layer, with the `content.ts` fallback so the preview needs no Sanity project. NEVER strip the CMS wiring to ship a faster static preview - that forces a static-to-SSR rebuild later. "Sanity later" means provision the project later, not remove the wiring. See `references/build-stages.md` and `references/cms-and-draft-preview.md`.
8. **Draft preview is standard.** The Sanity Presentation tool showing unpublished edits is wired into every build, not an add-on. Exact config in `references/cms-and-draft-preview.md`.
9. **Explore comes first for every new site / landing page.** Generate 8-10 genuinely different home-page variants (some reference-led, some invented), let the client pick what to combine, then compose the canonical pages from those picks. Same Astro project the whole way through - variants ARE the project at an earlier shape. Skip only for tiny edits, CURATE runs, or briefs that name an existing direction. See `references/explore-stage.md`.
10. **Mechanical and interpretive aesthetic gates run at Compose, Finalise and Production.** The mechanical gate is `scripts/ux-lint.sh`, which parses `references/anti-patterns.md` and enforces house style (no em dashes), banned fonts and gradients, AI tells in copy, and the Vercel-derived code-level rules. The interpretive gate is the Phase A.4 reviewer pass against `references/audit-dimensions.md`. Both must pass with no Critical or High findings before the preview is handed over and again before production provisioning. The verify-fail loop in `references/errors.md` applies (read, diagnose, fix the real cause, re-run, max 3 attempts, then HALT). Per-line escape: `ux-lint-disable <rule-id>` comment on the same or preceding line.
11. **Critique discipline runs at variant-time and compose-time.** Every variant begins with a stated Design Read and carries a demonstrative concept from the Story Engine (`references/story-engine.md`); Compose runs the 6-axis pre-emit critique, the anti-default detector, the feel gate (would the ICP feel seen) and the Conceptual Grounding Test before emit; the lead reference's signature move must appear in the build (re-skinned, named and located); Claude's own narration avoids the vague-word ban list. See `references/critique-discipline.md`.

If the environment genuinely cannot run Node/Astro (so no real scaffold is possible), the correct action is to STOP and tell the person what is needed, NOT to produce a static HTML mockup and present it as the deliverable.

### The plan checkpoint (careful work only)

Before substantial or irreversible work, show a short plan and get a go-ahead. This is NOT a gate on every action - it is for four moments:

1. **Before Phase A starts.** Show, in a few lines: the pages to build, the brand source (package / composed / vendored), the references chosen, the industry (steers per-industry rules via `references/industry-patterns.md`), the stack and the host (**Vercel is the default; Cloudflare is the backup** - always ASK which to use, stating Vercel as the default, even on a quick build; see `references/hosting-vercel.md`), whether Explore is on (default YES for new sites / landing pages - see `references/explore-stage.md`), the stage (preview or production - note a preview is deployed to a shareable Vercel link unless `--local-preview`), and two required client-input fields: **the wow moment** (one sentence on what this site does that nothing else does) and **the avoid list** (3 to 5 explicit don'ts, e.g. "no purple", "no stock people photos"). Then ask: "Proceed?"
2. **After Explore generates the variants** (when Explore is on). The preview link is live with `/v1`..`/vN` (+ `/lp1`..`/lpN` if applicable); pause and ask which sections to combine. Mix-and-match is the default ("v3 hero, v7 features, v5 cta"); whole-variant shortcuts are fine.
3. **After Compose builds the canonical pages.** The composed `src/pages/index.astro` and the rest of the site are live in the chosen direction; pause and ask: "Proceed with the deep build?"
4. **Before production provisioning (Phase B onward).** Show what real infrastructure this creates and commits: a Sanity project, the host's worker / function, a GitHub repo, and - at Phase E - a DNS cutover. Then ask: "Proceed?"

SKIP every checkpoint for tiny, reversible work: editing an already-scaffolded project, adding one section, a CURATE run, re-running a verify, a brief that names an existing direction ("build it like the Northwind site"). Do not make a quick edit wait on a confirmation.

Keep the plan concise - a handful of lines, not a document. Its job is to catch a wrong assumption before it costs a rebuild or real money, nothing more.

### The phases
0. **Brand**: detect `jiffi-projects/{slug}-brand`. If missing and raw assets exist, run BUILD BRAND in-process (composed). For a redesign, extract the real tokens from the client's existing site with the capture engine (`references/phase-0-brand-detection.md`). If no assets, scaffold with `--vendor-brand` defaults. Capture the exact package version.
A. **Scaffold + Explore + Compose** (one phase, one project, several substages):
   1. **Copy + install**: copy `templates/astro-project/`, substitute vars, commit the project .npmrc, install the brand package and deps. **Merge `_claude/` into `.claude/`** (the skill zip ships project-level hook files under `_claude/` because the sandbox protects `.claude/` from new writes - the rename is a one-step merge with the existing `.claude/CLAUDE.md.tpl`). **The template is Vercel-native (the default host) - do nothing extra for Vercel.** ONLY when the person chose `--host cloudflare`, run `scripts/switch-host-cloudflare.sh <project-dir>` after the copy: it swaps in the Cloudflare adapter, `package.json` deps, `wrangler.toml`, `public/_headers` and the wrangler CI workflows (`deploy`/`preview`/`revalidate`), and removes `vercel.json`. See `references/hosting-vercel.md`.
   2. **EXPLORE** (default for new sites / landing pages; skip for tiny edits, CURATE runs, or briefs that name an existing direction). Set `PUBLIC_EXPLORE_MODE=true`. Generate 8-10 home-page variants as `/v1`..`/vN` (plus `/lp1`..`/lpN` if the brief warrants), each composed of section components wrapped with `<SectionMark id="vN-..."/>`; register each in `src/lib/variants.ts` with `{ id, name, href }` (give each an evocative `name`) so the bottom-right direction picker shows it. Variants must be genuinely different (some reference-led, some invented) - see `references/explore-stage.md`. Hand over the preview URL.
   3. **PAUSE - pick.** The client says what to combine ("v3 hero, v7 features, v5 cta") or picks a whole variant.
   4. **COMPOSE.** Build the canonical `src/pages/index.astro` and the rest of the site's pages from the picked sections, adopting the dominant variant's design tokens (usually whichever supplied the hero). Move variant routes into `_explore-archive/`, clear `src/lib/variants.ts`, flip `PUBLIC_EXPLORE_MODE` to `false`.
   5. **PAUSE - confirm.**
   6. **Finalise**: fill `src/lib/content.ts` with the real copy, rename `src/pages/blog/slug.astro.tpl` -> `src/pages/blog/[slug].astro` if a collection is needed (Astro dynamic routes need brackets; the skill zip ships it bracket-free), apply design mode + reference-library inspiration, init git.
   7. **Aesthetic gates**: run `scripts/ux-lint.sh <project-dir>` (mechanical) and the reviewer pass against `references/audit-dimensions.md` (interpretive, output in Vercel `file:line` format). Fix Critical / High findings; re-run until clean. The verify-fail loop in `errors.md` applies.
   8. **Structural gate**: run `scripts/verify-is-real-astro.sh`.
   --- PREVIEW STOPS HERE ---
B. **Sanity**: provision project + dataset + viewer/editor tokens, SEED the dataset from `content.ts`, editor invites. The Studio is embedded at `/studio` (via `@sanity/astro`) and ships with the site - no separate Studio deploy.
C. **Hosting**: Vercel (**default**) - `scripts/provision-vercel.sh` links the project, pushes env vars scoped per environment (including `GITHUB_PACKAGES_TOKEN` so the cloud build installs the private brand package), runs `vercel git connect` (so pushes auto-deploy + PRs get previews + Toolbar Comments), and triggers the initial production deploy. Cloudflare (backup, `--host cloudflare`) - `scripts/provision-cloudflare.sh` uploads Worker secrets and deploys the SSR worker. See `references/hosting-vercel.md`.
D. **GitHub**: repo, secrets, branch protection, team access, push. On `--host cloudflare`, CI builds + deploys the artifact. On Vercel, after the repo is pushed, ensure `vercel git connect --yes` has run in the project dir (provision-vercel does it when the remote already exists; otherwise run it here) so Vercel owns the deploy loop. Content changes need no redeploy on either host (SSR serves fresh - see `references/cache-invalidation.md`).
E. **Domain**: Vercel `vercel domains add` with auto-issued TLS (default); Cloudflare full-auto when on the Cloudflare backup; or external CNAME instructions. DNS cutover stays a human-confirmed step on any host.
F. **Optional**: Humblytics (or Plausible), Kit, Turnstile, IndexNow. CRO module if `--with-cro` (dormant).

### How to run a build
Provide: client name, domain, brief. Optional: `--stage=preview|production` (preview default), `--host=vercel|cloudflare` (**vercel default**; always confirmed at the plan checkpoint), design mode (clean-corporate / motion-heavy-creative / minimal-portfolio, inferred if absent), website style (product / service / story / operational / consumer / portfolio, inferred if absent), `--editors`, `--skip-brand-repo`, `--vendor-brand`, `--with-cro`, `--analytics=plausible`, `--local-preview` (hand over a local dev-server link instead of a shareable Vercel preview), infra overrides.

### Build execution order
1. **Detect environment**: `eval "$(scripts/detect-environment.sh)"`. This resolves WORK_ROOT (a proven-writable build dir that works in Cowork-as-a-task, Cowork-in-a-folder, or Claude Code in a folder) and OUTPUTS_DIR. Do all building under WORK_ROOT/{slug}-site. Never assume a path exists or is writable; this script proves it. See `references/environments.md`.
2. Confirm slug (`references/naming.md`). For production, also validate availability across Cloudflare, Sanity, GitHub, and the brand repo.
3. **Resolve the host, then preflight matched to stage.** Host defaults to `vercel` (or `cloudflare` if chosen at the plan checkpoint); export it as `JIFFI_HOST` so preflight and provisioning target the right platform. Preview runs `scripts/preflight-preview.sh` (node, npm, git, jq, writable dir, NO cloud credentials). Production runs `scripts/preflight.sh`, which checks the chosen host (Vercel CLI + `vercel whoami` by default; Cloudflare token + wrangler when `JIFFI_HOST=cloudflare`) plus Sanity, GitHub, the ~/.npmrc brand token. A preview must never be blocked by missing cloud credentials it will not use.
4. **State init EARLY**: `scripts/state-init.sh <slug> <client> <domain> <stage>` runs now, before scaffold, so the build is resumable from the very first step. (Do not defer state creation; a partial scaffold must leave resumable state behind.)
5. Phase 0: brand detection or in-process BUILD BRAND (`references/phase-0-brand-detection.md`). Pin the exact version. **If the client has few usable assets** (no good site/logo/photos), run the asset-sourcing engine (`references/asset-sourcing.md`): recover and vectorise the logo, gather quality-judged real photos / about / reviews / Google Place images (reject the bad ones), placeholder the gaps with Unsplash plus a content-gap list, and feed the imagery pattern + reviews into the Story Engine.
6. **Run the Story Engine** (`references/story-engine.md`): research the real business and its ICP, find the transformation and the one true thing, and shape the demonstrative concept each Explore variant will carry. Ground concepts and craft in the **`website-references` MCP** (the read path, no cloning): `refs_for_business` / `refs_match_brief` to fix the spine + style/cluster, `refs_insights { topic: "mechanics" | "emotion" }` and `refs_search { register, device, intensity }` for the concept layer, then `refs_get` / `refs_get_tokens` / `refs_get_astro_recipe` for the donors, executed via the organ-transplant method (`references/reference-library-usage.md`). For each conversion section (pricing, booking, menu, services, contact) run the **section-build recipe** in that file: facet-search the section (`refs_search { pageType, conversionPrimitive, uiElement }`), VIEW donors' real inner pages (`refs_get_screenshot { slug, page:"pricing" }`), and build from their `doDont` + `componentPrompts` (the taste layer). A build that stops at `refs_for_business` + the home screenshot + tokens is leaving the library's section depth, inner pages and taste layer unused. Offline / CURATE fallback only: `eval "$(scripts/sync-reference-library.sh)"`.
7. Phase A: scaffold from the template into WORK_ROOT/{slug}-site, build the pages as real `.astro`. Then run `scripts/verify-is-real-astro.sh` (contract item 3). Mark previewVerified complete.
8. If stage is preview: **deploy a shareable Vercel preview** with `scripts/deploy-preview.sh WORK_ROOT/{slug}-site {slug}` (add `--explore` while Explore variants are live so the picker shows), capture `SHAREABLE_URL`, and hand the person that link directly - it is a real `*.vercel.app` deployment they can send to the client for Vercel Toolbar Comments. Then STOP, noting that "make it production-ready" promotes it. With `--local-preview` (or if Vercel is unavailable), fall back to `scripts/serve-preview.sh WORK_ROOT/{slug}-site` for a local dev-server link instead.
9. If stage is production (now or later via `promote-to-production.sh`): run Phases B-F, each verified, state updated. Phase F non-blocking.
10. Generate `handover.md` (`references/handover-format.md`); offer content seeding.

### Build critical rules
- The build contract above is non-negotiable. A static-HTML mockup is never an acceptable deliverable.
- Read `references/build-stages.md` before starting (preview vs production, the promotion path).
- Read `references/naming.md` before deriving any slug, `references/state.md` before any phase, `references/reference-library-usage.md` before using the library.
- Each phase MUST verify before being marked complete; preview MUST pass `verify-is-real-astro.sh`.
- Never write secrets to state. Tag resources `jiffi:project-slug={slug}`.
- Use the templates, not `npm create astro`. Pin the brand package to an exact version, never `latest`.
- On the Cloudflare backup, the build happens in CI and deploys an artifact; it never builds on Cloudflare. On Vercel (default), Vercel's own GitHub integration owns the build/deploy loop after the first `provision-vercel.sh` deploy.
- The reference library follows the **two-layer doctrine**: reproduce a reference's craft layer faithfully (grid, spacing rhythm, type scale, motion choreography, signature compositional move) and re-skin it with the client's brand; protect the identity layer (palette hexes, wordmark, font files, photos, copy) absolutely. The lead reference's signature move MUST appear in the build, re-skinned - name it and locate it. Get variety by choosing DIFFERENT references per build, not by diluting any one; vary which reference leads. Transplant the lead's structure wholesale, then graft ONE motion organ and ONE type organ from different donors via the MCP organ-transplant method (`references/reference-library-usage.md`). For every conversion section, additionally run that file's **section-build recipe** (facet-search the section, view donors' inner pages via `refs_get_screenshot { page }`, build from their `componentPrompts`, check against their `doDont`) so the section is grounded in how the best sites build THAT page, not memory. The client's brand colours always win.
- **Concept before composition.** Run the Story Engine (`references/story-engine.md`) before generating variants: research the real business, find the transformation and the one true thing, and give each variant a demonstrative concept across the safe-warm..one-of-a-kind ambition spectrum (at least one one-of-a-kind). Every variant passes the feel gate (would the ICP feel seen). Concept is WHAT and the feeling is WHY; reference craft is HOW, in service of the idea. These instincts are codified in `references/creative-principles.md`.
- **Real assets, or honest placeholders.** When the client lacks assets, the asset-sourcing engine (`references/asset-sourcing.md`) finds and quality-judges real ones (logo recovered and vectorised, good photos / about / reviews / Google Place images), placeholders the rest with Unsplash plus a content-gap list in the handover, and feeds the imagery pattern to the Story Engine. Use real assets when good enough; never ship a bad real asset, never pass a placeholder off as the client's own.

---

## Mode: Build a brand package

Converts raw brand assets into a published private npm package `@jiffi-projects/{slug}-brand`: four-format design tokens (W3C DTCG JSON source of truth, CSS custom properties, typed TS, Tailwind preset), a unified fonts.css, kebab-cased assets, reference React + Tailwind components, full-page examples, and seven markdown brand docs. The package feeds Claude Design, v0, Cursor, Figma Make, and is consumed by the BUILD SITE mode.

Usable two ways:
- **Standalone**: Jake asks for a brand package, no website. Interactive: ask before inventing when assets are missing.
- **Composed**: called by BUILD SITE Phase 0. Never blocks the flow; uses documented defaults, batches assumptions for the handover.

### Brand needs
A path to raw assets (brand PDF, fonts, logos, illustrations, copy, any existing brand skill), client name and slug.

### Brand execution order
1. Preflight: `scripts/brand-preflight.sh` (gh auth, packages-write capability, node, npm, sips).
2. Resolve repo: `scripts/resolve-repo.sh {slug}` (create if absent, verify empty if present).
3. Init state: `scripts/brand-state-init.sh` (`.jiffi-brand-state.json`).
4. Inventory assets: `scripts/inventory-assets.sh` (`references/brand/asset-classification.md`). Reuse any existing brand/voice doc verbatim.
5. Scaffold: copy `templates/brand-repo-skeleton/` (`references/brand/structure.md`).
6. Process assets: `scripts/process-images.sh` (kebab-case, AVIF+JPG pairs).
7. Generate tokens: one logical source to four formats (`references/brand/token-generation.md`).
8. Write fonts.css: one family per typeface (`references/brand/fonts-css-rules.md`).
9. Write components, examples, the seven brand docs.
10. Write meta files: README, CLAUDE.md, AGENTS.md, LICENSE, package.json, .npmrc, .gitignore.
11. Publish: `scripts/publish-package.sh` (registry-check first, skip-if-identical or patch-bump).
12. Commit and push (ask if interactive; proceed if composed and approved upfront).
13. Photography pass (separate, if photography present).

### Brand critical rules
- Read `references/brand/structure.md` before scaffolding, `references/brand/opinionated-choices.md` before tokens/fonts/photography.
- Reuse existing voice/brand work verbatim.
- Never invent silently: interactive asks, composed batches and defaults.
- One family name per typeface. Tokens from one source, four formats, never hand-written separately.
- Consumers pin exact versions. Never push without approval.
- The brand repo's CLAUDE.md leads with brand-specific non-negotiables (colour, language e.g. Australian English, typography e.g. no em dashes, character rules).

---

## Mode: Curate the reference library (self-improvement)

This is how the skill gets better. The skill keeps only the reference-library MACHINERY (`references/reference-library/` - scripts, schema, `_meta/` docs); the CATALOG of analysed sites is NOT bundled - it lives in an external public GitHub repo, `github.com/jake-jiffi/website-references`, and is synced on demand. This is deliberate: a skill is capped at ~200 files and each deep entry is ~55-60 files, so bundling the catalog would blow the cap. Pass it a website and it reverse-engineers the site with a real headless browser, files a deep structured reference into that repo, and that knowledge feeds every future build. No client deliverable, just a smarter skill.

The library is **schema v2**: each entry is a deep captured record - real tokens, the type scale, motion specs with easing curves, layout system, component anatomy, an Astro-rebuild guide, plus screenshots and SVG assets - not a hand-written description. See `references/reference-library/_meta/schema.md` for the entry contract and `_meta/capture-pipeline.md` for the engine.

### Curate execution order
When Jake says "add {site}", "study this site", or "learn from {url}":
1. **Sync the library**: `eval "$(scripts/sync-reference-library.sh)"`. The catalog lives in an external GitHub repo, not the skill (a skill is capped at ~200 files); this clones it and sets `JIFFI_REFERENCE_LIBRARY_PATH`. See `references/reference-library/_meta/library-architecture.md`.
2. **Scaffold**: `scripts/add-reference-site.sh <slug> <url> <style> <mode> [secondary] [tier]`. Creates `catalog/<slug>/` with the v2 notes stubs, updates `index.json`.
3. **Set up the engine once**: `scripts/reference-capture/setup.sh` (installs Playwright + headless Chromium; idempotent).
4. **Capture**: `scripts/capture-reference-site.sh <slug> <url> $JIFFI_REFERENCE_LIBRARY_PATH/catalog/<slug> "<inner-csv>" desktop`, then again with `responsive`. The engine renders the site, runs its JS, scrolls it, and extracts computed tokens, motion, layout, structure, the stack, screenshots and SVGs.
5. **Write the notes**: read `_capture/digest.md`, then the raw JSON, then VIEW the screenshots; write every Layer 1 file - including `astro-rebuild.md`. Full guidance in `references/reference-library-curation.md`.
6. **Validate, commit, push**: `jq empty` the JSON, confirm `select-references.sh --site <slug>` returns it; then `git add/commit/push` the library repo so the entry is permanent and syncs everywhere.

### Curate critical rules
- The capture is the *seeing*; the notes are the *thinking*. Use the captured numbers - the point of the engine is that notes cite real values (`cubic-bezier(0.25,0.46,0.45,0.94)`, `0.16s`), never vague description.
- `astro-rebuild.md` is mandatory and is the point of the upgrade: how to reproduce the site's strengths on Astro + Tailwind + the client brand package.
- Posture: the library is internal Jiffi intelligence. Measurements, analysis and captured assets are kept for internal reference; client deliverables are always original. Voice notes stay abstract (one quote under 15 words max). See `references/reference-library/CONTRIBUTING.md`.
- Taxonomies are fixed (6 styles x 3 modes). Quality over coverage: a shallow entry misleads a build.
- Unattended runs: the overnight curation task works through `_meta/curation-queue.json`. The capture is phased because the sandbox caps shell calls near 45s.

### The self-use loop
Once a site is curated, BUILD SITE's reference selection (`select-references.sh`) finds it automatically and reads its `astro-rebuild.md` and `motion.json`. Teach the skill Stripe, and the next product-site build draws on Stripe's real structure, tokens and motion. The skill literally uses what it learned. The more you curate, the better it builds.

---

## Shared infrastructure

- **Slug derivation**: `scripts/derive-slug.sh` (shared across all modes; handles the digit-start edge case).
- **Reference library**: the catalog of 228 analysed sites lives in an EXTERNAL (now PRIVATE) GitHub repo - `github.com/jake-jiffi/website-references` - NOT in the skill (a skill is capped at ~200 files; the library grows past that). BUILD SITE now READS it through the hosted **`website-references` MCP** (`refs_*` tools), not by cloning - see `references/reference-library-usage.md`. The data path: CURATE writes a deep entry to the private repo and pushes; a GitHub Action re-seeds the MCP's Supabase store; BUILD reads the live MCP. The skill still ships the machinery: the `scripts/`, the `_meta/` schema docs, and `references/reference-library/library-source.json`. `scripts/sync-reference-library.sh` (now needs the token, repo is private) is the offline / CURATE-write fallback; `references/reference-library/_meta/library-architecture.md` explains the split. Grown by CURATE, read by BUILD SITE via the MCP.
- **State**: BUILD SITE uses `.jiffi-skill-state.json`; BUILD BRAND uses `.jiffi-brand-state.json`. Both resumable. The cross-mode handshake (a build that called a brand build, interrupted mid-brand) is in `references/phase-0-brand-detection.md`.

## Known gotchas

See `references/gotchas.md` (build) and `references/brand/gotchas.md` (brand). The critical ones: the CI workflow needs `permissions: packages: read` or the brand package install 401s; set GitHub secrets before first push; the Sanity Studio hostname is globally unique; the build never happens on Cloudflare; GitHub Packages needs a `write:packages` PAT for the brand mode; the brand pin intentionally lags the brand repo latest.

## References

Build operational: `build-stages` (preview vs production, the contract), `cms-and-draft-preview` (the SSR + Sanity + draft-mode architecture - read before any build), `production-handoff` (running provisioning hands-off via the user's Terminal), `naming`, `state`, `errors`, `idempotency`, `pipeline`, `phase-0-brand-detection`, `explore-stage`, `critique-discipline` (the four pre-emit habits), `audit-dimensions` (the reviewer pass), `anti-patterns` (the ux-lint rule source of truth), `build-memory` (cross-build diversification), `industry-patterns` (per-industry anti-patterns), `brand-package-consumption`, `reference-library-usage`, `existing-infra`, `hosting-vercel`, `team-access`, `composition`.
Build detail: `assets`, `connective-tissue`, `testing`, `environments`, `cache-invalidation`, `schema-versioning`, `claude-md-template`, `agents-md-template`, `handover-format`, `versioning`, `webflow-migration`.
Brand (`references/brand/`): `structure`, `opinionated-choices`, `perceptual-floors` (cited research-grounded minimums), `normalisation-rules` (raw extraction to usable brand), `asset-classification`, `token-generation`, `fonts-css-rules`, `photography-pipeline`, `voice-extraction`, `publishing`, `state`, `gotchas`, `handback`.
Library: `reference-library-usage` (consume), `reference-library-curation` (grow). Methodology lives in `references/reference-library/_meta/` - `library-architecture.md` (the skill-vs-repo split), `schema.md` (entry contract), `capture-pipeline.md` (the engine). The catalog data and the curation queue live in the external repo named in `library-source.json`.
CRO: `cro-module`. Reference: `stack`, `gotchas`, `examples`.

## Scripts

Build: `detect-environment` (run first; resolves a writable WORK_ROOT for any environment), `preflight-preview` (preview: node/npm/git/jq only), `preflight` (production: adds cloud creds), `derive-slug`, `detect-brand-repo`, `verify-brand-exports`, `select-references` (now supports `--principle`), `state-init/update/resume`, `verify-is-real-astro` (anti-freestyle structural gate), `ux-lint` (anti-slop aesthetic gate, parses `references/anti-patterns.md`), `deploy-preview` (default preview handover: deploys a SHAREABLE Vercel preview + Toolbar Comments; `--explore` shows the picker), `serve-preview` (the `--local-preview` fallback: local dev-server link), `promote-to-production`, `provision-sanity/github`, `provision-vercel` + `verify-vercel` (the default host), `switch-host-cloudflare` + `provision-cloudflare` + `verify-cloudflare` (only on `--host cloudflare`), `attach-domain`, `optional-services`, `install-cro`, `verify-*`, `rollback`.
Brand: `brand-preflight`, `resolve-repo`, `brand-state-init/update/resume`, `inventory-assets`, `process-images`, `publish-package`.
Curate: `sync-reference-library` (clone/update the external library repo), `add-reference-site` (scaffold a v2 entry), `capture-reference-site` (run the headless capture, phased), `reference-capture/setup.sh` (install the capture engine), `reference-capture/capture.mjs` (the Playwright engine itself).

## Templates

`templates/astro-project/` (the site scaffold, build-in-CI workflows, committed .npmrc, plus `_claude/hooks/anti-slop-check.js` + `_claude/settings.local.json` that Phase A merges into `.claude/` so every shipped project carries the project-level anti-slop gate), `templates/host-cloudflare/` (the Cloudflare backup overlay - adapter, deps, `wrangler.toml`, `public/_headers`, the wrangler CI workflows - applied by `switch-host-cloudflare.sh` only on `--host cloudflare`; the baseline `astro-project/` is Vercel-native and ships only `ci.yml`), `templates/brand-repo-skeleton/` (the brand package shape, four-format tokens, components, examples), `templates/sanity-schema/` (collections incl. formSubmission, heroVariant, campaignPage), `templates/github-workflows/`, `templates/cro/` (the four dormant CRO sub-skills as .tpl, renamed on install).

## Evals

`evals/` holds canonical test briefs with objective pass/fail checklists - run them after any change to the skill to catch regressions before they reach a client build. `evals/01-brochure-preview.md` through `04-explore-stage.md` cover the core build flows; `evals/05-design-skill-gates.md` covers ux-lint, critique discipline, perceptual floors, the project-level hook, the reviewer pass, and brand normalisation (six evals in one file to stay under the 200-file skill cap).

## Examples

See `references/examples.md`. Across the three modes:
- Build: "Build a site for Addikted to Ink, atink.com.au. Brand assets at ~/Downloads/atink-brand."
- Brand only: "Build a brand package for Enviz, assets at ~/Downloads/enviz-brand."
- Curate: "Add Linear to your reference library." / "Study vercel.com and learn from it."
