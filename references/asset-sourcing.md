# Asset sourcing and inference - making it feel real when there is little to work with

A site lives or dies on real content. When a client has a brand package, use it
(`phase-0-brand-detection.md`). When they have little (no website, just a Google
listing and an ordering link, the Big Red Cafe case), the skill goes and finds
the real thing, judges its quality, and fills the gaps honestly. This also feeds
the Story Engine: the pattern of imagery a business uses is evidence of who they
are.

## What to gather (and from where)

- **Logo:** the real mark, wherever it lives, the site, socials, or an ordering
  platform (Bopple, Square, Menulog, Mr Yum). If it is only a raster (PNG/JPEG)
  or baked into a link, recover it and **convert to a clean SVG** (trace or
  redraw) so the build ships a crisp vector, never a blurry bitmap.
- **Photos:** real interior, food, team, work. Google Place photos, socials, the
  existing site. These carry the truth of the place.
- **About / story:** the founder's why and history, from the about page, the
  Google description, socials, press (Broadsheet, local news) and the reviews.
- **Reviews:** the emotional language customers actually use (the Story Engine's
  fuel) and the proof (ratings, counts, named staff).

## The quality bar (reject the bad ones)

Not every real asset is usable. Reject low-resolution, blurry, badly lit or
yellow-cast phone photos, screenshots, watermarked stock, cluttered or off-brand
shots, anything that would cheapen the build. A great placeholder beats a shipped
bad photo. Judge each asset: is it production-ready, yes or no.

## Production-ready vs placeholder (and the pitch)

- If an asset is genuinely good enough, use it.
- If not, use a tasteful placeholder (Unsplash, matched to the inferred vibe and
  palette), clearly as a placeholder, and record it in a **"content we need"**
  list in the handover, so the pitch is honest: "this is the direction, swap in
  your real photos of X, Y and Z and it sings." Never present a placeholder as
  the client's own work.
- Never ship a known-bad real asset just because it is theirs.

## Inference - read the story from the assets

When copy is thin, the pattern of available imagery is evidence. A cafe whose
photos are all warm food close-ups, the beach and groups of friends is telling
you it is about warmth, locality and casual ritual, lead the Story Engine there.
A trades business showing finished jobs and the same two faces is telling you it
is about craftsmanship and trust. Infer the before/after feeling and the one true
thing from what they choose to show, then confirm it.

## How this connects

Asset sourcing runs in Phase 0 alongside brand detection. Its findings (reviews,
story, imagery pattern) feed the Story Engine (`story-engine.md`). The
quality-judged real assets go into the build; the gaps become placeholders plus a
content list in the handover (`handover-format.md`).
