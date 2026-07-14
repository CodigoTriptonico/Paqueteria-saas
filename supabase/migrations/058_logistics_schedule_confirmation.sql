-- A requested delivery time must be explicitly confirmed before its route can leave.

alter table public.shipment_logistics_tasks
  add column if not exists schedule_kind text,
  add column if not exists window_start_at timestamptz,
  add column if not exists window_end_at timestamptz,
  add column if not exists requested_schedule_at timestamptz,
  add column if not exists requested_by uuid references public.profiles (id) on delete set null,
  add column if not exists schedule_confirmation_status text not null default 'confirmed',
  add column if not exists schedule_confirmed_at timestamptz,
  add column if not exists schedule_confirmed_by uuid references public.profiles (id) on delete set null;

alter table public.shipment_logistics_tasks
  drop constraint if exists shipment_logistics_tasks_schedule_kind_check;

alter table public.shipment_logistics_tasks
  add constraint shipment_logistics_tasks_schedule_kind_check
  check (schedule_kind is null or schedule_kind in ('exact', 'range', 'from'));

alter table public.shipment_logistics_tasks
  drop constraint if exists shipment_logistics_tasks_schedule_confirmation_status_check;

alter table public.shipment_logistics_tasks
  add constraint shipment_logistics_tasks_schedule_confirmation_status_check
  check (schedule_confirmation_status in ('pending', 'confirmed'));

update public.shipment_logistics_tasks
set requested_schedule_at = coalesce(requested_schedule_at, scheduled_at),
    window_start_at = coalesce(window_start_at, scheduled_at),
    schedule_kind = case when scheduled_at is null then null else coalesce(schedule_kind, 'exact') end,
    schedule_confirmation_status = coalesce(schedule_confirmation_status, 'confirmed')
where scheduled_at is not null;

create index if not exists idx_logistics_tasks_org_window
  on public.shipment_logistics_tasks (organization_id, window_start_at, status);
