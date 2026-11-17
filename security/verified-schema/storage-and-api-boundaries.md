# Storage and external media boundaries — 2026-11-17

**Read-only catalog evidence, not production security certification.** Project `soyauzlimhlplgunngxd`.

- Supabase Storage buckets returned: **0**; separately queried storage objects returned **0**.
- Public tables: **18**, all RLS-enabled. Public views: **0**, verified in previous inspection.
- Public SQL functions: **11**. SQL function bodies and grants included in the package.
- External YouTube/Cloudflare Stream video delivery and media URL permissions **not verified** by the database catalog.
- Project dashboard exposed-schema configuration, auth email-confirmation configuration, signed Stream tokens, CDN origin ACLs **not verified**.
- Existing media table contains `external_url`, `storage_path`, `preview_allowed`, and `offline_allowed`. Row-level authorization does not automatically protect copied external URLs or offline media.
- The hardcoded administrator user UUID in relevant policies has been replaced with consistent synthetic `00000000-0000-4000-8000-000000000999`. Do not deploy anonymized policy values.
- No customer records, credentials, or media URLs were queried for this export.
