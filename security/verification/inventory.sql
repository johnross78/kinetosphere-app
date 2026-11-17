-- Catalog-only queries for the owner's approved export process; NOT executed here.
-- Review/redact output before committing. No user-table data is queried.
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;

SELECT n.nspname, c.relname, c.relkind, c.relrowsecurity, c.relforcerowsecurity,
       c.relacl, c.reloptions
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public', 'storage')
ORDER BY n.nspname, c.relname;

SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS arguments,
       pg_get_userbyid(p.proowner) AS owner, p.prosecdef, p.proconfig, p.proacl,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prokind = 'f'
ORDER BY p.proname, arguments;

SELECT defaclrole::regrole, defaclnamespace::regnamespace, defaclobjtype, defaclacl
FROM pg_default_acl;

SELECT nspname, nspacl FROM pg_namespace WHERE nspname IN ('public', 'storage');
-- Include exact DDL/dependencies via a reviewed schema-only export. These queries
-- alone do not capture the full schema, auth settings or external-media controls.
