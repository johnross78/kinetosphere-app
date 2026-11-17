# Provider security review and proposed corrections

Status: **review-only; database enforcement remains unverified and unmodified**.
Base: `03c31a4d15f3b4cee11cc65a871831a4008fd408`, including merged PRs #1/#2.
No live Supabase connection, migrations, deployed functions, payment changes, or
media changes were made. All production application/build/native sources remain
unchanged. No user records or credentials are included.

## Evidence and severity

The assignment supplies a prior read-only audit: all 18 public tables have RLS;
media preview access is overly broad; entitlement dates are inconsistently checked;
three SECURITY DEFINER helpers have anonymous EXECUTE; invitations lack enforced
expiration. These are **owner-supplied findings**, not independently reproduced.
RLS being enabled does not establish that its policies are correct.

| Severity | Finding | Evidence and practical consequence |
|---|---|---|
| High | Provider free samples can expose paid media rows | Supplied audit: asset preview_allowed is not required; enforce approval per asset, not per provider alone |
| High | Expired/future access can remain valid | Supplied media-policy finding; client providerAccessState checks status only |
| High, conditional | External URLs may bypass all future RLS checks | Client selects external_url, downloads it directly, and embeds Stream IDs; actual origin privacy/signing is unknown |
| High | Cached/saved playback does not reauthorize | Repository paths below; rights cannot be revoked by hiding Builder cards |
| High | Invitation lifetime/replay and address enforcement need verification | No expiry per supplied audit; RPC body unavailable, so other acceptance protections cannot be assumed absent or present |
| High, conditional | Privileged RPCs may expose unauthorized operations | Broad EXECUTE is reported; exploitability depends on actor/tenant checks in missing function bodies |
| Medium | UI policy differs across entry points and provider mapping | Unknown program provider passes; guest source list is broad; any source tag may grant visibility |

## Proposed business rules requiring product approval

All timestamps use database time and UTC instants. Access windows are half-open:
`starts_at <= now < ends_at`. Equality at the end denies access. Missing start,
invalid intervals, unknown status, or missing finite end for paid/trial access deny.
Existing null starts must be reconciled from trusted records, not silently granted.

| Status | Proposed rule |
|---|---|
| active | Valid start and finite, future end required |
| trialing | Same date checks; trial ends at its stated end, no implicit grace |
| comped | Valid start; finite end respected, null end allowed only for intentionally open-ended complimentary access |
| canceled | Cancellation stops renewal; access remains through a finite paid-through ends_at. canceled_at is an audit timestamp, not the cutoff |
| expired / past_due / unknown | Deny protected access; no undocumented billing grace |

Immediate revocation must use a verified non-allowlisted terminal state or a
separately reviewed revocation mechanism. Actual enum values and billing status
transitions are missing: do not invent a new value in the deployed database.
Multiple rows for one user/provider must be reviewed: whether any effective grant
wins, and whether a revocation overrides older rows, needs explicit constraints.
The client currently collapses rows to one Map entry; uniqueness is unverified.

Invitations: seven days from creation; pending only; exact boundary expires. Resend
does not extend validity. Reissue creates a new invitation and revokes the old one.
Old pending invitations expire using original created_at, not migration time.
Acceptance requires the current authenticated, confirmed exact normalized email,
one atomic transaction, row locking, an allowed non-owner role, and no owner
demotion. Accepted/revoked/expired/wrong-address attempts fail without side effects.
Do not add an expired enum state without inspecting the existing status constraint;
expiration can be derived from expires_at while retaining pending status.

## Proposed authorization matrix

This describes intended rules, not verified current database behavior. E/A/O roles
are scoped to their own provider only. Discovery means sanitized published metadata.
Saving a reference never grants playback. Raw media rows may contain sensitive URLs.

