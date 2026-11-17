-- Reviewed against the sanitized catalog. Local-test change set; not deployment approval.
CREATE OR REPLACE FUNCTION public.is_platform_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select auth.uid() is not null and coalesce(
    coalesce(((auth.jwt() -> 'app_metadata' ->> 'admin')::boolean), false)
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$function$
;
CREATE OR REPLACE FUNCTION public.provider_has_capability(p_provider_id uuid, p_capability text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(public.is_platform_admin()
      or case public.current_provider_role(p_provider_id)
           when 'owner' then p_capability in ('storefront:edit','media:edit','analytics:view','members:view','members:manage','content:edit')
           when 'admin' then p_capability in ('storefront:edit','media:edit','analytics:view','members:view','content:edit')
           when 'editor' then p_capability in ('storefront:edit','media:edit','content:edit')
           when 'analyst' then p_capability in ('analytics:view')
           else false
         end, false);
$function$
;
CREATE OR REPLACE FUNCTION public.create_provider_invite(p_provider_id uuid, p_email text, p_role text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
  v_email text := lower(trim(p_email));
begin
  if (public.provider_has_capability(p_provider_id,'members:manage') or public.is_platform_admin()) is not true then
    raise exception 'Not authorized to manage this provider team';
  end if;
  if p_role not in ('admin','editor','analyst') then
    raise exception 'Invalid provider role';
  end if;
  if v_email is null or v_email='' or position('@' in v_email)=0 then
    raise exception 'A valid email is required';
  end if;

  update public.provider_invites
  set status='revoked', revoked_at=now()
  where provider_id=p_provider_id
    and lower(email)=v_email
    and status='pending';

  insert into public.provider_invites(provider_id,email,role,invited_by)
  values(p_provider_id,v_email,p_role,auth.uid())
  returning id into v_id;

  return v_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.claim_provider_invite_email(p_invite_id uuid)
 RETURNS TABLE(invite_id uuid, recipient_email text, provider_name text, invited_role text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_inv public.provider_invites%rowtype;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select * into v_inv from public.provider_invites where id=p_invite_id for update;
 if v_inv.id is null then raise exception 'Invite not found'; end if;
 if (public.provider_has_capability(v_inv.provider_id,'members:manage') or public.is_platform_admin()) is not true then
   raise exception 'Not authorized to send this provider invitation';
 end if;
 if v_inv.status <> 'pending' then raise exception 'Invite is not pending'; end if;
 if v_inv.email_delivery_status='sent' then raise exception 'Invitation email already sent'; end if;
 if v_inv.email_delivery_status='sending' and v_inv.email_delivery_attempted_at > now()-interval '10 minutes' then
   raise exception 'Invitation email is already being processed';
 end if;
 update public.provider_invites
 set email_delivery_status='sending',email_delivery_attempted_at=now(),email_delivery_error=null
 where id=p_invite_id;
 return query select v_inv.id,v_inv.email,p.name,v_inv.role from public.providers p where p.id=v_inv.provider_id;
end $function$
;
CREATE OR REPLACE FUNCTION public.remove_provider_member(p_provider_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if (public.provider_has_capability(p_provider_id,'members:manage') or public.is_platform_admin()) is not true then
    raise exception 'Not authorized to manage this provider team';
  end if;

  delete from public.provider_members
  where provider_id=p_provider_id
    and user_id=p_user_id
    and role<>'owner';

  return found;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.revoke_provider_invite(p_invite_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_provider_id uuid;
begin
  select provider_id into v_provider_id
  from public.provider_invites
  where id=p_invite_id;

  if v_provider_id is null then
    return false;
  end if;

  if (public.provider_has_capability(v_provider_id,'members:manage') or public.is_platform_admin()) is not true then
    raise exception 'Not authorized to manage this provider team';
  end if;

  update public.provider_invites
  set status='revoked', revoked_at=now()
  where id=p_invite_id and status='pending';

  return true;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.update_provider_member_role(p_provider_id uuid, p_user_id uuid, p_role text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if (public.provider_has_capability(p_provider_id,'members:manage') or public.is_platform_admin()) is not true then
    raise exception 'Not authorized to manage this provider team';
  end if;
  if p_role not in ('admin','editor','analyst') then
    raise exception 'Invalid provider role';
  end if;

  update public.provider_members
  set role=p_role
  where provider_id=p_provider_id
    and user_id=p_user_id
    and role<>'owner';

  return found;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.review_provider_onboarding_application(p_application_id uuid, p_approve boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_app public.provider_onboarding_applications%rowtype; v_provider_id uuid; v_slug text;
begin
 if auth.uid() is null or public.is_platform_admin() is not true then raise exception 'Kinetosphere platform administration required'; end if;
 select * into v_app from public.provider_onboarding_applications where id=p_application_id for update;
 if v_app.id is null then raise exception 'Application not found'; end if;
 if v_app.status<>'pending' then raise exception 'Application already reviewed'; end if;
 if not p_approve then
   update public.provider_onboarding_applications set status='rejected',reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=v_app.id;
   return null;
 end if;
 v_slug:=trim(both '-' from regexp_replace(lower(v_app.business_name),'[^a-z0-9]+','-','g'));
 if v_slug='' then v_slug:='provider'; end if;
 v_slug:=left(v_slug,65)||'-'||left(replace(v_app.id::text,'-',''),8);
 insert into public.providers(slug,name,description,status,discoverable,access_model)
 values(v_slug,v_app.business_name,v_app.description,'pending',false,'private')
 returning id into v_provider_id;
 insert into public.provider_members(provider_id,user_id,role) values(v_provider_id,v_app.applicant_user_id,'owner');
 update public.provider_onboarding_applications set status='approved',assigned_provider_id=v_provider_id,reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now()
 where id=v_app.id;
 return v_provider_id;
end $function$
;
REVOKE EXECUTE ON FUNCTION public.accept_provider_invite(p_invite_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_provider_invite(p_invite_id uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.claim_provider_invite_email(p_invite_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_provider_invite_email(p_invite_id uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.create_provider_invite(p_provider_id uuid, p_email text, p_role text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_provider_invite(p_provider_id uuid, p_email text, p_role text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.current_provider_role(p_provider_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_provider_role(p_provider_id uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.is_platform_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.provider_has_capability(p_provider_id uuid, p_capability text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.provider_has_capability(p_provider_id uuid, p_capability text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.remove_provider_member(p_provider_id uuid, p_user_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_provider_member(p_provider_id uuid, p_user_id uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.review_provider_onboarding_application(p_application_id uuid, p_approve boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_provider_onboarding_application(p_application_id uuid, p_approve boolean) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.revoke_provider_invite(p_invite_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_provider_invite(p_invite_id uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.submit_provider_onboarding_application(p_business_name text, p_contact_email text, p_description text, p_website_url text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_provider_onboarding_application(p_business_name text, p_contact_email text, p_description text, p_website_url text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.update_provider_member_role(p_provider_id uuid, p_user_id uuid, p_role text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_provider_member_role(p_provider_id uuid, p_user_id uuid, p_role text) TO authenticated, service_role;
REVOKE TRUNCATE ON TABLE public."analytics_events" FROM PUBLIC, anon, authenticated;
REVOKE TRUNCATE ON TABLE public."gym_circuits" FROM PUBLIC, anon, authenticated;
REVOKE TRUNCATE ON TABLE public."gym_exercises" FROM PUBLIC, anon, authenticated;
REVOKE TRUNCATE ON TABLE public."gym_favorites" FROM PUBLIC, anon, authenticated;
REVOKE TRUNCATE ON TABLE public."gym_playlist_sources" FROM PUBLIC, anon, authenticated;
REVOKE TRUNCATE ON TABLE public."gym_settings" FROM PUBLIC, anon, authenticated;
REVOKE TRUNCATE ON TABLE public."media_health_issues" FROM PUBLIC, anon, authenticated;
REVOKE TRUNCATE ON TABLE public."provider_acquisition_requests" FROM PUBLIC, anon, authenticated;
REVOKE TRUNCATE ON TABLE public."provider_content_ownership" FROM PUBLIC, anon, authenticated;
REVOKE TRUNCATE ON TABLE public."provider_entitlements" FROM PUBLIC, anon, authenticated;
REVOKE TRUNCATE ON TABLE public."provider_invites" FROM PUBLIC, anon, authenticated;
REVOKE TRUNCATE ON TABLE public."provider_media_assets" FROM PUBLIC, anon, authenticated;
REVOKE TRUNCATE ON TABLE public."provider_members" FROM PUBLIC, anon, authenticated;
REVOKE TRUNCATE ON TABLE public."provider_onboarding_applications" FROM PUBLIC, anon, authenticated;
REVOKE TRUNCATE ON TABLE public."provider_storefronts" FROM PUBLIC, anon, authenticated;
REVOKE TRUNCATE ON TABLE public."providers" FROM PUBLIC, anon, authenticated;
REVOKE TRUNCATE ON TABLE public."shared_exercises" FROM PUBLIC, anon, authenticated;
REVOKE TRUNCATE ON TABLE public."user_program_status" FROM PUBLIC, anon, authenticated;
ALTER FUNCTION public.accept_provider_invite(p_invite_id uuid) SET search_path='';
ALTER FUNCTION public.claim_provider_invite_email(p_invite_id uuid) SET search_path='';
ALTER FUNCTION public.create_provider_invite(p_provider_id uuid, p_email text, p_role text) SET search_path='';
ALTER FUNCTION public.current_provider_role(p_provider_id uuid) SET search_path='';
ALTER FUNCTION public.is_platform_admin() SET search_path='';
ALTER FUNCTION public.provider_has_capability(p_provider_id uuid, p_capability text) SET search_path='';
ALTER FUNCTION public.remove_provider_member(p_provider_id uuid, p_user_id uuid) SET search_path='';
ALTER FUNCTION public.review_provider_onboarding_application(p_application_id uuid, p_approve boolean) SET search_path='';
ALTER FUNCTION public.revoke_provider_invite(p_invite_id uuid) SET search_path='';
ALTER FUNCTION public.submit_provider_onboarding_application(p_business_name text, p_contact_email text, p_description text, p_website_url text) SET search_path='';
ALTER FUNCTION public.update_provider_member_role(p_provider_id uuid, p_user_id uuid, p_role text) SET search_path='';
