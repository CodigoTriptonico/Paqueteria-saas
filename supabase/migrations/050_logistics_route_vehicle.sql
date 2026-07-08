-- Assign fleet vehicles to operational logistics routes

alter table public.logistics_routes
  add column if not exists vehicle_id uuid references public.logistics_vehicles (id) on delete set null;

create index if not exists idx_logistics_routes_vehicle
  on public.logistics_routes (vehicle_id)
  where vehicle_id is not null;
