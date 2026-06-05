# CMS and draft preview - the architecture every build uses

Read this before any build. It defines the SSR + Sanity + visual-editing setup
baked into `templates/astro-project/`. It uses the **official `@sanity/astro`
integration** - the supported, lowest-battle path.

## The shape

- **Astro in SSR mode** (`output: "server"`) on the **Cloudflare adapter** by
  default, deployed as a Workers script - or on the Vercel adapter when
  `--host vercel` is picked (see `references/hosting-vercel.md`). SSR is
  required for the embedded Studio and for serving draft content; everything
  in this doc applies identically on either host. The Vercel Toolbar's
  Comments feature complements Sanity's Presentation tool on preview
  deployments - reviewer notes on the page, plus Sanity click-to-edit.
- **`@sanity/astro`** is the integration. It provides the data client (the
  `sanity:client` virtual module), the embedded Studio, and stega encoding for
  visual editing. `@astrojs/react` is added alongside it (the Studio is React).
- **The Studio is embedded at `/studio`** (`studioBasePath: "/studio"`). It
  ships with the site - one deploy, one domain, same origin. `sanity.config.ts`
  lives at the project root.
- **A fallback-content layer** so the preview stage needs no Sanity project.

## The fallback-content layer

`src/lib/content.ts` exports a typed object with the real copy for every page.
`src/lib/load.ts` exports `loadPage(query, params, fallback)`:

1. If `SANITY_PROJECT_ID` is empty (the preview stage) - return `fallback`.
2. Else query Sanity via `sanity:client` (drafts perspective + stega when
   visual editing is on, published otherwise).
3. If the query throws or returns empty - return `fallback`.

Every page calls `loadPage`. The preview stage renders 100% on `content.ts`
with no Sanity account; production seeds Sanity from the same file, and the
fallback stays as a CMS-outage safety net. `src/pages/index.astro` is the
canonical example - copy its pattern. Keep `content.ts` shapes and the
`src/sanity/schema/` field names in lockstep.

During the preview stage the integration still loads - `projectId` falls back
to a harmless placeholder (`"preview"`) in `astro.config.mjs` so the build
succeeds; the fetches simply fail and `loadPage` returns the fallback.

## Visual editing - how draft preview works

`@sanity/astro`'s model is **env-var gated**, not per-request:

- A single build-time variable, `PUBLIC_SANITY_VISUAL_EDITING_ENABLED`,
  decides the mode. `"true"` -> `loadPage` uses the `drafts` perspective with
  stega encoding, and `BaseLayout` mounts `<VisualEditing enabled />` (from
  `@sanity/astro/visual-editing`). `"false"` (production) -> published content,
  edge-cached, no overlay.
- So there are **two deployments of the same repo**:
  - **production** - `PUBLIC_SANITY_VISUAL_EDITING_ENABLED=false`. The real site.
  - **preview** - `PUBLIC_SANITY_VISUAL_EDITING_ENABLED=true`. Draft content,
    click-to-edit overlays. Sanity's Presentation tool loads this one.
- For a developer, `astro dev` with the flag set `true` in `.env` shows
  overlays locally. For a non-technical client, the deployed preview is what
  they use.

`SANITY_API_READ_TOKEN` is required whenever the flag is on (draft content
needs auth).

## The embedded Studio

`astro.config.mjs` sets `studioBasePath: "/studio"`, so the full Studio is a
route on the site: `{site}/studio`. `sanity.config.ts` at the project root
configures it - schema from `src/sanity/schema/`, plus `structureTool`,
`presentationTool` and `visionTool`. The Presentation tool's `previewUrl` is
`{ origin: "same-origin", preview: "/" }` - it previews the very site the
Studio is embedded in. Same origin means no cross-site cookie problems.

The client edits at `{preview-site}/studio`; that deployment has visual editing
on, so Presentation shows live overlays.

## Build-time vs runtime environment (a Cloudflare gotcha)

`@sanity/astro` resolves its config **at build time** - so these must be set in
the **CI build environment** (and in local `.env`):

- `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_API_READ_TOKEN`,
  `PUBLIC_SANITY_VISUAL_EDITING_ENABLED`

These are **runtime Worker secrets** (`wrangler secret put`), read per request
via `locals.runtime.env` - they are NOT needed at build:

- `SANITY_API_WRITE_TOKEN` (the `/api/contact` handler), `RESEND_API_KEY`,
  `TURNSTILE_SECRET`

Getting this split wrong is the most likely source of a confusing failure.

## Versions (pinned, known-good - update deliberately, together)

The field build broke on `@astrojs/cloudflare@12` (it targets Astro 5); Astro 6
needs the 13.x line. Move these as a matched set:

- `astro` ^6.3   ·   `@astrojs/cloudflare` ^13.5   ·   `@astrojs/sitemap` ^3.7
- `@astrojs/react` ^5.0   ·   `react` / `react-dom` ^19
- `@sanity/astro` ^3.4   ·   `@sanity/client` ^7   ·   `sanity` ^5   ·
  `@sanity/vision` ^5   ·   `@sanity/image-url` ^1
- `@portabletext/to-html` ^5 (rich text)
- `astro-pagefind` ^2 + `pagefind` ^1.5 (search)
- `tailwindcss` ^4 + `@tailwindcss/vite` ^4   ·   `wrangler` ^4   ·   `tsx` ^4

## CMS-driven collections (blogs, job boards)

A blog or a job board is one pattern: the `collectionItem` type
(`src/sanity/schema/collection.ts`) + an index page + a `[slug].astro` detail
page (`src/pages/blog/`). Adding "a blog" or "open roles" is renaming this
pattern (e.g. `jobListing` + `/jobs`), not inventing one.

## SSR gotchas (pre-solved in the template)

- **No-op session driver.** If the deploy asks for a KV namespace for Astro
  sessions, the site does not use sessions - add a no-op session config rather
  than provisioning KV.
- **`wrangler.toml`**: do not set `main` - the Cloudflare adapter injects the
  worker entry. Just `[assets] directory = "./dist"` + `nodejs_compat`.
- **`devToolbar: { enabled: false }`** so the toolbar never appears in
  screenshots or the client preview.

## Helper scripts (shipped, run via tsx)

- `scripts/seed-content.mjs` - seeds the dataset from `content.ts`.
- `scripts/seed-collection.mjs` - seeds one example collection item.
- `scripts/publish-all.mjs` - publishes every pending draft in one command.

They use `@sanity/client` directly with the write token and read `SANITY_*`
from `.env`.
