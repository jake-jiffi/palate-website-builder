# Existing infrastructure overrides

The skill assumes fresh infra by default but accepts overrides.

- **Existing Cloudflare account**: pass the account id; the skill uses it rather than assuming. Worker name still `{slug}-site`.
- **Existing Sanity org**: default is the single Jiffi org (JIFFI_SANITY_ORG_ID). Override only if a client insists on their own org.
- **Existing GitHub repo**: if `jiffi-projects/{slug}` exists and is empty, use it. If non-empty, it is a conflict (append -web) unless it is a resume.
- **Existing domain on Cloudflare**: attach-domain.sh detects the zone automatically and goes full-auto.

Detection before creation everywhere: check, then create only if absent. This is what makes re-runs safe.
