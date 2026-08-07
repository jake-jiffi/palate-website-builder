# The local grade (`grade-local.mjs`) — a free self-check with design in it

There are THREE quality numbers in this product and they are not interchangeable. Using the
wrong one is how a customer ends up quoting a number that does not mean what they think.

| | what it measures | cost | shareable? |
| --- | --- | --- | --- |
| **1. Build hygiene** (`verify-rendered.sh`) | what is measurable on a rendered page: accents, tap targets, mobile body size, axe, vitals | free, seconds, every build | no, and it is not a grade |
| **2. Local grade** (`grade-local.mjs`) | the above **plus design craft**: the SigLIP appearance head and the pairwise ladder against library references | free, a few minutes | **no** |
| **3. Certified grade** (`mcp__palate__palate_grade`) | everything, on our infrastructure, on a live URL | 10 cap units | **yes, this is the only one** |

**You do not need certification to fix your own site. You need it to prove something to someone
else.** A local grade is computed on the customer's machine from inputs they control, so it can
be faked. That does not matter for self-healing, because gaming yourself is pointless. It
matters completely the moment a number is put in a proposal, on a slide, or next to a
competitor's. Never call a local grade certified, never imply it is comparable to anyone else's
score, and never publish it.

## Why a free local grade is possible at all

A certified grade costs roughly **US$1.06**: about $0.95 of Fly machine for ~100 seconds of
Chromium, plus ~$0.11 of vision calls. That price is why the real grader is a done-time check
and can never be an inner-loop one.

Almost none of that cost has to be ours, because the plugin runs where the expensive parts
already exist:

- **capture** — this plugin already drives a real browser at both viewports.
- **the appearance head** — SigLIP runs locally through transformers.js, ~540ms once cached.
- **the judge** — the agent doing the build *is* a vision model.
- **the rubric** — `rubric.mjs`, vendored here and byte-identical to the grader's.

What is left for the server is a row read and a dot product, and both are free:
`palate_grade_pack` (which references to judge against, their do/don't rules, and the judging
prompt) and `palate_taste_score` (projecting the local embedding onto the learned taste head,
which stays on our server because this repo is public).

## Running it

```bash
# 1. measure, embed, fetch the references, and write the judging request
node scripts/reference-capture/grade-local.mjs --url https://your-preview.vercel.app --vertical health

# 2. judge the six comparisons (see below), writing answers to a JSON file

# 3. score
node scripts/reference-capture/grade-local.mjs --judgements judgements.json
```

**First run downloads ~356MB** (the SigLIP vision tower), once. It is announced before it
starts and cached afterwards. Set `PALATE_MODEL_CACHE` to somewhere stable so a dependency bump
does not re-download it.

## Judging: the part only the agent can do

Three references, each judged **twice with the images swapped**, so six comparisons.

**Dispatch each comparison to a fresh subagent.** The two swapped runs must not see each
other's answer. Position bias is the best-documented failure of pairwise visual judging and
swapping is the only control that detects it; an agent judging both orderings in one context is
asking itself to agree with itself, which is not a control. If you genuinely cannot, pass
`--not-independent` and the result is marked low confidence and says why.

Use the `system` field from the request file **verbatim**. It is served by the MCP so that your
judgement and the public grader's are reading the same instructions. It is never invented
locally; if the pack cannot be fetched, the ladder does not run at all.

**Be blunt, and do not soften a verdict because you built the site.** Most real websites are
clearly worse than a library reference and saying so is the job.

## How close is it to the certified grade?

Measured 2026-08-07 on three sites spanning the range, each graded locally and then through the
real grader on the same day.

| site | certified | local | gap | certified design | local design |
| --- | --- | --- | --- | --- | --- |
| palatemcp.com/web-design-mcp | 87 | 91 | +4 | 90 | 87 |
| jiffi.co | 73 | 67 | −6 | 64 | 66 |
| hightownpharmacy.co.uk | 41 | 58 | **+17** | 26 | 52 |

**Overall r = +0.89, mean absolute gap 9.0 points.** For comparison, the hygiene score that
preceded this — the same rubric without the appearance head or the ladder — measured **r =
−0.074 and an 18-point gap** over 23 sites. Adding design is what closed it: dropping the
appearance head from this same run takes r from 0.89 down to 0.76.

**Three caveats, and they matter more than the headline.**

1. **n = 3.** A correlation over three points is a demonstration, not a calibration. The gap is
   the number to trust, and even that is three sites.
2. **The error is concentrated at the bottom, which is the worst place for it.** The template
   pharmacy scored 17 points too kindly, and 26 too kindly on design alone. Separating a
   template from a designed site is the product's whole claim, and a local judge grading a site
   it did not build is still gentler than the grader's. Do not read a middling local score as
   proof a page is fine.
3. **The judgements in this run were not independent** (one context, `--not-independent`),
   which the designed path avoids by dispatching each comparison to a fresh subagent.

**There is no band letter on a local grade, deliberately.** The rubric's bands are 10 points
wide and this runs about 9 points out: web-design-mcp came back 91 locally and 87 certified,
which is "A Exceptional" against "B Strong" on one page. A band is the part a reader quotes, so
the local grade reports the number and its margin and nothing else.

## What it will not do

- **It refuses rather than guessing.** A blank hero, a full-page composite, a mobile still or a
  broken capture is named and dropped. 33 of the 2,194 library heroes never rendered and this
  head scores them at a median percentile of 86.7, so an ungated head reports a blank page as
  top-13% taste.
- **It never scores a missing check as zero.** Anything it could not measure leaves the
  denominator, and `measuredWeight` reports how much of the 100 the number rests on.
- **It does not measure content, technical foundations or AI readiness** — 34 of the 100
  weight. The public grader reads those from the fetched HTML, robots.txt and sitemap. The
  output says so explicitly rather than quietly scoring on 66 weight and presenting it as 100.
  Closing that gap means vendoring the grader's `checks.mjs` the way `design-measure.mjs` was
  vendored, not writing a third implementation of the same checks.

## The arithmetic, and why it is the way it is

Identical to the grader worker's `ladder.mjs`, because a local number computed differently is a
different quantity wearing the same units.

- **Three comparisons, always.** The exemplar pack once carried two per vertical and the ladder
  silently ran on two. Design craft is 40% of the grade and the ladder owns 45 of its 100
  points, so a third less evidence measurably widened the spread: one site moved 40 points
  across three runs without changing.
- **Swapped comparisons that disagree collapse to the lower rung.** An unstable verdict is not
  evidence of quality.
- **Score from the mean, not the median rung.** With three comparisons and rung values
  0.15/0.4/0.7/0.9 the median either does not move or moves a whole rung, which is 3.6 points of
  the final grade decided by two judges landing on the other side of a near-tie.
- **The signature move is a fraction, not a vote.** As a boolean it was a 4.2-point step turning
  on one judge changing its mind, the largest single source of run-to-run movement in the rubric.
- **The taste head is a prior, not a score.** It may move the verdict by one rung and only at
  the extremes (top 15% lifts, bottom 10% pulls). It is a 384px hero-appearance model; it is
  allowed to express doubt and a little confidence, never to be published as a grade.
