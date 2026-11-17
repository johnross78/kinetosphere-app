# Required isolated-database verification

No faithful database test can run from this repository yet. The schema, policies,
RPC implementations and delivery controls are absent. This is a required validation
plan, not a test report. The current readiness command fails with exit 2 on purpose.
Never interpret the 58 passing Node tests as proof of database authorization.

## 1. Obtain evidence without using live access from this assignment

Have the project owner provide schema-only exports from their existing approved
audit process. Do not run these against the live project as part of this PR.

- `security/verified-schema/schema.sql`: exact table, enum/domain, constraint,
  index, FK, view, trigger and sequence DDL for all affected relations/dependencies.
- `policies-and-grants.sql`: all policy definitions (including ALL policies), role
  ACLs, schema/table/sequence grants, default privileges and exposed-schema list.
- `function-definitions.sql`: every affected function overload, body, owner,
  SECURITY DEFINER flag, configuration/search_path, EXECUTE ACL and dependencies.
- `storage-and-api-boundaries.md`: reviewed nonsecret description of storage bucket
  privacy, origin access, signed URL/token settings, exposed views/schemas, accepted
  auth identities, and Edge Function permission boundaries.

Use schema-only `pg_dump --schema-only` with relevant schemas/dependencies and the
catalog queries in inventory.sql within the owner's approved process. No auth.users
rows, actual invitations/entitlements, media URLs, JWTs, service keys, dumps of user
data, or function-embedded credentials should be committed. Inspect/redact exports
before sharing. Do not invent redacted function bodies; mark them unavailable.

Review enum values, null/date types, duplicate entitlement rules, provider statuses,
preview asset mapping and current helper dependency graph. Get product approval for
the date/cancellation and seven-day-invitation rules in ../README.md. Until then the
SQL proposals stay blocked and outside automatic migration discovery.

## 2. Build a faithful local harness in a follow-up reviewed change

1. Pin the local Supabase/Postgres versions to the verified hosted engine; use a
   disposable local Supabase stack with auth.uid/auth.jwt and real anon/authenticated
   roles. If using plain Postgres, explicitly list any auth stand-ins and resulting
   limits. An invented auth implementation is not full Supabase verification.
2. Load reviewed DDL/policies/functions without production data. Create synthetic
   users A/B, owner/editor/admin/analyst, platform admin, two independent providers,
   a private provider, a suspended provider, preview+paid+offline assets, and private
   circuits for both users. Create fixtures through the actual schema constraints.
3. Save fixture identities/resource IDs in a local manifest; no real records or
   credentials. Never use service_role to make the access assertions.
4. Prove the OLD policies reproduce the supplied broad-preview and expired-status
   failures before applying corrections. If not reproduced, stop and resolve drift.
5. Replace the draft placeholders with reviewed signatures/types/predicates, include
   verified accept/create/resend RPC replacements, establish grants and policies,
   and generate the final migrations with the installed CLI's documented workflow.
6. Apply ONLY to this disposable stack. Run actual-role tests below. Use clean
   connections per identity, transactions, ON_ERROR_STOP, nonzero exits for any
   unexpected result. Check current_user and rolbypassrls before assertions.
7. Also use the local Auth/API path with synthetic login identities to exercise JWT
   claim handling, RPC exposure and views. SQL SET ROLE does not prove API behavior.
8. Test rollback using the exact pre-change schema snapshot; rerun fixtures. Destroy
   only the task's disposable environment after collecting nonsecret results.

No fixture-seeding SQL is supplied now because keys, constraints, enum types and RPC
bodies are missing. The offline preflight remains blocked until that harness is
implemented and reviewed; file presence alone must not produce a green result.

## 3. Exact actual-role assertion pattern

On the LOCAL database only, as a test setup role with SET ROLE privileges:

```sql
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{}}', true);
SELECT current_user = 'authenticated'
  AND NOT (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user)
  AND auth.uid() = '00000000-0000-4000-8000-000000000001'::uuid AS identity_ok \gset
\if :identity_ok
\else
  \quit 1
\endif
-- paid_asset_id must be supplied from the verified synthetic fixture manifest.
SELECT count(*) = 0 AS denied
FROM public.provider_media_assets WHERE id::text = :'paid_asset_id' \gset
\if :denied
\else
  \quit 1
\endif
ROLLBACK;
```

