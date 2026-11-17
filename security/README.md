# Provider authorization review — reconciled with actual evidence

PR #3 is a proposal, not permission to deploy. No live connection or deployment was
made. The immutable sanitized snapshot in `verified-schema/` was supplied by the
owner at branch commit `d608961`. All six files were reviewed. The snapshot's
anonymized admin UUID is used only in the local reconstruction/fixtures; none of
the reviewed SQL changes contains that value. Do not deploy the reconstruction.

## What is now established

`npm run test:security:database` reconstructs and tests the supplied public catalog
inside disposable Docker containers. It reproduces baseline vulnerabilities first,
then applies the corrected SQL atomically and runs actual-role/PostgREST checks.
See `test-results/local-run.json` for exact assertion names, pinned image digests,
engine versions, and SHA-256 fingerprints of evidence, SQL and harness sources.
`npm run test:security:preflight` verifies that recorded report is current; it does
not rerun database tests or certify production.

The application, native player, timer behavior, Supabase project, deployment settings,
payment processing and Option 6.2 design branch remain unchanged.

## Corrections to the earlier review

- Entitlements already have UNIQUE(user_id, provider_id), six constrained text
  statuses, starts_at NOT NULL with now() default, and nullable ends_at. Multiple
  grants/null starts are not an existing schema ambiguity; invalid date intervals
  remain possible and are denied by the new predicate.
- Invite acceptance already uses SELECT FOR UPDATE, exact lowercased JWT-email
  matching, pending-state/replay checks, rejection of existing membership, and a
  unique membership constraint. Creation revokes prior pending invitations and a
  partial unique index limits pending provider/email duplicates. These controls
  were preserved rather than replaced. Missing expiry was reproduced.
- Role/capability checks already exist server-side. Admin/editor/analyst cannot
  normally manage owner-only team operations; owner removal/demotion is guarded.
  A newly reproduced NULL-boolean flaw undermines several RPC guards (below).
- Mutation RPCs already restrict EXECUTE to authenticated/service_role. Only the
  three helper functions also grant PUBLIC/anon EXECUTE; no anonymous mutation-RPC
  exposure was assumed. Anon discovery is currently only shared_exercises; provider
  catalog/storefront/media policies are authenticated-only.
- All 18 public tables have RLS, 39 policies and no triggers. There are no public
  views or Storage buckets/objects in the evidence. This is not full Auth/Storage
  DDL, dashboard configuration, or external-origin authorization evidence.

## Findings, reproduction and corrections

| Severity | Reproduced baseline | Corrected local result |
|---|---|---|
| Critical | is_platform_admin() returns NULL when app_metadata.role/admin are absent. In PL/pgSQL IF NOT(NULL) does not reject. A free member could create invitations, remove non-owner members and approve onboarding | Admin/capability helpers return strict booleans; RPC checks use IS NOT TRUE. Free callers denied, authorized owner/platform workflows retained |
| High | Provider samples enable paid source-video rows and unapproved previews for unrelated free members (also reproduced through PostgREST) | Exact SELECT policy replaced; previews require active discoverable sample provider, approved preview flag and preview asset type |
| High | Expired/future active grants still read paid assets | Date/status predicate evaluated against statement_timestamp(); 24 status/window combinations tested |
| High | Old pending invitations accepted after eight days | Seven-day expiry backfilled from original created_at and enforced in acceptance and email-claim RPCs |
| High | Null-provider media globally readable; inactive provider samples readable | Unowned media restricted to platform moderation; inactive subscriber/preview path denied |
| High, conditional | anon/authenticated have TRUNCATE grants; actual-role TRUNCATE bypasses RLS | TRUNCATE revoked for both roles/PUBLIC on existing public tables. PostgREST does not itself expose a TRUNCATE endpoint; direct SQL privilege was tested |
| Medium | Three SECURITY DEFINER helpers anonymously executable | Verified overload grants narrowed; anon shared-library reads still work; all 11 function search_paths fixed to empty, qualified objects preserved |
| High, unverified delivery | Rows contain external_url/storage_path; copied URLs and offline blobs can outlive a database decision | NOT solved by this PR. External-origin token/ACL and offline licensing tests remain blocked |

