-- Security-definer profile commands execute as their database owner while the
-- caller's JWT still says authenticated. Check the effective database role
-- before the JWT role so authorized commands can perform scoped updates.

create or replace function public.guard_profile_authorization_fields()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  caller_role text := auth.role();
  can_manage boolean := false;
begin
  if current_user in ('postgres', 'supabase_admin')
     or caller_role = 'service_role' then
    return new;
  end if;

  if caller_id is null then
    raise exception 'PROFILE_UPDATE_FORBIDDEN';
  end if;

  if new.created_at is distinct from old.created_at then
    raise exception 'PROFILE_CREATED_AT_IMMUTABLE';
  end if;

  if new.organization_id is distinct from old.organization_id then
    raise exception 'PROFILE_ORGANIZATION_IMMUTABLE';
  end if;

  if caller_id = old.id then
    if new.role_id is distinct from old.role_id
      or new.is_active is distinct from old.is_active
      or new.email is distinct from old.email
    then
      raise exception 'PROFILE_SELF_AUTHORIZATION_FIELDS_FORBIDDEN';
    end if;
    return new;
  end if;

  can_manage :=
    public.user_has_permission('users.manage')
    or public.user_has_permission('agency.users.manage');
  if not can_manage or old.organization_id <> public.current_organization_id() then
    raise exception 'PROFILE_ADMIN_UPDATE_FORBIDDEN';
  end if;

  if not exists (
    select 1
    from public.roles target_role
    where target_role.id = new.role_id
      and target_role.organization_id = old.organization_id
  ) then
    raise exception 'PROFILE_ROLE_SCOPE_MISMATCH';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_profile_authorization_fields()
  from public, anon, authenticated;
grant execute on function public.guard_profile_authorization_fields()
  to service_role;
