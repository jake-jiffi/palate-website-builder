# Palate Website Builder: install guide

One skill, two modes. It builds production-grade Astro websites grounded by the Palate MCP, and it builds brand packages that feed those builds.

## Install (the Claude Code plugin)

Palate ships as a Claude Code plugin that bundles the skill, the survey/verify agents, the
MCP-depth enforcement hooks, and the Palate MCP connector, so one install wires up everything.

1. In Claude Code, add the marketplace and install the plugin:
   ```
   /plugin marketplace add jake-jiffi/palate-marketplace
   /plugin install palate-website-builder@palate
   ```
2. Get a Palate API token at https://app.palatemcp.com (Tokens -> Create; copy the `plt_live_...`).
3. Set it so the bundled MCP connector can read it, then restart Claude Code:
   ```bash
   echo 'export PALATE_MCP_TOKEN=plt_live_xxx' >> ~/.zshrc && source ~/.zshrc
   ```
4. Confirm: run `/mcp` (the `palate` server shows connected), or ask Claude to call `refs_list_verticals`.

The Palate dashboard hands you both blocks with your real token already filled in, so it is pure
copy-paste. `brew install jq` once (the gate needs it) - see "One-time machine setup" below.

## The two modes

- **Build a website**: "Build a site for {client}, {domain}. Brand assets at {path}."
- **Build a brand package** (standalone): "Build a brand package for {client}, assets at {path}."

A website build calls the brand build in-process when the client has no brand package yet. The Palate MCP's reference library informs every build.

## What the plugin wires up

- The **skill** (`palate-website-builder`): build a site, or a brand package, grounded by the MCP.
- The **MCP connector** (`palate` / `mcp__palate`), giving the `refs_*` tools (refs_for_business,
  refs_search (hybrid: facets + a lexical query string), refs_get (layer:
  concept|pages|tokens|signature_moves|do_dont|component_prompts|astro_recipe; format:"design"
  returns a DESIGN.md), refs_get_tokens, refs_get_astro_recipe, refs_get_screenshot, refs_insights,
  refs_match_brief, refs_similar, refs_list_verticals). Token via `PALATE_MCP_TOKEN`.
- Three **enforcement hooks** (`hooks/hooks.json`) that make a build actually use the library:
  - **PreToolUse** blocks writing source files until you have surveyed the library.
  - **Stop** blocks finishing until the build reached real MCP depth.
  - **PostToolUse** records real tool telemetry to `build-manifest.json` (the gate reads this, so
    depth cannot be faked).
  The gate is a plain script (`scripts/gate-mcp-depth.sh`), so it also runs in CI / pre-commit. Its
  public defaults are gentle (5 refs, 2 inner pages, 1 deep read, 1 rich layer); raise them for
  agency-strict builds (`PALATE_MIN_REFS=8 PALATE_MIN_INNER=3`), or disable with `PALATE_GATE_OFF=1`.

### Updating

```
/plugin marketplace update palate
```
Picks up the new plugin version (or enable per-marketplace auto-update). No re-running an installer.

### Uninstalling

```
/plugin uninstall palate-website-builder@palate
```
Your cross-build memory at `~/.config/palate/builds.log.json` is left in place; remove the
`PALATE_MCP_TOKEN` export from your shell profile to drop the connector too.

### Other MCP clients (Cursor / Windsurf / Claude Desktop)

The plugin path is Claude Code. For other tools, add the MCP connector directly (token-bearing
form, so the dashboard can hand it to you pre-filled):

```json
{
  "mcpServers": {
    "palate": {
      "type": "http",
      "url": "https://mcp.palatemcp.com/api/mcp",
      "headers": { "Authorization": "Bearer YOUR_PALATE_API_TOKEN" }
    }
  }
}
```
Cursor hooks are beta and only `deny` reliably blocks; point Cursor's PreToolUse hook at
`scripts/gate-mcp-depth.sh` with a `deny` decision (the portable gate is identical, only the wrapper differs).

## Legacy / manual install (deprecated)

Before the plugin, Palate installed as a standalone skill plus an installer script. This still works
but is deprecated; prefer the plugin above. Do NOT run both, the hooks would double-fire; if you have
the legacy install, remove it first with `./scripts/install.sh --uninstall`.

```bash
npx skills add -y https://github.com/jake-jiffi/palate-website-builder   # third-party installer (not first-party Claude Code)
# or: cp -r palate-website-builder ~/.claude/skills/
PALATE_TOKEN=plt_live_xxx ./scripts/install.sh   # adds the connector + jq + the hooks into ~/.claude/settings.json
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