The existing ALL media-management policy remains scoped to owner/admin/editor or
platform admin. It intentionally still permits provider content work even when a
provider is pending/inactive. Analyst membership no longer supplies full protected
media read access through the replaced SELECT policy; analysts retain analytics
permissions and can independently qualify for a preview/subscription. This is a
reviewable tightening, not a claim that the old schema lacked a role model.

## Explicit authorization matrix (proposed)

Discovery here means sanitized published metadata. Current DB discovery remains
mostly authenticated-only; anonymous provider discovery is not introduced in SQL.
Circuits store references, never permanent authorization. Roles apply only to their
provider. Platform moderation does not bypass private gym_circuits ownership.

| Persona | Discovery | Previews | Protected media | Saved circuits | Administration | Entitlement mutation |
|---|---|---|---|---|---|---|
| Anonymous | Public shared library; future sanitized provider endpoint | Future sanitized endpoint only; raw assets denied | Denied | Local guest only | Denied | Denied |
| Authenticated free member | Discoverable catalog | Explicit approved preview types | Denied absent a grant | Own records; playback rechecked | Own onboarding submission | Denied |
| Active paid subscriber | Same | Yes | Own entitled provider within dates | Own; no perpetual media grant | No provider powers | Denied |
| Expired subscriber | Same | Yes | Denied | Keep records/notes, lock media | No provider powers | Denied |
| Canceled, paid time remaining | Same | Yes | Through finite ends_at | Own; playback rechecked | No provider powers | Denied |
| Provider Editor | Catalog + own provider | Yes | Own content-work assets | Own | Own storefront/media/content | Denied |
| Provider Administrator | Same | Yes | Own content-work assets | Own | Content/analytics/team view; owner-only team mutations denied | Denied |
| Provider Owner | Same | Yes | Own content-work assets | Own | Own team/invites/content/analytics; owner cannot be removed/demoted through team RPCs | Denied |
| Platform administrator | Moderation | Yes | Moderation | No blanket private-circuit access | Platform review and audited administration | Existing platform-admin policy retained; operational auditing remains required |

Analyst: analytics, no default protected media or team mutation. Free/included
provider access currently has no separate database-wide grant in the observed media
policy; this PR does not invent one. A future explicit grant model is required if
product intends all such assets to be readable without entitlements or previews.

## Business rules in the SQL proposal

Effective window: `starts_at <= database time < ends_at`. At the end boundary deny;
inverted/equal intervals deny. Active/trialing/canceled need a finite future end;
comped may be intentionally open-ended. Expired/past_due deny. Cancellation records
intent not to renew: canceled_at alone does not terminate remaining paid access.
These rules require product sign-off. Existing active/trialing rows with null ends
will lose protected access until reconciled; no blanket backfill invents dates.

Invites expire at created_at + seven days, including old pending records; resending
must not reset the window. Existing create_provider_invite reissues by revoking the
old row and creating a new one. Acceptance retains its existing transaction, row
lock, email, replay and membership checks. Email claim also checks expiry. The
expires_at constraint caps validity and the new default supplies seven days.
Current acceptance trusts the signed JWT email, not an auth.users confirmation
lookup. Confirmation/account-change guarantees depend on unavailable Auth settings;
this PR deliberately does not pretend that missing confirmation data was exported.

preview_allowed currently defaults TRUE. The proposal changes the default to FALSE
for new assets and excludes source_video from free previews. Existing true flags
are not proof of explicit approval: review/redact legacy preview rows before any
rollout. We did not silently reclassify all existing assets or alter their URLs.

## Reviewed SQL order and transactional use

The four existing files in `proposals/` now contain schema-specific SQL rather than
placeholders. They are outside auto-discovered migrations and require approval:

1. function-execute.sql — strict helpers/RPC guards, verified EXECUTE ACLs, fixed
   search_path, existing-table TRUNCATE revocation.
2. entitlement-window.sql — private, non-exposed predicate schema/helper.
3. media-access.sql — private current-user media decision helper, default flag,
   replacement of the exact permissive SELECT policy; DML policy retained.
