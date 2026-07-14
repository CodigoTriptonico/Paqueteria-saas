-- Track the physical handoff from a completed route through unloading, warehouse placement and palletization.

alter table public.shipment_packages
  add column if not exists truck_route_id uuid references public.logistics_routes(id) on delete set null,
  add column if not exists truck_task_id uuid references public.shipment_logistics_tasks(id) on delete set null,
  add column if not exists truck_arrived_at timestamptz,
  add column if not exists truck_unloaded_at timestamptz,
  add column if not exists truck_unloaded_by uuid references public.profiles(id) on delete set null,
  add column if not exists warehouse_placed_at timestamptz,
  add column if not exists warehouse_placed_by uuid references public.profiles(id) on delete set null,
  add column if not exists palletized_at timestamptz,
  add column if not exists palletized_by uuid references public.profiles(id) on delete set null;

alter table public.shipment_packages
  drop constraint if exists shipment_packages_status_check;

alter table public.shipment_packages
  add constraint shipment_packages_status_check check (status in (
    'awaiting_full_box', 'in_truck', 'pending_intake', 'warehouse_intake',
    'in_warehouse', 'on_pallet', 'handed_to_carrier'
  ));

create index if not exists idx_shipment_packages_truck_route
  on public.shipment_packages(organization_id, truck_route_id, status)
  where truck_route_id is not null;
