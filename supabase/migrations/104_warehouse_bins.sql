-- Internal warehouse locations (zone / aisle / shelf) with per-item quantities.

create table if not exists public.warehouse_bins (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  warehouse_id uuid not null references public.warehouses (id) on delete cascade,
  zone text not null default '',
  aisle text not null default '',
  shelf text not null default '',
  code text not null,
  label text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (warehouse_id, code)
);

create index if not exists idx_warehouse_bins_org_wh
  on public.warehouse_bins (organization_id, warehouse_id, is_active, sort_order);

create table if not exists public.inventory_bin_stock (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  warehouse_id uuid not null references public.warehouses (id) on delete cascade,
  bin_id uuid not null references public.warehouse_bins (id) on delete cascade,
  item_id uuid not null references public.inventory_items (id) on delete cascade,
  quantity numeric not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  unique (bin_id, item_id)
);

create index if not exists idx_inventory_bin_stock_item
  on public.inventory_bin_stock (warehouse_id, item_id);

alter table public.warehouse_bins enable row level security;
alter table public.inventory_bin_stock enable row level security;

create policy warehouse_bins_select on public.warehouse_bins for select
  using (
    organization_id = public.current_organization_id()
    and public.user_has_permission('inventory.view')
    and public.user_can_access_warehouse(warehouse_id)
  );

create policy warehouse_bins_write on public.warehouse_bins for all
  using (
    organization_id = public.current_organization_id()
    and public.user_can_access_warehouse(warehouse_id)
    and (
      public.user_has_permission('warehouses.manage')
      or public.user_has_permission('inventory.adjust')
    )
  )
  with check (
    organization_id = public.current_organization_id()
    and public.user_can_access_warehouse(warehouse_id)
    and (
      public.user_has_permission('warehouses.manage')
      or public.user_has_permission('inventory.adjust')
    )
  );

create policy inventory_bin_stock_select on public.inventory_bin_stock for select
  using (
    organization_id = public.current_organization_id()
    and public.user_has_permission('inventory.view')
    and public.user_can_access_warehouse(warehouse_id)
  );

create policy inventory_bin_stock_write on public.inventory_bin_stock for all
  using (
    organization_id = public.current_organization_id()
    and public.user_can_access_warehouse(warehouse_id)
    and public.user_has_permission('inventory.adjust')
  )
  with check (
    organization_id = public.current_organization_id()
    and public.user_can_access_warehouse(warehouse_id)
    and public.user_has_permission('inventory.adjust')
  );
