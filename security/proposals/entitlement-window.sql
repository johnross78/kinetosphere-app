-- REVIEW-ONLY MIGRATION DRAFT. Not a Supabase migration and not deployment-ready.
-- New helper API proposed here; no existing function signature is assumed.
BEGIN;
DO $$ BEGIN
  RAISE EXCEPTION 'BLOCKED: schema, status enum, time types, callers and product rules require verification; see security/README.md';
END $$;

-- Candidate pure predicate, intended for a verified non-exposed schema.
-- Schema creation/ownership/grants must be resolved in the final migration.
CREATE FUNCTION __verified_private_schema__.entitlement_effective(
  p_status text, p_starts_at timestamptz, p_ends_at timestamptz,
  p_at timestamptz
) RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER
SET search_path = '' AS $$
  SELECT coalesce(
    p_status IN ('active', 'trialing', 'comped', 'canceled')
    AND p_starts_at IS NOT NULL AND p_starts_at <= p_at
    AND (p_ends_at IS NULL OR p_ends_at > p_starts_at)
    AND (p_ends_at IS NULL OR p_at < p_ends_at)
    -- Only complimentary access may intentionally have no end date.
    AND (p_status = 'comped' OR p_ends_at IS NOT NULL), false
  );
$$;
-- canceled_at records cancellation intent, not an early cutoff. Immediate
-- revocation must use a non-allowlisted status after verification of enum values.
-- Grant helper invocation only to roles demonstrated to need it through policies.
-- This predicate does not establish ownership/provider identity by itself.
ROLLBACK;