This is an assertion pattern, not a runnable full test: the synthetic identity and
paid asset must exist in verified fixtures. For anon, use `SET LOCAL ROLE anon`, an
empty claims object, assert auth.uid() IS NULL, and test discovery plus raw-table
denial. PostgreSQL SELECT denial may mean zero rows or a deliberate insufficient-
privilege error depending on the reviewed grant contract; assert the chosen one,
not either indiscriminately. Mutation/RPC rejection must assert the intended SQLSTATE
and verify no membership/entitlement/invite rows changed. Use a separate observer
connection only to inspect final effects, never to substitute for caller tests.

## 4. Required positive and negative cases

| Area | Inputs and exact required outcome |
|---|---|
| Preview | Free authenticated A: discoverable + samples on + preview_allowed true + approved preview asset => only preview row; same provider paid row hidden |
| Preview negatives | Flip each flag independently, private/suspended provider, null preview flag, or source-video URL on a purported preview => deny; provider sample toggle never exposes all rows |
| Anon | Published sanitized discovery/preview only; raw protected media and all privileged mutation RPCs deny; test helpers needed by discovery still function |
| Dates | For active/trialing/canceled: start in past and future end => allow; future start, end=now, past end, null start, null end, inverted/equal window => deny |
| Complimentary | Valid start + null end => allow; future start or finite expired end => deny |
| Cancellation | canceled_at in past with valid finite paid-through end => allow until end; terminal denied status => deny regardless of future end |
| Status | expired/past_due/unknown => deny; verify actual enum representation, no new invented enum value |
| Isolation | Subscriber A entitled only to P1 cannot read P2; subscription does not allow asset UPDATE/DELETE or entitlement INSERT/UPDATE/DELETE |
| Roles | Editor media/storefront own provider allowed, foreign provider denied; admin analytics/team view allowed but owner-only team mutation denied; owner team actions scoped to own provider |
| Platform | Trusted app_metadata admin follows reviewed platform capabilities; user_metadata admin cannot escalate; private subscriber circuits remain isolated |
| RPCs | Each overload tested under anon/free/subscriber/editor/admin/owner/platform identities; changing supplied provider/user IDs cannot cross tenants; caller-supplied admin/user ID never trusted |
| Invites | Pending correctly addressed confirmed recipient before expiry succeeds once; expired at boundary, revoked, accepted replay, wrong-address, unconfirmed, nonexistent, anonymous => fail with no membership side effects |
| Concurrency | Two accepts race => one success, one rejection; accept vs revoke serializes; owner demotion/removal impossible; duplicate email/member rules match verified constraints |
| Legacy invites | created_at older than seven days stays expired after backfill; resend does not extend expiry; null creation dates block migration for explicit remediation |
| Private circuits | A cannot read/write B's circuit/settings/favorites/history; reassignment of user_id or provider_id through UPDATE denied (USING + WITH CHECK) |
| Delivery | Copy protected URL then expire/revoke grant: old URL stops within documented token TTL; preview never reveals master URL; public YouTube cannot be claimed private |
| Offline | Expiry, account switch, provider revocation, reconnect, device clock rollback and lease boundaries follow reviewed policy; disconnected revocation limitation is explicit |
| Client paths | Expire entitlement after save/cache/program load; every protected intro/exercise denies delivery without losing circuit/notes; native video geometry and controls unchanged |

Repeat with RLS enabled and catalog assertions, but do not count those assertions
as behavioral proof. Test views with their actual security_invoker behavior and
functions under their actual owners. Exercise all existing onboarding/invitation/
role-management workflows after EXECUTE changes. Run local security advisors.

## 5. Before production authorization

Attach the schema fingerprint, resolved final migration diff, actual-role/API test
results, old-vs-new reproductions, concurrency evidence, URL-delivery results, rollback
rehearsal and native regression results. Require independent review of policies,
SECURITY DEFINER bodies and grants, product sign-off on semantics, and a new explicit
authorization before any live changes. This PR does not supply that authorization.
