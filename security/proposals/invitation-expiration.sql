-- Preserve existing acceptance protections; add expiry without resetting old invite age.
ALTER TABLE public.provider_invites ADD COLUMN expires_at timestamptz;
UPDATE public.provider_invites SET expires_at=created_at + interval '7 days';
ALTER TABLE public.provider_invites ALTER COLUMN expires_at SET NOT NULL,
 ALTER COLUMN expires_at SET DEFAULT (now() + interval '7 days');
ALTER TABLE public.provider_invites ADD CONSTRAINT provider_invites_expiry_window
 CHECK (expires_at > created_at AND expires_at <= created_at + interval '7 days');
CREATE OR REPLACE FUNCTION public.accept_provider_invite(p_invite_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_inv public.provider_invites%rowtype;
  v_email text := lower(coalesce(auth.jwt()->>'email',''));
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Sign in required';
  end if;
  select * into v_inv from public.provider_invites where id=p_invite_id for update;
  if v_inv.id is null then raise exception 'Invite not found'; end if;
  if v_inv.expires_at <= statement_timestamp() then raise exception 'Invite expired'; end if;
  if v_inv.status <> 'pending' then raise exception 'Invite is no longer pending'; end if;
  if v_email='' or lower(v_inv.email)<>v_email then raise exception 'This invite belongs to a different email address'; end if;
  if exists(select 1 from public.provider_members where provider_id=v_inv.provider_id and user_id=v_uid) then
    raise exception 'Already a member of this provider; invitations cannot change an existing role';
  end if;
  insert into public.provider_members(provider_id,user_id,role)
  values(v_inv.provider_id,v_uid,v_inv.role)
  on conflict(provider_id,user_id) do nothing;
  if not found then
    raise exception 'Already a member of this provider';
  end if;
  update public.provider_invites set status='accepted',accepted_at=now() where id=v_inv.id;
  return v_inv.provider_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.claim_provider_invite_email(p_invite_id uuid)
 RETURNS TABLE(invite_id uuid, recipient_email text, provider_name text, invited_role text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_inv public.provider_invites%rowtype;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select * into v_inv from public.provider_invites where id=p_invite_id for update;
 if v_inv.id is null then raise exception 'Invite not found'; end if;
 if (public.provider_has_capability(v_inv.provider_id,'members:manage') or public.is_platform_admin()) is not true then
   raise exception 'Not authorized to send this provider invitation';
 end if;
 if v_inv.expires_at <= statement_timestamp() then raise exception 'Invite expired'; end if;
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
