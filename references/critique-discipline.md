# Critique discipline - the six pre-emit habits

Six cheap, high-yield rules Claude follows when generating any user-facing
page. None of them require a script; the discipline is in the doc and is
enforced at the plan-checkpoint pauses and in the reviewer pass
(`audit-dimensions.md`). Together they are the difference between a sharp
page and a default-shaped one.

## 1. Design Read - one sentence before any code

Before generating a variant (Phase A.2) or composing the canonical page
(Phase A.3), state the read out loud, in this exact shape:

> Reading this as: a {page kind} for {audience}, with a {vibe} language,
> leaning toward {design direction}.

Concrete example, not invented:

> Reading this as: an open-roles index for senior tech operators, with a
> direct, low-decoration language, leaning toward an editorial wide-rule
> layout with monospace metadata.

Generic Design Reads ("a modern marketing site for users with a clean look")
do not count and the variant is rejected. The point is to commit to a
thesis BEFORE writing layout code, not to retrofit one afterwards.

Source: adapted from the `taste-skill` `SKILL.md` Section 0.B.

## 2. The 6-axis pre-emit critique

At Compose time, before the canonical pages are written, score the proposed
home-page composition on six axes, 1 to 5 each. Anything **below 3** on any
axis forces a revision pass before emit.

| Axis | What 5 looks like |
|------|-------------------|
| Philosophy | The page has a clear, defensible thesis about what it values (speed, depth, irreverence, restraint) and every choice supports it. |
| Hierarchy | The visual / reading order makes the most important thing land first; the second-most second; nothing competes. |
| Execution | Spacing, type pairing, alignment, transitions are deliberate. No "close enough" defaults. |
| Specificity | Copy and imagery name the actual product / user / situation. No generic stock phrases or stock images. |
| Restraint | Everything earns its place; nothing is decorative-by-default. The page would be worse if you added more. |
| Variety | The composition reproduces a named, located signature move from the lead reference (re-skinned), and does not fall back to the standard hero+three-cards+CTA shape unless that shape is itself the deliberate, reproduced move. |

Document the scores in the build transcript or in `handover.md`; not for the
client, for the next reviewer.

Source: adapted from the Hallmark `references/slop-test.md` rubric.

### 2b. The visual rubric gate (judge the RENDER, then loop)

The 6-axis critique is not only a thought experiment over the proposed composition,
it is a hard gate applied to the **rendered page**, because a build looks different
than it reads in code. After Compose (and for each Explore variant before it is
shown), RENDER and SCREENSHOT the page, then score the screenshot on the six axes:

1. Take a real screenshot of the built page, desktop **and** mobile (the preview
   deploy, `scripts/serve-preview.sh`, or a headless shot of the route). View the
   pixels, do not score from the code or from memory.
2. Score all six axes 1 to 5 against what you SEE. Apply the perceptual floors
   (`references/brand/perceptual-floors.md`) at the same time: body-on-dark contrast,
   44px tap targets, the type scale, the motion floor.
3. **Gate (the standard we hold to): every axis must be >=4, no axis below 3, no
   floor violation, and no unresolved placeholder imagery.** Any axis at 3 or below,
   any floor violation, or a section that still reads as a wireframe -> it has NOT
   passed. Name the specific failing section, revise it, re-render, and re-score.
   **Loop until it passes; a build is not done until its render clears the rubric.**
4. The most common real failures the render exposes (fix, do not excuse): placeholder
   or empty imagery on a launch-bar site, a hero that plays safer than the body, dead
   space where a section trails off, a section that reads as assembled (a generic
   card grid) next to designed ones, and motion that is claimed but invisible.

This is the same rubric as 2.; the difference is it judges the artefact a client
will actually see, and it repeats until the artefact is genuinely good.

## 3. The Conceptual Grounding Test

Every section, every component, every image must finish the sentence:

> This exists because {a specific product or user reason}.

If the sentence does not finish without filler ("...because it looks nice",
"...because heroes have features"), the element is decorative-by-default and
gets deleted. Apply at Compose and again in the reviewer pass.

Source: anti-slop-ui `SKILL.md` Step 1.

## 4. The vague-word ban (on Claude's own narration)

In Claude's own messages about a Jiffi build - the plan checkpoint
descriptions, the variant write-ups, the compose summary, the handover note -
never use these words as descriptors of the design:

- `clean`, `nice`, `modern`, `sleek`, `beautiful`, `stunning`, `minimal`,
  `bold`, `elegant`, `polished`, `striking`.

