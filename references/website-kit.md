# The website kit

Sixteen pieces, forty-five variations, and the six foundations under them. Read this when
composing any page, and read `src/lib/kit.ts` in the project for the inventory: every variation
states when to use it, what content it needs, and where on a page it belongs.

## What it is for

A build should not invent a testimonial block from scratch on every project. The structural
questions (what states does a form have, how does a nav behave on a phone, what happens when a
list is empty) have the same answers every time, and getting them wrong is how a site ships with
an invisible submit button or a grid that breaks on the fourth item. The kit answers those once.

## THE RULE THAT LETS IT EXIST

**A piece owns the STRUCTURE and the STATES. The brand owns the SURFACE.**

Our own doctrine says sharing MARKUP homogenises output and reusing the level of DECISION does
not. A forty-five piece section library is a shared markup library, which is the thing this
product argues against, and Bootstrap homogenises the web because everybody ships its default
skin.

So no kit component may contain a literal colour, font family, font size, radius, shadow or
spacing value. Every visual decision reads a `--kit-*` token from `src/styles/foundations.css`.
`gate-kit-tokens.mjs` fails the build on one, and it resolves local aliases, so laundering a
literal through a component-level custom property does not work either.

**What this means in practice: the kit is where you START a section, not where you finish it.**
The donor assigned to the rung governs how the piece is skinned, and skinning happens in the
brand tokens, never in the component. If two sites you have built with the same piece read as the
same site, the tokens were not doing any work and the build is not finished.

## Choosing a variation

Read the manifest entry, not the name. Each variation says when to reach for IT rather than its
siblings, and the answer usually turns on what the client actually has:

- `HeroServicePhoto` needs a photograph 1600px or wider. Three usable images out of three hundred
  means the answer is a different hero, not an upscaled one.
- `PricingCards` needs public prices. `PricingQuote` is the honest variation for most trades, and
  it is a real section rather than an apology.
- `TestimonialGrid` needs several real quotes. If there are two, use `TestimonialSingle`.
- `CompareAlternatives` needs attributes you can defend in front of the competitor named.

A variation whose content the client cannot supply is the wrong variation. Do not fill the gap
with invented content: that is the failure mode this whole build exists to stop.

## Testimonials are somebody else's words

Every testimonial component's header comment says this and it is repeated here because it is the
most expensive mistake available. Quotes are transcribed verbatim or cut. Never attach a real
name to words the person did not say. Never add a role, a company or a location to a quote that
does not carry one. A build has already shipped five invented testimonials signed with real
customers' names, and no gate caught it, because a fabricated fact used once is internally
consistent.

## What "finished" means for a piece

Six criteria, and they are checkable rather than aspirational:

1. Renders correctly at 390, 768 and 1440 with no horizontal overflow and no clipped text.
2. Meets 4.5:1 on body text against its own ground, is keyboard operable, and shows a visible
   focus ring on every interactive element.
3. Renders correctly with the shortest and the longest realistic content.
4. Implements every state it can be in: hover, focus, open, loading, success, error, empty.
5. Its manifest entry says when to use it, what content it needs, and where it belongs.
6. Adds no runtime dependency, and the whole kit's JavaScript stays under 10 KB gzipped.

`gate-kit-complete.mjs` enforces 4 and 5 statically and follows delegation, so a nav that gets
its open state from the mobile sheet it renders is not asked to duplicate it.

## The example pages

`/kit/product`, `/kit/service` and `/kit/campaign` compose real pieces with real content and
prove they sit together. `/kit` itself indexes every piece and variation with its guidance.

All of it is `noindex` and `gate-shipready` removes it at handover, exactly as it removes the
Explore surfaces. It is a working document, not a page of the client's site.

## Rhythm

Consecutive sections must not share a ground. Alternate `kit-section--subtle`, the default, and
`kit-section--inverse` deliberately: two adjacent sections on the same ground read as one long
section, which is the commonest way a composed page turns into a wall.
