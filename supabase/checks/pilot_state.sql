-- Administrative, read-only check after adding pilot admission grants.
-- Returns counts only: no emails, identities, UUIDs or credentials.
select
  count(*) as grants_total,
  count(*) filter (
    where enabled and role is null and user_id is null
  ) as pending_unbound,
  count(*) filter (where role is not null) as assigned_roles,
  (select count(*) from auth.users) as auth_users
from nubyra_private.access_grants;
