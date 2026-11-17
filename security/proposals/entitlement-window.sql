-- Reviewed SQL change set, applied only in disposable local tests in this PR.
-- Product approval required: canceled retains finite paid-through access;
-- only comped may be intentionally open-ended. No synthetic identities here.
CREATE SCHEMA kinetosphere_security;
REVOKE ALL ON SCHEMA kinetosphere_security FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA kinetosphere_security TO authenticated;
CREATE FUNCTION kinetosphere_security.entitlement_effective(
 p_status text, p_starts_at timestamptz, p_ends_at timestamptz, p_at timestamptz
) RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce(p_status IN ('active','trialing','comped','canceled')
 AND p_starts_at <= p_at
 AND (p_ends_at IS NULL OR p_ends_at > p_starts_at)
 AND (p_ends_at IS NULL OR p_at < p_ends_at)
 AND (p_status='comped' OR p_ends_at IS NOT NULL), false);
$$;
REVOKE ALL ON FUNCTION kinetosphere_security.entitlement_effective(text,timestamptz,timestamptz,timestamptz) FROM PUBLIC, anon, authenticated;