4. invitation-expiration.sql — column/backfill/constraint and minimally changed
   accept/claim RPCs; existing guarantees preserved.

Execute all fragments in one transaction, as the local harness does. They are not
idempotent reapplication scripts: unexpected existing schema/policy state should
fail. The new media helper is narrowly SECURITY DEFINER because checking provider
status must work even when provider-catalog RLS hides an entitled private provider.
It derives identity from auth.uid(), accepts no caller user ID, returns only a
boolean, uses qualified names/empty search_path, and is not in the public API schema.
Only authenticated can invoke it through RLS; pure internal predicate is not
client-callable. Catalog-table/role owners and ACL review remain part of deployment.

## Client paths remain a separate required correction

No client behavior changed. `www/index.html` still checks status without dates in
providerAccessState (:2638), and loadProviderAccessState (:2885) selects status only.
Guests get broad source-key visibility; exerciseAccessibleForCurrentUser (:2632)
accepts any accessible source tag; unknown program providers pass (:2676).
Builder filters (:4291) check visibility but addToCircuit (:4589), program launch
(:4927), saved launch (:5389), getActiveItems (:6423) and loadExerciseVideo (:6720)
do not reauthorize the stored reference. Offline lookup (:6214) prefers a blob
without a lease check; :6184 downloads external_url based on offline_allowed.

Follow-up: centralize effective grants, require protected delivery authorization
before the existing player load calls, cover intros and exercise changes, preserve
circuit notes/references on denial, and bind offline grants to account/asset/license
with bounded expiry. Never change native player geometry/protocol to enforce rights.
The new RLS is not sufficient for embedded public URLs, already cached records,
public YouTube videos or disconnected devices. Client cancellation labels also
still differ from the proposed paid-through rule.

## Licensing and delivery boundaries

Separate person/provider subscriptions from instructor, studio and enterprise rights.
Future licenses need subject/organization, provider/content, personal vs instructional
use, term, seats, devices/locations and offline rights. A provider editing role or
canonical exercise match never transfers content ownership or exhibition rights.
No payment processing or tier implementation was added.

Protect licensed origins with private/signed delivery and sanitized preview
projections; preview rows must not carry master URLs/storage paths. Test copied
URL expiry and token audience/resource limits. Browser blobs are not DRM and offline
revocation cannot reach a disconnected device immediately. YouTube public embeds
cannot become private merely through RLS. No live media URL was fetched here.

## Results, limits and rollback

See test-results/local-run.json and verification/README.md. Actual SQL roles are
anon/authenticated with no bypass privileges; PostgREST validates runtime-signed
synthetic claims and switches roles. Setup uses postgres; assertions do not claim
admin queries prove RLS. Baseline and corrected decisions, team/onboarding flows,
private data, parallel acceptance/revocation and transaction rollback were tested.

A full Supabase image could not unpack within this Docker environment's storage
limit. The passing environment uses pinned PostgreSQL 15.15 + PostgREST 12.2.3, exact
public catalog reconstruction and explicit upstream auth claim-reader adapters.
It does NOT run GoTrue or reproduce unexported Auth/Storage schemas/settings. This
is meaningful public-schema authorization evidence, not production certification.

Before deployment: verify hosted engine/version, full schema fingerprints, schema
ACLs/sequence ACLs/default privileges/API exposure, current preview/date data,
confirmation/session rules, signed-origin behavior and full application/native
regressions. Retest on production-equivalent isolated infrastructure with Auth.
Product approval of tightened semantics and explicit deployment authorization are
still required. Verified evidence files must never be executed as deployment DDL.

The local harness rehearses all changes inside BEGIN/ROLLBACK, verifies restoration
of baseline behavior, then applies them atomically for positive/negative tests.
A future pre-commit deployment failure must rollback the whole transaction. After
commit prefer a reviewed forward fix or pause protected delivery; blindly restoring
the old NULL guard/paid-preview leak is unsafe. Preserve expiry data. Capture exact
unsanitized definitions/grants in the owner's private rollback process, never in
this repository. No production rollback or deployment occurred in this PR.
