-- Physical custody of every full box from collection through warehouse and pallet.

insert into public.permissions (key, name, description) values
  ('warehouse.operations', 'OperaciÃ³n de bodega', 'Ingresar, revisar y clasificar cajas fÃ­sicas'),
  ('pallets.manage', 'Paletas', 'Crear paletas y mover cajas entre ellas')
on conflict (key) do nothing;

create table if not exists public.shipment_packages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  code text not null,
  country text not null default '',
  status text not null default 'awaiting_full_box' check (status in (
    'awaiting_full_box', 'pending_intake', 'warehouse_intake', 'in_warehouse', 'on_pallet', 'handed_to_carrier'
  )),
  collection_weight_kg numeric,
  collection_source text check (collection_source in ('driver', 'office')),
  collection_recorded_at timestamptz,
  collection_recorded_by uuid references public.profiles(id) on delete set null,
  intake_weight_kg numeric,
  intake_recorded_at timestamptz,
  intake_recorded_by uuid references public.profiles(id) on delete set null,
  weight_difference_kg numeric,
  weight_difference_note text not null default '',
  contents jsonb not null default '[]'::jsonb,
  contents_validated_at timestamptz,
  contents_validated_by uuid references public.profiles(id) on delete set null,
  provider_name text not null default '',
  provider_service text not null default '',
  provider_confirmation_number text not null default '',
  provider_tracking_number text not null default '',
  provider_tracking_url text not null default '',
  pallet_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table if not exists public.warehouse_pallets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  country text not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

alter table public.shipment_packages
  add constraint shipment_packages_pallet_id_fkey
  foreign key (pallet_id) references public.warehouse_pallets(id) on delete set null;

create index if not exists idx_shipment_packages_org_status
  on public.shipment_packages(organization_id, status, created_at desc);
create index if not exists idx_shipment_packages_shipment
  on public.shipment_packages(shipment_id);
create index if not exists idx_warehouse_pallets_org_country
  on public.warehouse_pallets(organization_id, country, status);

alter table public.shipment_packages enable row level security;
alter table public.warehouse_pallets enable row level security;

create policy shipment_packages_select on public.shipment_packages for select
  using (organization_id = public.current_organization_id()
    and (public.user_has_permission('sales.manage') or public.user_has_permission('routes.view') or public.user_has_permission('warehouse.operations')));
create policy shipment_packages_write on public.shipment_packages for all
  using (organization_id = public.current_organization_id()
    and (public.user_has_permission('sales.manage') or public.user_has_permission('routes.update_status') or public.user_has_permission('warehouse.operations')))
  with check (organization_id = public.current_organization_id()
    and (public.user_has_permission('sales.manage') or public.user_has_permission('routes.update_status') or public.user_has_permission('warehouse.operations')));

create policy warehouse_pallets_select on public.warehouse_pallets for select
  using (organization_id = public.current_organization_id()
    and (public.user_has_permission('warehouse.operations') or public.user_has_permission('pallets.manage')));
create policy warehouse_pallets_write on public.warehouse_pallets for all
  using (organization_id = public.current_organization_id() and public.user_has_permission('pallets.manage'))
  with check (organization_id = public.current_organization_id() and public.user_has_permission('pallets.manage'));
