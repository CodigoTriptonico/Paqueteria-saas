-- Plan base: 3 bodegas por cuenta.
-- Actualiza el default de organizations, rellena clientes sin límite y fija SCGS.

alter table public.organizations
  alter column settings set default '{"multi_warehouse_enabled": true, "max_warehouses": 3}'::jsonb;

-- Cuentas sin max_warehouses explícito → plan base 3.
update public.organizations o
set settings = jsonb_set(
  jsonb_set(
    coalesce(o.settings, '{}'::jsonb),
    '{max_warehouses}',
    '3'::jsonb,
    true
  ),
  '{multi_warehouse_enabled}',
  'true'::jsonb,
  true
)
where o.kind = 'client'
  and (o.settings->>'max_warehouses') is null;

-- Plan base de SCGS: 3 bodegas (aunque ya tuviera otro valor).
update public.organizations o
set settings = jsonb_set(
  jsonb_set(
    coalesce(o.settings, '{}'::jsonb),
    '{max_warehouses}',
    '3'::jsonb,
    true
  ),
  '{multi_warehouse_enabled}',
  'true'::jsonb,
  true
)
where lower(o.slug) = 'scgs'
   or lower(o.name) = 'scgs';
