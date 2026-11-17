-- Correct the exact permissive SELECT policy; leave existing scoped DML policy.
-- Existing preview_allowed=true rows need a separate approval inventory before rollout.
ALTER TABLE public.provider_media_assets ALTER COLUMN preview_allowed SET DEFAULT false;
CREATE FUNCTION kinetosphere_security.media_read_allowed(p_provider_id uuid,p_preview_allowed boolean,p_asset_type text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND coalesce(
  public.is_platform_admin()
  OR public.provider_has_capability(p_provider_id,'media:edit')
  OR EXISTS (
   SELECT 1 FROM public.providers p WHERE p.id=p_provider_id AND p.status='active'
   AND (
    EXISTS (SELECT 1 FROM public.provider_entitlements e
     WHERE e.provider_id=p.id AND e.user_id=auth.uid()
     AND kinetosphere_security.entitlement_effective(e.status,e.starts_at,e.ends_at,statement_timestamp()))
    OR (p.discoverable AND p.free_sample_enabled AND p_preview_allowed IS TRUE
        AND p_asset_type IN ('preview_video','poster','thumbnail','highlight_reel'))
   )
  ), false);
$$;
REVOKE ALL ON FUNCTION kinetosphere_security.media_read_allowed(uuid,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION kinetosphere_security.media_read_allowed(uuid,boolean,text) TO authenticated;
DROP POLICY media_read_entitled_member_or_discoverable ON public.provider_media_assets;
CREATE POLICY media_read_entitled_member_or_discoverable ON public.provider_media_assets
AS PERMISSIVE FOR SELECT TO authenticated
USING (kinetosphere_security.media_read_allowed(provider_id,preview_allowed,asset_type));
-- No blanket orphan/null-provider grant. Analysts require an independent entitlement
-- or approved preview. Own provider media editors and platform moderation preserved.
