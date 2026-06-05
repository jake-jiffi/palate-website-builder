# Jiffi Website Builder: install guide

One skill. It builds websites, builds brand packages, and curates its own reference library. One thing to install, one thing to grow.

## Install

Upload `jiffi-website-builder.zip` via the "Upload skill" dialog, or drop the folder into your skills directory:
```
cp -r jiffi-website-builder ~/.claude/skills/
```
The zip has SKILL.md at the archive root and exactly one SKILL.md, so the uploader accepts it. (The four CRO sub-skill templates ship as .tpl and are renamed to SKILL.md only when the CRO module is installed into a project.)

## The three modes

- **Build a website**: "Build a site for {client}, {domain}. Brand assets at {path}."
- **Build a brand package** (standalone): "Build a brand package for {client}, assets at {path}."
- **Curate / self-improve**: "Add {site} to your reference library." or "Study {url} and learn from it."

A website build calls the brand build in-process when the client has no brand package yet. The reference library, grown by curate mode, informs every build.

## One-time machine setup

```bash
brew install gh jq
npm i -g wrangler
gh auth login

# Brand mode: GitHub Packages
export GITHUB_PACKAGES_TOKEN=ghp_...   # classic PAT: write:packages + read:packages
cat >> ~/.npmrc <<NPMRC
@jiffi-projects:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=\${GITHUB_PACKAGES_TOKEN}
NPMRC

# Build mode: Cloudflare + Sanity + email
export CLOUDFLARE_API_TOKEN=...
export CLOUDFLARE_ACCOUNT_ID=...
export SANITY_AUTH_TOKEN=...
export JIFFI_SANITY_ORG_ID=...
export RESEND_API_KEY=...
```
`scripts/preflight.sh` (build) and `scripts/brand-preflight.sh` (brand) check what each mode needs.

## The reference library

Baked into the skill at `references/reference-library/`. No repo, no clone, no network. Ships with 5 sites (Linear, Stripe, Anthropic, Plain, Aesop). Grow it: "add {site} to your reference library". Every site you add makes future builds better.

## Build sequence

1. Upload the skill.
2. Brand mode pilot on Jiffi's own brand.
3. Full build pilot on jiffi.com.au. The gate: does the private brand package install in CI and deploy to Cloudflare Workers? If yes, package path validated; if no, use --vendor-brand.
4. Grow the library toward the 10 planned sites as time allows.
5. First real client.
