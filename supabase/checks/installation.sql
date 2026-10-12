-- NUBYRA: run AFTER installing the migration, in an administrative SQL session.
-- Read-only structural checks. No accounts, roles or data are created/modified.
-- All rows should have passed=true. This does not prove real OAuth or JWT/RLS.

with checks (check_name, passed) as (
  values
    ('private_schema_exists', to_regnamespace('nubyra_private') is not null),
    ('private_grants_table_exists', to_regclass('nubyra_private.access_grants') is not null),
    ('public_resolver_exists', to_regprocedure('public.resolve_my_access()') is not null),
    ('admission_hook_exists', to_regprocedure('nubyra_private.before_user_created(jsonb)') is not null),
    ('probe_exists', to_regclass('public.nubyra_access_probe') is not null),
    ('authenticated_can_resolve_access', has_function_privilege('authenticated', 'public.resolve_my_access()', 'EXECUTE')),
    ('anon_cannot_resolve_access', not has_function_privilege('anon', 'public.resolve_my_access()', 'EXECUTE')),
    ('authenticated_cannot_call_admission_hook', not has_function_privilege('authenticated', 'nubyra_private.before_user_created(jsonb)', 'EXECUTE')),
    ('auth_admin_can_call_admission_hook', has_function_privilege('supabase_auth_admin', 'nubyra_private.before_user_created(jsonb)', 'EXECUTE')),
    ('clients_cannot_access_private_grants',
      not has_table_privilege('anon', 'nubyra_private.access_grants', 'SELECT,INSERT,UPDATE,DELETE')
      and not has_table_privilege('authenticated', 'nubyra_private.access_grants', 'SELECT,INSERT,UPDATE,DELETE')),
    ('auth_admin_can_read_hook_columns',
      has_column_privilege('supabase_auth_admin', 'nubyra_private.access_grants', 'email', 'SELECT')
      and has_column_privilege('supabase_auth_admin', 'nubyra_private.access_grants', 'user_id', 'SELECT')
      and has_column_privilege('supabase_auth_admin', 'nubyra_private.access_grants', 'enabled', 'SELECT')),
    ('authenticated_can_select_probe', has_table_privilege('authenticated', 'public.nubyra_access_probe', 'SELECT')),
    ('clients_cannot_modify_probe',
      not has_table_privilege('anon', 'public.nubyra_access_probe', 'SELECT,INSERT,UPDATE,DELETE')
      and not has_table_privilege('authenticated', 'public.nubyra_access_probe', 'INSERT,UPDATE,DELETE')),
    ('private_grants_rls_enabled', (select relrowsecurity from pg_catalog.pg_class where oid = to_regclass('nubyra_private.access_grants'))),
    ('probe_rls_enabled', (select relrowsecurity from pg_catalog.pg_class where oid = to_regclass('public.nubyra_access_probe')))
)
select check_name, passed from checks order by check_name;
