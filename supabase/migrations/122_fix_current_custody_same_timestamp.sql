-- A transaction can create and receive a package within the same database timestamp.
-- Prefer the custody event matching the package's current physical status before UUID order.

create or replace view public.package_custody_current
with (security_invoker = true) as
select distinct on (event.package_id)
  event.package_id, event.shipment_id, event.organization_id,
  event.to_holder_type as holder_type, event.to_holder_id as holder_id,
  event.to_holder_label as holder_label, event.package_status,
  event.actor_id, event.occurred_at, event.id as custody_event_id
from public.package_custody_events event
join public.shipment_packages package on package.id = event.package_id
order by event.package_id,
  (event.package_status = package.status) desc,
  event.occurred_at desc,
  event.created_at desc,
  event.id desc;
