-- Ensure every organization has the base driver role for logistics.

insert into public.permissions (key, name, description) values
  ('routes.view', 'Ver rutas', 'Ver envios asignados'),
  ('routes.update_status', 'Estado envio', 'Cambiar estado de envios')
on conflict (key) do nothing;

do $$
declare
  org record;
  role_driver uuid;
begin
  for org in select id from public.organizations loop
    insert into public.roles (organization_id, slug, name, is_system)
    values (org.id, 'conductor', 'Conductor', true)
    on conflict (organization_id, slug)
    do update set name = excluded.name, is_system = true
    returning id into role_driver;

    insert into public.role_permissions (role_id, permission_id, granted)
    select role_driver, perm.id, true
    from public.permissions perm
    where perm.key in ('routes.view', 'routes.update_status')
    on conflict (role_id, permission_id)
    do update set granted = excluded.granted;
  end loop;
end $$;
