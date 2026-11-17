-- REVIEW-ONLY MIGRATION DRAFT. Acceptance RPC definition is not available.
BEGIN;
DO $$ BEGIN
  RAISE EXCEPTION 'BLOCKED: invite schema, timestamp types, acceptance RPC body/signature and email-confirmation semantics are missing';
END $$;

-- Proposed new column; verify no existing equivalent and created_at is timestamptz.
ALTER TABLE public.provider_invites ADD COLUMN expires_at timestamptz;
UPDATE public.provider_invites
SET expires_at = created_at + interval '7 days';
-- Abort final migration for null/invalid created_at; never grant a fresh 7-day
-- window to old invitations at migration time. Review rollout counts privately.
ALTER TABLE public.provider_invites
  ALTER COLUMN expires_at SET DEFAULT (statement_timestamp() + interval '7 days'),
  ALTER COLUMN expires_at SET NOT NULL;
ALTER TABLE public.provider_invites ADD CONSTRAINT ks_invite_valid_window
  CHECK (expires_at > created_at AND expires_at <= created_at + interval '7 days');

-- REQUIRED replacement of the VERIFIED accept RPC, in the same final transaction:
-- 1. Derive actor from auth.uid(); reject null/anonymous-auth identities.
-- 2. SELECT invite FOR UPDATE; reject absent, status != pending, or
--    expires_at <= statement_timestamp(). Use one authoritative database clock.
-- 3. Resolve current confirmed email from trusted auth identity data; compare
--    normalized exact address (trim/lowercase), never user_metadata/caller email.
-- 4. Verify provider eligibility and role in admin/editor/analyst. Never create or
--    demote an owner through invitations. Resolve existing membership explicitly.
-- 5. Insert/update authorized membership and mark accepted atomically; concurrent
--    acceptance/revoke must serialize on this invite and membership invariants.
-- 6. Reject replay (including accepted/revoked), without partial membership writes.
-- Enforce expires_at on create and resend too. Resend must not extend expiry;
-- owner issues a new invitation after expiration. Updating list RLS/UI is not an
-- adequate substitute for enforcing expiration inside accept_provider_invite.
-- An expires_at column by itself DOES NOT repair the acceptance workflow.
ROLLBACK;
