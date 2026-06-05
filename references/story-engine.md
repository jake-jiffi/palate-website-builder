# The Story Engine - concept before composition

Before Explore generates a single variant, decide WHAT each one is FOR. The Story
Engine is the research-led method that turns a business into **demonstrative
concepts**: ideas that make a visitor FEEL the product's value rather than read
about it. It is how Jiffi sites stop being refined-but-generic. The craft layer
(`reference-library-usage.md`) decides HOW a site looks and moves; the Story
Engine decides WHAT idea it argues and WHAT it makes you feel.

Run it after brand/asset detection (Phase 0), before variant generation. It is
**research-led, not interview-led**: go and find the truth, then confirm it once.
Do not interrogate the client for the concept, that is your job.

## The five stages

1. **Research the real business, never the category.** The category is where
   generic lives ("trusted family lawyers", "your local cafe"). Pull the
   specifics: the founder's why, the years, the real point of difference, the
   suburb, and above all the emotional language the customers use, from Google
   reviews, testimonials, socials. See `asset-sourcing.md` for how to gather this
   (and the imagery) when the client has little online.
2. **Find the customer at the moment of need.** Not "a buyer" but a specific
   person at a specific moment feeling a specific thing (the first-home buyer at
   8pm with a 40-page contract; the founder doomscrolling at 6:50am).
3. **Name the before-feeling and the after-feeling.** The site's real job is the
   gap between them.
4. **Find the one true thing:** the single most emotionally potent fact nobody
   else can claim, usually hiding in the reviews or the founder's story (the
   conveyancer whose clients name Vicki by hand across 225 reviews).
5. **State the transformation (the spine):** "[ICP] arrives feeling [before] and
   should leave feeling [after], because [the real mechanism]."

The one human checkpoint is a **confirmation, not a quiz**: "Here is what I
believe your customer feels, and the one true thing about you. Did I get it
right?" Then surprise them.

## From truth to concepts (one per variant)

Each Explore variant carries a demonstrative concept: a **mechanic** where the
visitor does or witnesses something that enacts the transformation, a **3-beat
arc** (tension, turn, payoff), and **one named feeling** that governs every craft
choice. Spread the set across the ambition spectrum:

- **safe-warm** - clear, human, low-risk, but still a real idea (not a brochure).
- **bold** - one strong demonstrative move.
- **one-of-a-kind** - a genuinely surprising mechanic (the Sift: type your topic,
  the firehose floods, all but twelve evaporate). Always include at least one.

The ambition scales to the business: a particle firehose suits a SaaS launch; a
conveyancer's one-of-a-kind is emotionally huge but visually quiet
(`intensity: whisper|calm`). A concept that only describes the value in nice type
is rejected. Show, do not tell.

## Grounding concepts in the MCP (the concept layer is first-class)

The `website-references` MCP now indexes feeling and mechanic, not just craft. Use
it to assemble concepts:

- `refs_insights { topic: "mechanics" }` - the catalogue of demonstrative devices
  (flood-then-resolve, tap-to-decode, absence-as-argument, carried-timeline,
  crowd-as-proof, scroll-as-time, press-and-nothing-happens, ...) with the
  references that execute each best. Pick the mechanic that enacts your
  transformation, then study its exemplars.
- `refs_insights { topic: "emotion" }` - registers (calm, relief, awe, belonging,
  trust, warmth, ...) with exemplars. Find references that already produce your
  target feeling.
- `refs_search { register, device, intensity, demonstrative }` - pull references
  by feeling and mechanic (`register: relief, intensity: whisper` for the
  conveyancer; `device: flood-then-resolve` for a Sift).
- `refs_for_business` - returns the spine with its signatureMoves,
  emotionalRegister and storyDevices.

Then the craft layer executes the chosen mechanic faithfully, re-skinned (the
organ-transplant method in `reference-library-usage.md`).

## The feel gate

Before emit, every concept passes: would the actual ICP feel SEEN ("that's me,
that's exactly it")? Is the interaction the argument? Is there tension and a
payoff? If it is competent but they would feel nothing, it fails, however clean
the craft. See `critique-discipline.md` (habit 6) and `creative-principles.md`.
