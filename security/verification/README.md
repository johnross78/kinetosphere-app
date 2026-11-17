# Isolated authorization verification

## Actual results

| Check | Result |
|---|---|
| Reconstructed public-schema SQL-role and PostgREST suite | 134 assertions passed, 0 failed, on Node 24.22.1 and again on Node 22.11.0 |
| Existing and added Node suite | 60 tests passed, 0 failed/skipped, on Node 24.22.1 and Node 22.11.0 |
| Recorded evidence/SQL/harness fingerprints | Preflight passed for the committed local-run report; it explicitly does not rerun tests |
| Full Supabase Auth/Storage and hosted-version equivalence | Blocked; missing configuration/full platform schema and full image storage limitation |
| External-origin/private media, offline leases, iOS device behavior | Not tested; no live origin or native deployment used |

The final recorded database report is from Node 22.11.0 and PostgreSQL 15.15.

## Reproduce locally

Prerequisites: Node 22+, Docker with image access and room for the two pinned small
images. No npm dependency install, psql host install, Supabase credentials or cloud
project connection is required.

```sh
npm run test:security:database
npm run test:security:preflight
npm test
```

The runner accepts no database URL/project argument. It creates uniquely named,
internal-only Docker networking, a disposable PostgreSQL container and PostgREST
container with no published ports or host mounts, loads the catalog and synthetic
fixtures, performs assertions, writes a nonsecret JSON report and removes only its
containers/volumes/network in finally. It bypasses HTTP proxy routing for the local
API. Runtime JWT signing material is random and never written to the report or
source. Do not substitute real identities or credentials.

The database image is PostgreSQL 15.15-alpine and the API image PostgREST 12.2.3;
both are digest-pinned in the runner/report. Full Supabase image extraction failed
with a Docker-layer storage error here; no full GoTrue stack is claimed.

## Reconstruction fidelity

`security/local/catalog-loader.mjs` uses catalog.json directly, with no simplified
replacement policies/RPCs. It creates all 18 public tables, all 66 constraints (keys
before foreign keys), 43 indexes, 39 policies, all 11 complete function definitions,
recorded function owners/EXECUTE grants and table ACLs, and enables the observed RLS.
No triggers are invented (the snapshot has zero). Relevant postgres/public default
privileges are reproduced. Unrelated platform-schema default grants are not replayed.

`auth-adapter.sql` is LOCAL ONLY. It supplies the missing auth.users identity key,
non-bypass anon/authenticated roles, an authenticator role for PostgREST, and upstream
Supabase auth.uid/auth.jwt claim-reader bodies, linked to their source revision in
that file. It is not a reconstruction of all auth.users columns, GoTrue signup,
confirmation, MFA, session revocation, anonymous-auth identities, or Storage. The
snapshot did not include those. The synthetic admin policy UUID stays in the fixture
reconstruction only, never in reviewed SQL changes.

Baseline policies are loaded without security fixes. SQL assertions start a fresh
transaction, SET LOCAL ROLE to anon/authenticated, set synthetic claim context, and
rollback. Each persona is checked for actual requesting role and no BYPASSRLS.
Mutation observations through postgres are only setup/final-state inspection, not
substitutes for caller assertions. Parallel invitation checks use separate caller
connections; a short post-accept sleep holds the row lock to exercise contention.

PostgREST uses the NOINHERIT authenticator, actual role switching and validated
runtime-signed synthetic JWTs. Baseline paid-preview exposure is reproduced through
its REST endpoint; corrected media/privileged-RPC behavior is then tested. This is
actual local API enforcement, not an administrative SQL-session-only result.
No real token is committed and no public or protected media URL is fetched.

## Changes tested

All four reviewed SQL fragments are first applied in a single transaction then
rolled back; restoration of baseline preview/helper/expiry behavior is asserted.
They are then applied in one transaction and committed only in this disposable DB.
The harness fails on any unexpected result or SQL error. Original RLS expressions,
constraints, grants and function bodies are preserved in the supplied evidence;
no new sanitized export replaces them.

See `security/test-results/local-run.json` for every assertion and exact input
fingerprints. The preflight checks those fingerprints and reports **recorded**
results without rerunning Docker. Editing SQL/evidence/harness invalidates the
report. To refresh it, rerun the full database command, not a report-editing script.
Passing `npm test` is not alone evidence that the database command was rerun.

Coverage includes old-policy preview/date/orphan/inactive exposure, NULL guard RPC
exploitation, role grants, private circuits, date boundary/status matrix, invitation
expiry and original replay/email/member controls, owner/admin/editor boundaries,
atomic onboarding owner creation, parallel accept/accept and accept/revoke outcomes,
and REST positive/negative media and privileged operations. Synthetic URLs use the
reserved .invalid domain; tests never exercise an external origin.

## Production-equivalence checks still blocked

These local results do not remove the following requirements:

1. Verify actual hosted Postgres/PostgREST/Auth versions, extensions and complete
   schema/sequence/schema-role ACLs, including exposed schemas, creator-role default
   privileges and Auth/Storage dependencies. Repeat on a production-equivalent
   disposable Supabase stack with actual Auth migrations/service.
2. Verify signed-in/confirmed email guarantees, JWT refresh and revocation behavior,
   anonymous-auth policy, role changes and forged/unverified claims using that Auth
   service. Our adapter intentionally cannot establish these.
3. Inventory legacy entitlement dates and preview flags privately. Active/trialing
   null ends will now deny; historical preview_allowed defaults true cannot prove
   approval. Obtain product approval for cancellation, comped, analyst and orphan
   media semantics. Do not backfill guessed dates or admin identities.
4. Review existing provider_entitlements SELECT visibility: it currently permits any
   provider member to see subscriber rows (including billing references). A narrower
   projection/capability may be required; this PR preserves it pending workflow/data
   review. Likewise default privileges for future objects need ongoing governance.
5. Validate Stream/CDN origin ACLs/tokens and external_url/storage_path handling,
   explicit preview redaction, copied-URL expiry and offline leases. Zero Storage
   buckets/objects does not establish external video privacy. YouTube public embeds
   cannot be made private by these policies.
6. Apply on staging with synthetic traffic; test account changes, program intros,
   saved/cached/offline circuits and expiry. Current client does not implement the
   date/access model; already disclosed URLs/cache can bypass row denial.
7. Run existing app tests and native simulator/device regressions before a future
   release. Native source/build baseline tests pass here; no iOS compilation or
   device certification is made by these database tests.
8. Privately snapshot exact pre-change schema/ACLs; verify no sanitized admin value
   occurs in any intended deployment artifact. Combine reviewed SQL atomically,
   fingerprint expected schema before application, plan denial monitoring, and
   rehearse failure/forward-fix procedures. Obtain a new explicit authorization
   before touching the live project. Do not restore the NULL-guard bug as a rollback.

The evidence README remains historical and immutable. Its original instruction to
block until actual-role RLS/API tests run has been satisfied for this reconstructed
local scope only; production-equivalent certification remains blocked as above.
