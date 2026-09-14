---
description: Independently review and improve a website against Palate references, with separate critic and builder agents and up to four bounded revision rounds. Internal simulated jury judgement, not a certified grade.
argument-hint: "[project path or preview URL] [focus or testing limits]"
---

Follow [critic-review.md](../references/critic-review.md) in **jury mode**. Use the current conversation and project, honour review-only requests and explicit testing limits, and preserve the chosen design and stack. A preview URL without editable source permits critique only; identify that limitation rather than initialising a new project. Do not adopt, migrate or deploy an existing website for this command.

The main host agent coordinates actual independent critic and separate builder agents, waits for each handover, then obtains independent browser review of the revision. Keep the protocol's early stopping, round allowance, evidence requirements and final verdict. This entry does not invoke `/palate-website-builder:grade` or the legacy verifier's gate list.
