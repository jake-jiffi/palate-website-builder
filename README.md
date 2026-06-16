# Palate Website Builder

A Claude Code skill that builds production-grade Astro websites, grounded by the Palate MCP. The Palate MCP serves a library of 268 deeply-analysed real websites (with inner-page depth, design tokens, do/don't rules, component prompts, and a taste layer), so the sites this skill builds carry real design craft instead of generic AI output.

## Two modes

**Build a website.** Brief plus domain in, deployed Astro site out: Sanity CMS, Vercel hosting (Cloudflare as backup), GitHub repo, CI/CD, custom domain, full SEO and AI-crawler readiness, forms, search, analytics, the client's brand package, and an optional CRO + Ads module.

**Build a brand package.** Raw brand assets in, published private npm package `@jiffi-projects/{slug}-brand` out: four-format design tokens, unified fonts.css, reference components, examples, brand docs. Usable standalone (feeds Claude Design, v0, Cursor, Figma) or as the brand step of a website build.

## How the modes connect

```
Palate MCP (268 references)  ──informs──>  BUILD SITE
                                                │ calls when needed
                                                ▼
                                            BUILD BRAND ──> brand package ──> BUILD SITE consumes
```

A website build can trigger a brand build in-process (Phase 0, when the client has no brand package yet). The Palate MCP's reference library feeds every build with real design taste.

## Install

Palate is a Claude Code plugin (it bundles the skill, the agents, and the MCP-depth enforcement
hooks). In Claude Code, run these as two separate commands (slash commands run one at a time):
```
/plugin marketplace add jake-jiffi/palate-marketplace
```
```
/plugin install palate-website-builder@palate
```
Then connect the Palate MCP with one command (create a token at https://app.palatemcp.com):
```bash
claude mcp add --transport http palate https://mcp.palatemcp.com/api/mcp --header "Authorization: Bearer plt_live_..."
```
No environment variables: `claude mcp add` stores the token in your Claude Code config, so it works
the same in the terminal, the IDE extensions, and the desktop app. Full steps, updating, and the
legacy/manual path: see `INSTALL.md`.

## Layout

- `SKILL.md` — mode dispatch + the two mode workflows
- `references/` — build operational + detail docs, `brand/` (the brand-package docs), `reference-library/` (library machinery)
- `scripts/` — build scripts, brand scripts (brand- prefixed where they'd collide), all tested bash
- `templates/` — `astro-project/` (the site, build-in-CI workflows), `brand-repo-skeleton/` (the brand package shape), `sanity-schema/`, `github-workflows/`, `cro/` (dormant sub-skills as .tpl)

## Setup required once per machine

`gh`, `node` 22+, `npm`, `jq`, plus env for the modes you use: Vercel CLI (`vercel`), SANITY_AUTH_TOKEN, RESEND_API_KEY (build); GITHUB_PACKAGES_TOKEN in ~/.npmrc (brand). `scripts/preflight.sh` (build) and `scripts/brand-preflight.sh` (brand) check what's needed.

## The Palate MCP

The skill reads the reference library through the Palate MCP (`palate` connector, `refs_*` tools) at `https://mcp.palatemcp.com/api/mcp` (http transport), authenticated with your `plt_live_...` token. You add the connector once with `claude mcp add` (see Install); the token is baked into your Claude Code config, so there is no env var to manage and the tools resolve as `mcp__palate__*` for the skill and the depth gate.
