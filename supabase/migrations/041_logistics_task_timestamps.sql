-- Phase timestamps for logistics tasks (ordered, assigned, loaded)

alter table public.shipment_logistics_tasks
  add column if not exists ordered_at timestamptz,
  add column if not exists assigned_at timestamptz,
  add column if not exists loaded_at timestamptz;

update public.shipment_logistics_tasks
set ordered_at = created_at
where ordered_at is null
  and status <> 'cancelled';
