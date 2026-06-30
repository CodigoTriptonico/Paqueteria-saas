-- Link empty-box delivery and full-box pickup to the same route days/ranges.

alter table public.organization_route_settings
  add column if not exists linked_route_schedules boolean not null default false;
