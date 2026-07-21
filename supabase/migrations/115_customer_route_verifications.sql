-- Remitent → weekly route verification.
-- First seller assignment waits for logistics approval; after verify, later
-- assignments auto-accept. Address/zone changes revoke the active verification.

-- Sellers need to read weekly templates/routes to propose or auto-assign from seguimiento.
drop policy if exists logistics_route_templates_select on public.logistics_route_templates;
create policy logistics_route_templates_select on public.logistics_route_templates for select
  using (
    organization_id = public.current_organization_id()
    and (
      public.user_has_permission('routes.view')
      or public.user_has_permission('sales.manage')
    )
  );

drop policy if exists logistics_routes_select on public.logistics_routes;
create policy logistics_routes_select on public.logistics_routes for select
  using (
    organization_id = public.current_organization_id()
    and (
      public.user_has_permission('routes.view')
      or public.user_has_permission('sales.manage')
    )
  );

drop policy if exists logistics_route_stops_select on public.logistics_route_stops;
create policy logistics_route_stops_select on public.logistics_route_stops for select
  using (
    organization_id = public.current_organization_id()
    and (
      public.user_has_permission('routes.view')
      or public.user_has_permission('sales.manage')
    )
  );

create or replace function public.list_logistics_route_weekdays(target_org_id uuid)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  configured_days text[];
begin
  if target_org_id is null then
    raise exception 'Organizacion invalida';
  end if;

  if target_org_id is distinct from public.current_organization_id()
     and auth.role() <> 'service_role' then
    raise exception 'Forbidden';
  end if;

  if auth.role() <> 'service_role'
     and not (
       public.user_has_permission('routes.view')
       or public.user_has_permission('sales.manage')
     ) then
    raise exception 'Forbidden';
  end if;

  select array_agg(day order by array_position(array['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'], day))
  into configured_days
  from public.organization_route_settings settings
  cross join lateral (
    select distinct day
    from unnest(coalesce(settings.delivery_days, '{}'::text[]) || coalesce(settings.pickup_days, '{}'::text[])) as day
    where day = any(array['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'])
  ) normalized
  where settings.organization_id = target_org_id;

  return coalesce(configured_days, '{}'::text[]);
end;
$$;

create table if not exists public.customer_route_verifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  route_template_id uuid not null references public.logistics_route_templates (id) on delete restrict,
  zone_key text not null check (char_length(btrim(zone_key)) > 0),
  verified_by uuid references public.profiles (id) on delete set null,
  verified_at timestamptz not null default now(),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  end_reason text not null default '',
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);

create unique index if not exists customer_route_verifications_active_uidx
  on public.customer_route_verifications (customer_id, route_template_id)
  where ended_at is null;

create index if not exists customer_route_verifications_org_idx
  on public.customer_route_verifications (organization_id, ended_at, verified_at desc);

create table if not exists public.customer_route_assignment_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  shipment_id uuid not null references public.shipments (id) on delete cascade,
  task_id uuid not null references public.shipment_logistics_tasks (id) on delete cascade,
  route_template_id uuid not null references public.logistics_route_templates (id) on delete restrict,
  scheduled_at timestamptz not null,
  driver_id uuid not null references public.profiles (id) on delete restrict,
  zone_key text not null check (char_length(btrim(zone_key)) > 0),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  requested_by uuid references public.profiles (id) on delete set null,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists customer_route_assignment_requests_pending_task_uidx
  on public.customer_route_assignment_requests (task_id)
  where status = 'pending';

create index if not exists customer_route_assignment_requests_org_status_idx
  on public.customer_route_assignment_requests (organization_id, status, created_at desc);

create index if not exists customer_route_assignment_requests_customer_idx
  on public.customer_route_assignment_requests (customer_id, status, created_at desc);

alter table public.customer_route_verifications enable row level security;
alter table public.customer_route_assignment_requests enable row level security;

drop policy if exists customer_route_verifications_select on public.customer_route_verifications;
create policy customer_route_verifications_select on public.customer_route_verifications for select
  using (
    organization_id = public.current_organization_id()
    and (
      public.user_has_permission('routes.view')
      or public.user_has_permission('sales.manage')
    )
  );

drop policy if exists customer_route_verifications_write on public.customer_route_verifications;
create policy customer_route_verifications_write on public.customer_route_verifications for all
  using (
    organization_id = public.current_organization_id()
    and (
      public.user_has_permission('routes.update_status')
      or public.user_has_permission('sales.manage')
    )
  )
  with check (
    organization_id = public.current_organization_id()
    and (
      public.user_has_permission('routes.update_status')
      or public.user_has_permission('sales.manage')
    )
  );

drop policy if exists customer_route_assignment_requests_select on public.customer_route_assignment_requests;
create policy customer_route_assignment_requests_select on public.customer_route_assignment_requests for select
  using (
    organization_id = public.current_organization_id()
    and (
      public.user_has_permission('routes.view')
      or public.user_has_permission('sales.manage')
    )
  );

drop policy if exists customer_route_assignment_requests_insert on public.customer_route_assignment_requests;
create policy customer_route_assignment_requests_insert on public.customer_route_assignment_requests for insert
  with check (
    organization_id = public.current_organization_id()
    and (
      public.user_has_permission('sales.manage')
      or public.user_has_permission('routes.update_status')
    )
  );

drop policy if exists customer_route_assignment_requests_update on public.customer_route_assignment_requests;
create policy customer_route_assignment_requests_update on public.customer_route_assignment_requests for update
  using (
    organization_id = public.current_organization_id()
    and (
      public.user_has_permission('routes.update_status')
      or public.user_has_permission('sales.manage')
    )
  )
  with check (
    organization_id = public.current_organization_id()
    and (
      public.user_has_permission('routes.update_status')
      or public.user_has_permission('sales.manage')
    )
  );
