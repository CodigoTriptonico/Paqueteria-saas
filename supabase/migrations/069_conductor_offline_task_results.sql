-- Durable client identity for conductor results queued on a phone.
alter table public.shipment_logistics_task_attempts
  add column if not exists client_operation_id uuid,
  add column if not exists captured_at timestamptz;

create unique index if not exists shipment_task_attempts_client_operation_uidx
  on public.shipment_logistics_task_attempts (organization_id, client_operation_id)
  where client_operation_id is not null;

-- Later code records full-box collection and unload events. Keep clean installs aligned
-- with the event types already used by the application and indexed in migration 059.
alter table public.logistics_truck_inventory_events
  drop constraint if exists logistics_truck_inventory_events_event_type_check;

alter table public.logistics_truck_inventory_events
  add constraint logistics_truck_inventory_events_event_type_check
  check (event_type in (
    'load',
    'deliver',
    'return',
    'adjust',
    'collect_full_box',
    'unload_full_box'
  ));
