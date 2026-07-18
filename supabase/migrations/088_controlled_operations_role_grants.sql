-- Extend the controlled-operation templates after 087 has created its permissions.
insert into public.role_permissions (role_id, permission_id, granted)
select role.id, permission.id, true
from public.roles role
join public.permissions permission on permission.key in (
  'package.custody.view', 'package.custody.transfer', 'package.custody.receive', 'exceptions.report'
)
where role.slug in ('conductor', 'bodega', 'logistica', 'operador_agencia')
on conflict (role_id, permission_id) do update set granted = excluded.granted;
