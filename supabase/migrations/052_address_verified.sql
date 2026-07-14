-- Geocoded addresses are only valid for routing after an explicit verification.

alter table public.customers
  add column if not exists address_verified boolean not null default false;

alter table public.customer_recipients
  add column if not exists address_verified boolean not null default false;

alter table public.warehouses
  add column if not exists address_verified boolean not null default false;

create index if not exists idx_warehouses_org_geo
  on public.warehouses (organization_id, lat, lng)
  where lat is not null and lng is not null;
