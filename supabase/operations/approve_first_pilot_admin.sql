-- Administrative operation, separate from installation.
-- The holder must explicitly approve admin for the sole first pilot account.
-- Refuses to proceed unless exactly one grant exists and it is enabled,
-- bound to a verified Google user, and still has no role. Do not rerun.
begin;

do $approval$
declare
  pilot_uid uuid;
begin
  select g.user_id into strict pilot_uid
  from nubyra_private.access_grants as g
  where g.enabled
    and g.role is null
    and g.user_id is not null
    and (select count(*) from nubyra_private.access_grants) = 1
  for update;

  if not nubyra_private._has_verified_google_identity(pilot_uid) then
    raise exception 'The pilot must have a verified Google identity.';
  end if;

  update nubyra_private.access_grants
  set role = 'admin', updated_at = now()
  where user_id = pilot_uid and enabled and role is null;

  if not found then
    raise exception 'The pilot grant changed; review before assigning admin.';
  end if;
exception
  when no_data_found or too_many_rows then
    raise exception 'Expected exactly one enabled, bound pilot grant without a role. Review the state.';
end;
$approval$;

select count(*) as admins_enabled
from nubyra_private.access_grants
where enabled and user_id is not null and role = 'admin';

commit;
