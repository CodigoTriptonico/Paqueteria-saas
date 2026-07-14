-- Connect generated operational routes with their reusable weekly template.

alter table public.logistics_routes
  add column if not exists route_template_id uuid references public.logistics_route_templates (id) on delete set null;

create unique index if not exists logistics_routes_template_date_uidx
  on public.logistics_routes (organization_id, route_template_id, route_date)
  where route_template_id is not null and status <> 'cancelled';
