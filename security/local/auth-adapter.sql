-- LOCAL-ONLY adapter for the missing Auth schema. NOT a full Auth service.
-- uid/jwt bodies from supabase/auth commit 10ef10789d1ee4fb422b448047e67e3e264c0482:
-- migrations/20220224000811_update_auth_functions.up.sql and
-- migrations/20220531120530_add_auth_jwt_function.up.sql (namespace resolved to auth).
CREATE ROLE anon NOLOGIN NOBYPASSRLS;
CREATE ROLE authenticated NOLOGIN NOBYPASSRLS;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE authenticator LOGIN NOINHERIT NOBYPASSRLS;
GRANT anon, authenticated TO authenticator;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
 (nullif(current_setting('request.jwt.claims',true),'')::jsonb ->> 'sub'))::uuid
$$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT coalesce(nullif(current_setting('request.jwt.claim',true),''),
 nullif(current_setting('request.jwt.claims',true),''))::jsonb
$$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid(), auth.jwt() TO anon, authenticated, service_role;
