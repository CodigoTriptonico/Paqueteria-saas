-- Lock plan entitlement keys in organizations.settings.
-- Tenant users with settings.manage can update branding / onboarding flags,
-- but must not raise max_users, max_warehouses, or flip agencies_enabled.

create or replace function public.protect_organization_plan_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_settings jsonb := coalesce(OLD.settings, '{}'::jsonb);
  new_settings jsonb := coalesce(NEW.settings, '{}'::jsonb);
begin
  -- Privileged writers:
  -- - service_role (Supabase admin API used by platform actions)
  -- - no end-user JWT (direct postgres / migrations / maintenance scripts)
  -- - platform_admins row for the current auth.uid()
  if auth.role() = 'service_role'
     or auth.uid() is null
     or public.is_platform_admin() then
    return NEW;
  end if;

  -- Restore entitlement keys from the previous row (presence + value).
  if old_settings ? 'max_users' then
    new_settings := jsonb_set(new_settings, '{max_users}', old_settings -> 'max_users', true);
  else
    new_settings := new_settings - 'max_users';
  end if;

  if old_settings ? 'max_warehouses' then
    new_settings := jsonb_set(new_settings, '{max_warehouses}', old_settings -> 'max_warehouses', true);
  else
    new_settings := new_settings - 'max_warehouses';
  end if;

  if old_settings ? 'agencies_enabled' then
    new_settings := jsonb_set(new_settings, '{agencies_enabled}', old_settings -> 'agencies_enabled', true);
  else
    new_settings := new_settings - 'agencies_enabled';
  end if;

  NEW.settings := new_settings;
  return NEW;
end;
$$;

drop trigger if exists organizations_protect_plan_settings on public.organizations;

create trigger organizations_protect_plan_settings
  before update of settings on public.organizations
  for each row
  execute function public.protect_organization_plan_settings();

comment on function public.protect_organization_plan_settings() is
  'Keeps max_users, max_warehouses, and agencies_enabled immutable for non-platform actors.';
