-- Vacío en profile_warehouses = sin acceso. Solo administrador accede a todas sin asignación.

create or replace function public.user_can_access_warehouse(wh_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  org_id uuid;
begin
  if auth.uid() is null then
    return false;
  end if;

  select organization_id into org_id from public.profiles where id = auth.uid();

  if not exists (
    select 1 from public.warehouses w
    where w.id = wh_id and w.organization_id = org_id and w.is_active = true
  ) then
    return false;
  end if;

  if public.current_role_slug() = 'administrador' then
    return true;
  end if;

  return exists (
    select 1 from public.profile_warehouses pw
    where pw.profile_id = auth.uid() and pw.warehouse_id = wh_id
  );
end;
$$;
