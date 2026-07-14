-- Operational lifecycle and released-stop history for logistics routes.

alter table public.logistics_routes
  add column if not exists published_at timestamptz,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists published_by uuid references public.profiles (id) on delete set null,
  add column if not exists started_by uuid references public.profiles (id) on delete set null,
  add column if not exists completed_by uuid references public.profiles (id) on delete set null;

alter table public.logistics_routes
  drop constraint if exists logistics_routes_status_check;

alter table public.logistics_routes
  add constraint logistics_routes_status_check
  check (status in ('draft', 'planned', 'in_progress', 'cancelled', 'completed'));

alter table public.logistics_route_stops
  add column if not exists outcome text,
  add column if not exists outcome_at timestamptz,
  add column if not exists released_at timestamptz,
  add column if not exists release_reason text not null default '';

alter table public.logistics_route_stops
  drop constraint if exists logistics_route_stops_outcome_check;

alter table public.logistics_route_stops
  add constraint logistics_route_stops_outcome_check
  check (outcome is null or outcome in ('completed', 'failed', 'cancelled'));

alter table public.logistics_route_stops
  drop constraint if exists logistics_route_stops_task_id_key;

create unique index if not exists logistics_route_stops_active_task_uidx
  on public.logistics_route_stops (task_id)
  where released_at is null;

create index if not exists idx_logistics_route_stops_route_active
  on public.logistics_route_stops (route_id, stop_order)
  where released_at is null;

create index if not exists idx_logistics_routes_org_status_date
  on public.logistics_routes (organization_id, status, route_date desc, created_at desc);

drop policy if exists logistics_route_stops_select on public.logistics_route_stops;
create policy logistics_route_stops_select on public.logistics_route_stops for select
  using (
    organization_id = public.current_organization_id()
    and public.user_has_permission('routes.view')
    and (
      public.current_role_slug() <> 'conductor'
      or exists (
        select 1
        from public.logistics_routes route
        where route.id = logistics_route_stops.route_id
          and route.assigned_to = auth.uid()
      )
    )
  );