| Persona | Discovery | Explicit previews | Protected media | Saved circuits | Provider administration | Entitlement changes |
|---|---|---|---|---|---|---|
| Anonymous visitor | Active, discoverable only | Sanitized approved online previews | No | Local guest references only | No | No |
| Authenticated free member | Same | Approved preview assets only | No paid assets; free/included grants must be explicit | Own circuits only; playback separately checked | Own onboarding application only | No self-grant |
| Active paid subscriber | Same | Yes | Entitled provider, within dates | Own; each asset reauthorized | No | No self-grant |
| Expired subscriber | Same | Yes | No | Retain own records; locked items remain references | No | No |
| Canceled with remaining paid time | Same | Yes | Until ends_at, not canceled_at | Own; reauthorize | No | No |
| Provider Editor | Same + own draft metadata as allowed | Yes | Own provider for content work | Own, no cross-provider grant | Own storefront/media; no team or billing | No |
| Provider Administrator | Same + own drafts | Yes | Own provider for content work | Own | Own storefront/media, analytics, team viewing; no owner-only member mutation | No |
| Provider Owner | Same + own drafts | Yes | Own provider for content work | Own | Own team/invites plus content/analytics; cannot remove/demote owner via current workflows | No subscription self-grant |
| Platform administrator | Moderation scope | Yes | Authorized moderation | No routine blanket access to subscribers' private circuits | Platform review; audited privileged operations | Audited backend-only grant/revoke workflow |

Analyst is also an existing role: analytics only, no default protected-media or
membership mutation permission. The current client gives all memberships full
provider visibility; changing this requires deliberate compatibility review.
Suspended/inactive providers deny subscriber/preview delivery; moderation access
is a separate platform capability. Free/included-provider semantics require an
explicit server grant rule, not a fallback for unknown providers.

## Client-side path review and proposed follow-up changes

| Repository path | Current behavior | Proposed correction (not implemented) |
|---|---|---|
| www/index.html:2297, 2307–2320 | Platform role uses app_metadata; capability map is provider-scoped | Preserve server-controlled metadata; mirror checks server-side; account for JWT claim freshness |
| :2632 | exerciseAccessibleForCurrentUser allows any matching source tag | Resolve immutable provider/content ownership, not any source label; fail closed on unknown paid identity |
| :2638 | providerAccessState ignores dates and grants full access to any member | One effective-access model; capability-scoped members; load dates and server decision |
| :2676 | programAccessibleForCurrentUser allows unknown provider | Require mapping and asset authorization |
| :2885–2924 | Guest gets all source keys; entitlement query selects provider_id,status only | Public catalog may remain visible, but protected media cannot rely on guest/client filtering; request effective grants |
| :4291, :4589 | Filter checks visibility; addToCircuit lacks independent check | Keep circuit references; validate at launch/playback and backend delivery |
| :4927 | loadProgramToBuilder loads/launches without rechecking access | Recheck at launch and every protected intro/movement |
| :5389, :6423 | Saved launch/getActiveItems resolve cached exercises without access recheck | Preserve circuit/notes; lock denied items, explain renewal; prevent media delivery |
| :6184–6219 | Offline query filters offline_allowed, then downloads external_url; manifest has no access expiry | Separate offline grant bound to user/provider/asset/license with expiry; origin protection; refresh and deletion policy |
| :6214, :6720 | Cached blob takes precedence; offlineAssetForExercise returns by exercise ID only | Account-scoped manifest; check offline validity before blob playback; purge/revoke on identity changes |
| :6694, :6720 | Stream/YouTube routed directly from IDs | Obtain server-authorized media grant before calling existing player; leave native protocol/geometry untouched |
| :2387–2535 | Invite list filters pending, no expiry; accept calls RPC | Server enforces expiry/address/atomicity; UI displays expired state and handles denial |
| :2822 | Storefront writes provider_id from selected provider | RLS and WITH CHECK must reject cross-provider writes/provider reassignment |

Client checks improve UX only. Do not treat a copied exercise, favorite, circuit,
program ID, preview URL, or offline flag as an authorization credential. No workout
or video behavior is changed in this PR; characterization tests intentionally show
existing incorrect access-date behavior as passing historical expectations.

## Proposed SQL and missing schema

`proposals/` contains four deliberately blocked migration drafts covering media,
entitlement windows, function grants, and invitations. They are outside
`supabase/migrations`, begin with an unconditional exception, contain unresolved
`__verified_*` placeholders, and end with rollback. **They are not deployable
migrations, have not been SQL-runtime tested, and do not constitute a fix.** Do not
remove guards or move them into migration discovery before verification.

