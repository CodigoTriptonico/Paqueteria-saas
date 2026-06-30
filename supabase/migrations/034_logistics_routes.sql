-- Operational logistics routes and geocoded local addresses

alter table public.customers
  add column if not exists place_id text,
  add column if not exists formatted_address text,
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists geo_updated_at timestamptz;

alter table public.customer_recipients
  add column if not exists place_id text,
  add column if not exists formatted_address text,
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists geo_updated_at timestamptz;

create index if not exists idx_customers_org_geo
  on public.customers (organization_id, lat, lng)
  where lat is not null and lng is not null;

create index if not exists idx_customer_recipients_org_geo
  on public.customer_recipients (organization_id, lat, lng)
  where lat is not null and lng is not null;

create table if not exists public.logistics_routes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  route_date date not null,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'planned', 'cancelled', 'completed')),
  assigned_to uuid references public.profiles (id) on delete set null,
  warehouse_id uuid references public.warehouses (id) on delete set null,
  zone_key text not null default '',
  notes text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.logistics_route_stops (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  route_id uuid not null references public.logistics_routes (id) on delete cascade,
  task_id uuid not null references public.shipment_logistics_tasks (id) on delete cascade,
  stop_order integer not null default 0,
  address_snapshot jsonb not null default '{}'::jsonb,
  lat double precision,
  lng double precision,
  postal_code text not null default '',
  city text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_id)
);

create index if not exists idx_logistics_routes_org_date
  on public.logistics_routes (organization_id, route_date desc, created_at desc);

create index if not exists idx_logistics_routes_assigned
  on public.logistics_routes (assigned_to, status);

create index if not exists idx_logistics_route_stops_route
  on public.logistics_route_stops (route_id, stop_order);

create index if not exists idx_logistics_route_stops_task
  on public.logistics_route_stops (task_id);

alter table public.logistics_routes enable row level security;
alter table public.logistics_route_stops enable row level security;

drop policy if exists logistics_routes_select on public.logistics_routes;
create policy logistics_routes_select on public.logistics_routes for select
  using (
    organization_id = public.current_organization_id()
    and public.user_has_permission('routes.view')
    and (
      public.current_role_slug() <> 'conductor'
      or assigned_to = auth.uid()
    )
  );

drop policy if exists logistics_routes_write on public.logistics_routes;
create policy logistics_routes_write on public.logistics_routes for all
  using (
    organization_id = public.current_organization_id()
    and (
      public.user_has_permission('routes.update_status')
      or public.user_has_permission('sales.manage')
    )
  )
  with check (
    organization_id = public.current_organization_id()
    and (
      public.user_has_permission('routes.update_status')
      or public.user_has_permission('sales.manage')
    )
  );

drop policy if exists logistics_route_stops_select on public.logistics_route_stops;
create policy logistics_route_stops_select on public.logistics_route_stops for select
  using (
    organization_id = public.current_organization_id()
    and public.user_has_permission('routes.view')
  );

drop policy if exists logistics_route_stops_write on public.logistics_route_stops;
create policy logistics_route_stops_write on public.logistics_route_stops for all
  using (
    organization_id = public.current_organization_id()
    and (
      public.user_has_permission('routes.update_status')
      or public.user_has_permission('sales.manage')
    )
  )
  with check (
    organization_id = public.current_organization_id()
    and (
      public.user_has_permission('routes.update_status')
      or public.user_has_permission('sales.manage')
    )
  );
