# Eval 06 - the four critique habits are visibly applied

### Brief (verbatim)

> Build a preview of a website for Tarn Architecture, a Hobart studio that
> does heritage restoration and contemporary additions. Strong, considered,
> not loud.

### Expected behaviour

A standard Explore-first preview build. The eval is whether the four
critique-discipline habits show up in the transcript and the artefacts.

### Checklist

- [ ] Every generated variant (v1..vN) has a stated **Design Read** in the
      build transcript or as a comment in the variant `.astro` file's
      frontmatter, in the exact form: "Reading this as: a {page kind} for
      {audience}, with a {vibe} language, leaning toward {design direction}."
      A generic Design Read ("a modern marketing site for users") fails.
- [ ] At Phase A.3 (Compose), the transcript shows a **6-axis pre-emit
      critique** scoring Philosophy / Hierarchy / Execution / Specificity /
      Restraint / Variety, 1 to 5 each. Any axis below 3 must have triggered
      a revision pass before emit.
- [ ] At Compose, the transcript shows the **Conceptual Grounding Test**
      applied to every section, with one sentence per section completing
      "This exists because {a specific reason}." A section that cannot pass
      the test is removed.
- [ ] In Claude's own narration of the build (the variant write-ups, the
      Compose summary, the handover note), **none of these words appear** as
      descriptors of the design: `clean`, `nice`, `modern`, `sleek`,
      `beautiful`, `stunning`, `minimal`, `bold`, `elegant`, `polished`,
      `striking`. Where one appears in a client brief or brand voice doc it
      may be quoted; Claude's own assessment must use specific observations.
- [ ] `scripts/ux-lint.sh` passes on the final preview.

### Regression signals

A generic Design Read, a missing critique score, a section that fails the
grounding test still shipping, or any vague-word descriptor in Claude's own
narration. Any of these indicates the discipline has drifted to ceremony.
