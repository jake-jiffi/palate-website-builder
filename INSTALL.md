# Palate Website Builder: install guide

One skill, two modes. It builds production-grade Astro websites grounded by the Palate MCP, and it builds brand packages that feed those builds.

## Install

```bash
npx skills add -y https://github.com/jake-jiffi/palate-website-builder
```

Or upload `palate-website-builder.zip` via the "Upload skill" dialog, or drop the folder into your skills directory:
```
cp -r palate-website-builder ~/.claude/skills/
```
The zip has SKILL.md at the archive root and exactly one SKILL.md, so the uploader accepts it. (The four CRO sub-skill templates ship as .tpl and are renamed to SKILL.md only when the CRO module is installed into a project.)

## The two modes

- **Build a website**: "Build a site for {client}, {domain}. Brand assets at {path}."
- **Build a brand package** (standalone): "Build a brand package for {client}, assets at {path}."

A website build calls the brand build in-process when the client has no brand package yet. The Palate MCP's reference library informs every build.

## Connector + enforcement (one command)

After dropping in the skill, run the installer once. It adds the `palate` MCP
connector, installs `jq`, and registers the gate hooks into your
`~/.claude/settings.json` (backed up first, with every change printed):

```bash
PALATE_TOKEN=plt_live_xxx ./scripts/install.sh
```

That wires three hooks that make a build actually use the library:

- **PreToolUse** blocks writing source files until you have surveyed the library.
- **Stop** blocks finishing until the build reached real MCP depth.
- **PostToolUse** records real tool telemetry to `build-manifest.json` (the gate
  reads this, so depth cannot be faked).

The gate itself is a plain script (`scripts/gate-mcp-depth.sh`), so it also runs
in CI or a pre-commit hook independently of Claude Code. Temporarily disable the
gate with `PALATE_GATE_OFF=1`.

The skill's `allowed-tools` includes `mcp__palate`, giving it the `refs_*` tools
(refs_for_business, refs_search, refs_get, refs_get_tokens, refs_get_astro_recipe,
refs_get_screenshot, refs_insights, refs_match_brief, refs_similar,
refs_list_verticals).

### Updating

Pull the latest skill and re-run the installer. It is idempotent and refreshes the
hook paths, so re-running is the update path:

```bash
git -C <skill-dir> pull            # or: npx skills add -y https://github.com/jake-jiffi/palate-website-builder
./scripts/install.sh
```

Your installed version is recorded at `~/.config/palate/skill-version`; the skill
ships its version in `VERSION`.

### Uninstalling

```bash
./scripts/install.sh --uninstall
```

Removes the hooks and the connector (your cross-build memory at
`~/.config/palate/builds.log.json` is left in place).

### Cursor

Cursor hooks are beta and only `deny` reliably blocks. Point Cursor's PreToolUse
hook at the same script (`scripts/gate-mcp-depth.sh`) and use a `deny` decision;
the portable gate is identical, only the wrapper differs.

### Manual connector (fallback)

If you do not use the `claude` CLI, add the connector to your config yourself:

```json
{
  "mcpServers": {
    "palate": {
      "type": "url",
      "url": "https://mcp.palatemcp.com/sse",
      "headers": { "Authorization": "Bearer YOUR_PALATE_API_TOKEN" }
    }
  }
}
```

## One-time machine setup

```bash
brew install gh jq
npm i -g vercel
gh auth login

# Brand mode: GitHub Packages
export GITHUB_PACKAGES_TOKEN=ghp_...   # classic PAT: write:packages + read:packages
cat >> ~/.npmrc <<NPMRC
@jiffi-projects:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=\${GITHUB_PACKAGES_TOKEN}
NPMRC

# Build mode: Vercel + Sanity + email
# Vercel CLI: `vercel login` handles auth
export SANITY_AUTH_TOKEN=...
export RESEND_API_KEY=...
```
`scripts/preflight.sh` (build) and `scripts/brand-preflight.sh` (brand) check what each mode needs.

## Build sequence

1. Install the skill and set up the `palate` MCP connector.
2. Brand mode pilot on your own brand.
3. Full build pilot on a test site. The gate: does the private brand package install in CI and deploy to Vercel? If yes, package path validated; if no, use --vendor-brand.
4. First real client.
