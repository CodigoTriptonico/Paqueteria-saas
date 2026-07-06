create table if not exists public.logistics_vehicles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  plate text not null default '',
  photo_url text not null default '',
  cargo_box_size text not null default '',
  cargo_capacity text not null default '',
  notes text not null default '',
  assigned_driver_id uuid references public.profiles (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_logistics_vehicles_org
  on public.logistics_vehicles (organization_id, is_active, name);

create unique index if not exists idx_logistics_vehicles_org_plate_unique
  on public.logistics_vehicles (organization_id, lower(plate))
  where plate <> '';

create unique index if not exists idx_logistics_vehicles_driver_unique
  on public.logistics_vehicles (organization_id, assigned_driver_id)
  where assigned_driver_id is not null and is_active = true;

alter table public.logistics_vehicles enable row level security;

drop policy if exists logistics_vehicles_select on public.logistics_vehicles;
create policy logistics_vehicles_select on public.logistics_vehicles for select
  using (
    organization_id = public.current_organization_id()
    and public.user_has_permission('routes.view')
  );

drop policy if exists logistics_vehicles_write on public.logistics_vehicles;
create policy logistics_vehicles_write on public.logistics_vehicles for all
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
