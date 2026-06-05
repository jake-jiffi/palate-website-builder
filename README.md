# jiffi-website-builder

One Claude Code skill, three capabilities, designed to compound in value. It builds websites, builds brand packages, and curates its own reference library, so every site you teach it makes the next build better. One thing to install, one thing to grow.

## The three modes

**Build a website.** Brief plus domain in, deployed Astro 6 site on Cloudflare Workers out: Sanity CMS, GitHub repo, CI/CD, custom domain, full SEO and AI-crawler readiness, forms, search, analytics, the client's brand package, and an optional CRO + Ads module. Builds in CI and deploys a pre-built artifact (never builds on Cloudflare).

**Build a brand package.** Raw brand assets in, published private npm package `@jiffi-projects/{slug}-brand` out: four-format design tokens, unified fonts.css, reference components, examples, brand docs. Usable standalone (feeds Claude Design, v0, Cursor, Figma) or as the brand step of a website build.

**Curate the reference library (self-improvement).** Pass it a website and it studies the site, files structured design notes into its built-in library, and gets smarter. The next relevant build automatically draws on what it learned. This is the compounding loop: the more you teach it, the better it builds.

## How the modes connect

```
CURATE  ──teaches──>  reference library  ──informs──>  BUILD SITE
                                                            │ calls when needed
                                                            ▼
                                                        BUILD BRAND ──> brand package ──> BUILD SITE consumes
```

A website build can trigger a brand build in-process (Phase 0, when the client has no brand package yet). The reference library, grown by CURATE, feeds every build. Everything lives in and grows within this one skill.

## Layout

- `SKILL.md` — mode dispatch + the three mode workflows
- `references/` — build operational + detail docs, `brand/` (the brand-package docs), `reference-library/` (the baked-in library data), `reference-library-curation.md` (how to grow it)
- `scripts/` — build scripts, brand scripts (brand- prefixed where they'd collide), the curator (`add-reference-site.sh`), all tested bash
- `templates/` — `astro-project/` (the site, build-in-CI workflows), `brand-repo-skeleton/` (the brand package shape), `sanity-schema/`, `github-workflows/`, `cro/` (dormant sub-skills as .tpl)

## Setup required once per machine

`gh`, `node` 22+, `npm`, `jq`, `wrangler`, plus env for the modes you use: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, SANITY_AUTH_TOKEN, JIFFI_SANITY_ORG_ID, RESEND_API_KEY (build); GITHUB_PACKAGES_TOKEN in ~/.npmrc (brand). `scripts/preflight.sh` (build) and `scripts/brand-preflight.sh` (brand) check what's needed.

## The reference library

Baked in at `references/reference-library/`, no repo, no clone, no network. Ships with 5 sites (Linear, Stripe, Anthropic, Plain, Aesop) and a matrix referencing 10 more as planned. Grow it any time: "add {site} to your reference library".
