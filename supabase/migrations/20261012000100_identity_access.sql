-- NUBYRA login: identity and authorization, prepared for a dedicated Supabase project.
-- Apply once through an administrative migration after a schema/back-up review.
-- No pilot addresses or role decisions are stored in this migration.

begin;

create schema nubyra_private;
revoke all on schema nubyra_private from public, anon, authenticated;
grant usage on schema nubyra_private to authenticated, supabase_auth_admin;

create table nubyra_private.access_grants (
  email text primary key,
  user_id uuid unique references auth.users(id) on delete cascade,
  role text check (role in ('admin', 'editor', 'lector')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint access_grants_email_normalized
    check (email = pg_catalog.lower(pg_catalog.btrim(email)) and email <> '')
);

alter table nubyra_private.access_grants enable row level security;
revoke all on nubyra_private.access_grants from public, anon, authenticated;
grant select (email, user_id, enabled)
  on nubyra_private.access_grants to supabase_auth_admin;
create policy nubyra_auth_hook_read_grants
  on nubyra_private.access_grants
  for select
  to supabase_auth_admin
  using (true);

-- Auth identity data is managed by Supabase Auth. A missing verification flag fails closed.
-- This function lives outside the PostgREST exposed schema.
create function nubyra_private._has_verified_google_identity(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.identities as i
    where i.user_id = p_uid
      and i.provider = 'google'
      and i.email is not null
      and i.identity_data ->> 'email_verified' = 'true'
  );
$$;

revoke all on function nubyra_private._has_verified_google_identity(uuid)
  from public, anon, authenticated;
-- No direct authenticated grant: only other definer functions call it.

create function nubyra_private._resolve_my_access()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_enabled boolean;
  v_role text;
begin
  if v_uid is null or not nubyra_private._has_verified_google_identity(v_uid) then
    return pg_catalog.jsonb_build_object('status', 'denied', 'role', null);
  end if;

  select g.enabled, g.role
    into v_enabled, v_role
    from nubyra_private.access_grants as g
   where g.user_id = v_uid;

  if not found then
    -- Require one unambiguous verified Google address. No user metadata or
    -- client-supplied identity participates. Lower/trim only; no Gmail aliases.
    select pg_catalog.min(pg_catalog.lower(pg_catalog.btrim(i.email)))
      into v_email
      from auth.identities as i
     where i.user_id = v_uid
       and i.provider = 'google'
       and i.email is not null
       and i.identity_data ->> 'email_verified' = 'true'
    having pg_catalog.count(distinct pg_catalog.lower(pg_catalog.btrim(i.email))) = 1;

    if v_email is not null then
      -- The unique email and user_id constraints, plus this conditional update,
      -- prevent two users or simultaneous callbacks claiming a row twice.
      update nubyra_private.access_grants as g
         set user_id = v_uid, updated_at = now()
       where g.email = v_email and g.user_id is null;
    end if;

    select g.enabled, g.role
      into v_enabled, v_role
      from nubyra_private.access_grants as g
     where g.user_id = v_uid;
  end if;

  if not found or not v_enabled then
    return pg_catalog.jsonb_build_object('status', 'denied', 'role', null);
  end if;

  if v_role is null then
    return pg_catalog.jsonb_build_object('status', 'pending', 'role', null);
  end if;

  return pg_catalog.jsonb_build_object('status', 'active', 'role', v_role);
end;
$$;

revoke all on function nubyra_private._resolve_my_access()
  from public, anon, authenticated;
grant execute on function nubyra_private._resolve_my_access() to authenticated;

-- The public RPC is an invoker wrapper. The privileged body remains private.
create function public.resolve_my_access()
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select nubyra_private._resolve_my_access();
$$;

revoke all on function public.resolve_my_access() from public, anon, authenticated;
grant execute on function public.resolve_my_access() to authenticated;

-- Before User Created: Auth supplies the proposed user, but the identity has
-- not yet been persisted. The RPC above revalidates the Google identity.
create function nubyra_private.before_user_created(event jsonb)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_email text := pg_catalog.lower(pg_catalog.btrim(event -> 'user' ->> 'email'));
  v_provider text := event -> 'user' -> 'app_metadata' ->> 'provider';
begin
  if v_provider = 'google'
     and v_email is not null
     and exists (
       select 1
         from nubyra_private.access_grants as g
        where g.email = v_email
          and g.enabled
          and g.user_id is null
     ) then
    return '{}'::jsonb;
  end if;

  return pg_catalog.jsonb_build_object(
    'error', pg_catalog.jsonb_build_object(
      'http_code', 403,
      'message', 'This account is not admitted to NUBYRA.'
    )
  );
end;
$$;

revoke all on function nubyra_private.before_user_created(jsonb)
  from public, anon, authenticated;
grant execute on function nubyra_private.before_user_created(jsonb)
  to supabase_auth_admin;

-- Isolated, fictional resource for direct API/RLS acceptance tests only.
create table public.nubyra_access_probe (
  id integer primary key check (id = 1),
  marker text not null check (marker = 'nubyra-access-ok')
);
insert into public.nubyra_access_probe (id, marker)
values (1, 'nubyra-access-ok');

alter table public.nubyra_access_probe enable row level security;
revoke all on public.nubyra_access_probe from public, anon, authenticated;
grant select on public.nubyra_access_probe to authenticated;

create function nubyra_private._is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
     and nubyra_private._has_verified_google_identity(auth.uid())
     and exists (
       select 1
         from nubyra_private.access_grants as g
        where g.user_id = auth.uid()
          and g.enabled
          and g.role is not null
     );
$$;

revoke all on function nubyra_private._is_active()
  from public, anon, authenticated;
grant execute on function nubyra_private._is_active() to authenticated;

create policy nubyra_access_probe_active_read
  on public.nubyra_access_probe
  for select
  to authenticated
  using ((select nubyra_private._is_active()));

commit;
