-- company_logo_path may only point at this organization's storage folder.
-- Blocks IDOR where a tenant points settings at another org's object and later
-- receives a service-role signed URL for it.

create or replace function public.protect_organization_plan_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_settings jsonb := coalesce(OLD.settings, '{}'::jsonb);
  new_settings jsonb := coalesce(NEW.settings, '{}'::jsonb);
  logo_path text;
  org_prefix text := NEW.id::text;
begin
  if auth.role() = 'service_role'
     or auth.uid() is null
     or public.is_platform_admin() then
    return NEW;
  end if;

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

  logo_path := btrim(coalesce(new_settings ->> 'company_logo_path', ''));
  if logo_path = '' then
    new_settings := new_settings - 'company_logo_path';
  elsif logo_path = org_prefix
     or logo_path like (org_prefix || '/%') then
    if position('..' in logo_path) > 0 or position('\' in logo_path) > 0 then
      if old_settings ? 'company_logo_path' then
        new_settings := jsonb_set(new_settings, '{company_logo_path}', old_settings -> 'company_logo_path', true);
      else
        new_settings := new_settings - 'company_logo_path';
      end if;
    end if;
  else
    if old_settings ? 'company_logo_path' then
      new_settings := jsonb_set(new_settings, '{company_logo_path}', old_settings -> 'company_logo_path', true);
    else
      new_settings := new_settings - 'company_logo_path';
    end if;
  end if;

  NEW.settings := new_settings;
  return NEW;
end;
$$;

comment on function public.protect_organization_plan_settings() is
  'Locks plan caps and agencies_enabled; company_logo_path must stay under this organization id.';