Missing: exact DDL/types/constraints/FKs/indexes, every policy expression and grant,
function overload signatures/bodies/owners/search_path/ACLs/dependencies, exposed
schemas/views, auth email-confirmation behavior, media origin controls, and provider
state/billing semantics. Docker is available, but starting an empty database would
not reconstruct these. No fake RLS schema or passing database test was invented.

The media draft uses a restrictive fence so an existing permissive policy cannot
OR around it. Final policy replacement must consider ALL/SELECT policies, anon and
authenticated roles, free/included providers, preview asset types, provider status,
member capabilities, and underlying helper dependencies. A restrictive policy
alone does not grant access; intended positive paths need permissive grants too.

For privileged functions, revoke PUBLIC as well as explicit anon permissions per
verified overload. Retain required authenticated RPC access, but prove internal
authorization. Do not globally revoke every public function. RLS may call these
helpers as anon: removing EXECUTE can break discovery. Default grants depend on
the actual creator role; audit that role before setting defaults. Prefer private
helpers, fixed search_path and fully qualified objects; move SECURITY DEFINER only
with evidence, not as a permission-error workaround.

## Media delivery and commercial licensing boundaries

An authorized row can reveal durable external_url, storage path, Stream UID or
source-video location. RLS does not revoke an already copied URL or cached blob.
Inventory actual origin behavior without putting URLs/credentials in this review.
Use private storage or authenticated/signed Stream delivery for protected licensed
media; sanitize preview metadata so preview rows never include master URLs. Use
short-lived audience/resource-bound grants, cache-control, no protected URLs in
public catalogs/logs, and test access after expiry/refund/provider suspension.

YouTube IDs/public embeds are not an enforceable private-media licensing boundary;
do not scrape/download them or claim RLS makes public YouTube videos private.
Preserve the established native player; entitlement gates belong before existing
media loading functions. Offline revocation cannot immediately reach a disconnected
device: define a bounded offline lease and documented maximum exposure, distinguish
personal devices from licensed classroom use, and assess clock rollback/device
storage risks. Browser blobs are not DRM.

Future rights must distinguish subject (person/organization), provider/content,
use (personal/instruction/display), territory if required, term, seats, authorized
devices/locations, and offline permission. Personal subscription does not confer
instructor or studio rights. A provider editor role is not a commercial exhibition
license. Independent provider grants compose per asset; canonical equivalence never
transfers ownership. Instructor/studio/enterprise rights need organization/seat/
location enforcement and contracts, not a reused personal-entitlement boolean.
No tiers, billing integrations, or payment processing are implemented here.

## Rollout, compatibility, and rollback

Use the exact validation protocol in verification/README.md before considering
implementation. Expired/free-sample access will tighten intentionally. Null legacy
dates, unlimited active grants, member analyst access, existing invites, helper
permissions and client cancellation labels may change UX; review counts without
sharing actual records. Apply related policy/RPC/expiry changes atomically only
after isolated tests. Canary on staging with synthetic fixtures; monitor denials
without recording sensitive media URLs or user payloads.

Before a future rollout, capture reviewed schema-only definitions, ACLs, policy
names, and function bodies plus a privately retained backup/restore point. Use one
transaction for the final migration and fail on unexpected catalog fingerprints.
On failure, rollback that transaction. After commit, restore exact previous
definitions/grants from the verified snapshot through a reviewed compensating
migration; do not disable RLS or grant broad access. Reopening the preview flaw is
not a safe default rollback: pause protected delivery while investigating. Retain
expires_at data rather than dropping it immediately. No rollback is needed now:
no database changes have occurred.

## Current test results and limits

`npm test`: 58 passing Node tests (45 existing + 13 new client/readiness checks),
also passed using Node 22.11.0 to match CI, in addition to Node 24.22.1.
The new tests execute extracted production provider functions, including negative
cross-provider capabilities and user_metadata escalation cases. They are not RLS
tests. `npm run test:security:preflight` deliberately exits 2, reporting missing
schema evidence and **no database tests run**. No anon/authenticated database-role,
RPC atomicity, URL-origin, or SQL migration execution result is claimed.

References consulted: Supabase RLS and database-function documentation and current
changelog. PUBLIC function grants, SECURITY DEFINER search_path, exposed views, and
ownership/WITH CHECK require review. No live connection was used.
