# The full pipeline

The seven phases in order, what each does, and the verify gate. Every build is
SSR + Sanity-wired from Phase A (see `build-stages.md`).

| Phase | Script | Verify | Produces |
|-------|--------|--------|----------|
| 0 brand | detect-brand-repo.sh | verify-brand-exports.sh | brand package + exact version, or vendored assets. For a redesign, also extract real tokens from the existing site (see phase-0-brand-detection.md). |
| A.1 scaffold | (template copy + npm install + optional `switch-host-cloudflare.sh` on `--host cloudflare`) | (continues into A.2) | building SSR Astro site, Sanity data layer wired, draft-mode endpoints + visual-editing in place; ready for Explore |
| A.2 EXPLORE *(default: ON)* | (generate `/v1`..`/vN` + `/lp1`..`/lpN`, update `src/lib/variants.ts`, `PUBLIC_EXPLORE_MODE=true`) | PAUSE - client picks sections | 8-10 genuinely-different home-page variants, switcher live, section labels visible. See `explore-stage.md`. |
| A.3 COMPOSE | (build canonical pages from picks, adopt dominant tokens, archive variants, `PUBLIC_EXPLORE_MODE=false`) | PAUSE - client confirms direction | canonical `index.astro` + remaining pages in the chosen direction; project shape normalised |
| A.4 finalise | (fill content.ts, rename bracket-free templates, init git) | verify-scaffold.sh + verify-is-real-astro.sh | preview-ready: content.ts filled, git initialised, anti-freestyle gate passed |
| B sanity | provision-sanity.sh | verify-sanity.sh | project, dataset, two tokens, schemas, **seeded from content.ts** (Studio embedded at /studio, ships with the site) |
| C cloudflare | provision-cloudflare.sh | verify-cloudflare.sh | secrets set, SSR worker deployed, workers.dev live |
| D github | provision-github.sh | verify-github.sh | repo, secrets, branch protection, CI building + deploying |
| E domain | attach-domain.sh | verify-domain.sh | custom domain attached or manual instructions |
| F optional | optional-services.sh / install-cro.sh | (non-blocking) | analytics, forms, search, IndexNow, CRO dormant |

Each phase: check state (skip if complete), run, verify, update state to
complete. A failed verify halts with the error class (see errors.md).

Phases B-F provision real infrastructure. In Cowork they run hands-off by
driving the user's Terminal - see `references/production-handoff.md`. Phase A
produces a site that already expects Sanity, draft mode and the SSR runtime, so
B-F only provision and connect; they never rebuild. The CMS content model and
the draft-preview wiring are defined in `references/cms-and-draft-preview.md`.
