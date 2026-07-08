-- Prevent duplicate deliver events for the same task and box line.
CREATE UNIQUE INDEX IF NOT EXISTS logistics_truck_deliver_task_line_uidx
ON public.logistics_truck_inventory_events (
  organization_id,
  assigned_driver_id,
  task_id,
  catalog_key,
  item_label
)
WHERE event_type = 'deliver' AND task_id IS NOT NULL;
