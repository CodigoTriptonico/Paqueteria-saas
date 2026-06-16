-- Reparar límites de bodegas inconsistentes con el uso real.

-- Subir max_warehouses cuando hay más bodegas que el límite registrado.
update public.organizations o
set settings = jsonb_set(
  coalesce(o.settings, '{}'::jsonb),
  '{max_warehouses}',
  to_jsonb(w.cnt),
  true
)
from (
  select organization_id, count(*)::int as cnt
  from public.warehouses
  group by organization_id
) w
where o.id = w.organization_id
  and o.kind = 'client'
  and coalesce((o.settings->>'max_warehouses')::int, 0) < w.cnt;

-- Default para clientes sin max_warehouses explícito.
update public.organizations o
set settings = jsonb_set(
  coalesce(o.settings, '{}'::jsonb),
  '{max_warehouses}',
  '5'::jsonb,
  true
)
where o.kind = 'client'
  and (o.settings->>'max_warehouses') is null;

-- Desactivar hub si el plan solo permite una bodega.
update public.organizations o
set settings = jsonb_set(
  coalesce(o.settings, '{}'::jsonb),
  '{multi_warehouse_enabled}',
  'false'::jsonb,
  true
)
where o.kind = 'client'
  and coalesce((o.settings->>'multi_warehouse_enabled')::boolean, false) = true
  and coalesce((o.settings->>'max_warehouses')::int, 1) <= 1;