Replace each with a specific observation:

- not "a clean hero" -> "a 96px display headline at -0.03em tracking, single
  line, left-aligned, with 32px of breathing room beneath."
- not "a modern feel" -> "a 1.5 type scale with 1.6 line-height, neutral
  borders at 1px, no rounded corners except inputs."
- not "a bold CTA" -> "a filled button using the brand accent at 100%
  saturation, sitting at the optical centre of the hero."

The ban applies to Claude's narration, not to the client's brief or to the
brand's voice document. Naming things specifically is the discipline.

The specific numbers that replace a banned word must come from a real token, not
be invented to sound precise: read them off the brand package or off the donor's
`refs_get { slug, layer:"tokens" }` (or `refs_get { slug, format:"design" }`)
output. A specific-sounding claim ("96px display at -0.03em") that does not trace
back to a token in the brand package or the donor's design tokens is itself a
finding - precise-but-fabricated is worse than vague.

Source: taste-skills (Dragoon0x) `skills/perception/visual-audit/SKILL.md`.

## 5. The anti-default detector - reject the Claude-default shape

Before emit, check the composition against the list of Claude-default tells. The
default-shaped page is what the model produces WITHOUT the references; it is the
regression-to-the-mean this skill exists to beat. If the composition matches the
default shape AND reproduces no named signature move from the lead reference,
reject it and redo.

The default tells (a cluster of these is the smell):

- A centred hero: headline + subhead + one button, stacked and centred.
- Three feature cards in a symmetric row directly under the hero.
- A system-ish sans throughout (the browser default stack, or Inter at one
  weight) with no display / body distinction at scale or family.
- A standard sticky top nav: wordmark left, four to five links centre / right,
  a pill CTA.
- A fully symmetric grid - everything centred, nothing full-bleed, no asymmetry,
  no pinned stage, no repeated-identical-section rhythm.
- Tailwind default spacing and the default blue / slate palette doing the work
  instead of the brand.
- NO named, located signature move reproduced from the lead reference.

The positive test that clears it: name the signature move this page reproduces
from the lead reference, and point to where it lives ("the donor's full-bleed
pinned hero stage, reproduced at `index.astro` lines 12-40, re-skinned to the
brand"). Derive the candidate move from `refs_get { slug, layer:"signature_moves" }`
on the lead donor and quote the move's name verbatim, do not paraphrase it into a
generic label. Hybrid search lets you confirm a move actually exists before you
claim it: search its lexical term (e.g. `refs_search { query:"split-flap" }`) and
trust the exact-term match. If you cannot name and locate one, the page is
default-shaped - redo it with the lead reference's craft reproduced faithfully (see
`references/reference-library-usage.md`, the two-layer doctrine).

Source: the palate two-layer doctrine (reproduce the craft, protect
the identity).

## 6. The feel gate - would the ICP feel seen

The anti-default detector (habit 5) kills generic CRAFT. This kills generic
CONCEPT. Before emit, every page (and every Explore concept) answers:

- Would the actual ICP, at their moment of need, feel SEEN - "that's me, that's
  exactly it"?
- Is the interaction the ARGUMENT (the visitor does or witnesses the value), or
  does the page only describe it in nice type?
- Is there a transformation with tension and a payoff, not just pleasant sections?
- Could this be pasted onto a competitor? If yes it is generic; find the one true
  thing and rebuild on it.

A page that is competent, clean and correct but makes the visitor feel nothing
fails this gate. This is the gate that catches "refined but underwhelming". See
`story-engine.md` and `creative-principles.md`.

Source: the Jiffi Story Engine.

---

## Where these apply

- Before Phase A.2 (Explore): every variant generation begins with a Design
  Read; the variant is rejected if the Design Read is missing or generic.
- Before Phase A.3 (Compose): the 6-axis critique is scored on the proposed
  composition; revise before emit if any axis is below 3.
- Before Phase A.3 (Compose) emit: the anti-default detector runs on the
  composition; if it is default-shaped with no reproduced signature move, redo.
- Before Phase A.2 (Explore) and A.3 (Compose): the feel gate, on every concept
  and on the composed page; if the visitor would feel nothing, redo.
- At Phase A.3 (Compose) and Phase A.4 (Finalise reviewer pass): the
  Conceptual Grounding Test on every section.
- Whenever Claude narrates the build: the vague-word ban.

The combination is the difference between a deliberate page and a defaulted one.
