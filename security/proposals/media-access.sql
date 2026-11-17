-- REVIEW-ONLY MIGRATION DRAFT. Every __verified_* token is unresolved.
BEGIN;
DO $$ BEGIN
  RAISE EXCEPTION 'BLOCKED: exact policy inventory, relation keys/types, helper signatures and free/included-provider semantics are missing';
END $$;

-- A RESTRICTIVE fence intersects existing permissive policies, preventing an old
-- broad preview policy from winning through PostgreSQL permissive-policy OR.
-- Existing policies must still supply a permissive grant for each intended role.
-- Anonymous preview metadata belongs in a sanitized endpoint, not this raw table.
CREATE POLICY ks_media_authorization_fence
ON public.provider_media_assets AS RESTRICTIVE
FOR SELECT TO authenticated
USING (
  __verified_platform_admin_for_current_user__()
  OR __verified_provider_media_capability_for_current_user__(provider_id)
  OR (
    __verified_provider_is_active__(provider_id)
    AND (
      __verified_effective_current_user_entitlement__(provider_id, statement_timestamp())
      OR (
        preview_allowed IS TRUE
        AND __verified_provider_discoverable_and_samples_enabled__(provider_id)
        AND __verified_asset_is_sanitized_preview__(id)
      )
    )
  )
);
-- id, provider_id, preview_allowed types/constraints and helper implementations
-- must be verified before replacing placeholders. Add a matching anon fence or
-- revoke raw-table SELECT from anon after checking current policy dependencies.
-- Do not blindly remove policies or grant free/included access to every asset.
-- Review INSERT/UPDATE/DELETE WITH CHECK and provider reassignment separately.
-- Field-level sensitive URLs require a sanitized projection/signed-media boundary;
-- RLS filters rows, not secret columns within an otherwise readable row.
ROLLBACK;
