# Live Supabase schema catalog — evidence for draft PR #3

Extracted **read-only** on 2026-11-17 from Supabase project `soyauzlimhlplgunngxd`. This is **not a full pg_dump, runnable migration, or security test suite**.

- `schema.sql`: catalog-derived, **commented** table/column, constraint, index, trigger definitions for 18 public tables.
- `policies-and-grants.sql`: **commented** expressions for 39 actual RLS policies, role grants and default ACLs.
- `function-definitions.sql`: **commented** complete definitions and metadata of 11 actual SQL functions.
- `storage-and-api-boundaries.md`: observed storage and unverified external media access.
- `catalog.json`: structured catalog evidence (precise column typing, SQL expressions, policy semantics and constraints).

Privacy sanitization: 1 distinct UUID(s) from catalog metadata replaced consistently with synthetic fixture UUID `00000000-0000-4000-8000-000000000999`. No customer rows, passwords, invite email addresses, auth tokens or secret keys included. Synthetic admin IDs **cannot be deployed to production**.

**Remaining gaps:** A full schema-only dump would additionally establish sequence/extension dependencies, exact DDL order, complete Supabase Auth/Storage schemas and settings. This snapshot does not independently establish the remote Stream/YouTube/Cloudflare authorization model. The isolated local test environment must faithfully reproduce relevant relations, roles, auth claims and RPCs. The preflight gate must remain BLOCKED until actual-role RLS/API tests are implemented and run. Do not confuse snapshot presence with database security validation.

Known verified differences from original draft: `provider_entitlements` has UNIQUE(user_id, provider_id); `provider_invites` has no expires_at; the live `accept_provider_invite` function already uses row locking, recipient email matching and replay protection. Security proposals should preserve these existing controls, not reimplement them from assumptions.
