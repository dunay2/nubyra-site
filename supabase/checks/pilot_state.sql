-- Administrative, read-only check after adding pilot admission grants.
-- Returns counts only: no emails, identities, UUIDs or credentials.
select
  count(*) as grants_total,
  count(*) filter (
    where enabled and role is null and user_id is null
  ) as pending_unbound,
  count(*) filter (
    where enabled and role is null and user_id is not null
  ) as pending_bound,
  count(*) filter (where role is not null) as assigned_roles,
  (select count(*) from auth.users) as auth_users,
  (
    select count(distinct user_id)
    from auth.identities
    where provider = 'google'
      and identity_data ->> 'email_verified' = 'true'
  ) as verified_google_users
from nubyra_private.access_grants;
