# Testing and verification

## Per-phase verify scripts
Each phase has a verify-{phase}.sh that must pass before the phase is marked complete. See pipeline.md.

## Build-time checks (in CI)
- astro check (typecheck)
- npm run build (must succeed; a logic error here halts, never deploys broken)
- Lighthouse CI (baseline 100s for performance/SEO/best-practices/accessibility)

## Post-deploy smoke checks
- workers.dev returns 200
- robots.txt, sitemap, llms.txt return 200
- a test POST to /api/contact writes to Sanity formSubmission and returns ok

## The form round-trip test
The most important post-deploy check: submit the contact form with a test payload, confirm it (a) passes Turnstile, (b) writes to Sanity using the write token, (c) sends via Resend. If the write token is wrong, this 401s, which is exactly the failure the two-token heal prevents.
