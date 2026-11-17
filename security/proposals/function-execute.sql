-- REVIEW-ONLY MIGRATION DRAFT. Do not guess overloaded signatures.
BEGIN;
DO $$ BEGIN
  RAISE EXCEPTION 'BLOCKED: exact pg_proc identities, owners, ACLs, bodies and policy call graph are required';
END $$;

-- Expand one statement per VERIFIED overload of current_provider_role,
-- is_platform_admin, provider_has_capability and each administration RPC.
REVOKE EXECUTE ON FUNCTION public.__verified_function__(__verified_argument_types__)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.__verified_authenticated_rpc__(__verified_argument_types__)
TO authenticated;

-- RLS expressions execute helper functions as the requesting role. Revoking an
-- anon helper used by public discovery RLS can cause permission errors. Options:
-- retain minimal audited access, move protected policies to authenticated, or
-- introduce a sanitized public boundary. Pick only after call-graph tests.
-- SECURITY DEFINER review: derive actor from auth.uid(), no trusted caller user_id,
-- qualified objects, fixed search_path, no unsafe dynamic SQL, ownership checks,
-- least-privilege owner and explicit grants. Do not change signatures blindly.
-- Preserve all required auth RPCs: submit/review onboarding, create/accept/revoke
-- invite, update member role, remove member. EXECUTE alone grants no authority.
-- Scope future default privileges to the verified creator role in a later change;
-- do not revoke EXECUTE from every public function as a blanket fix.
ROLLBACK;
