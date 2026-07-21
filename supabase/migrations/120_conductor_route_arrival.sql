-- Driver-confirmed route ending and physical warehouse arrival.

alter table public.logistics_routes
  add column if not exists arrival_warehouse_id uuid references public.warehouses(id) on delete set null,
  add column if not exists arrival_reason_code text,
  add column if not exists arrival_note text not null default '',
  add column if not exists arrival_reported_at timestamptz,
  add column if not exists arrival_confirmed_at timestamptz,
  add column if not exists arrival_confirmed_by uuid references public.profiles(id) on delete set null,
  add column if not exists arrival_operation_key text;

alter table public.logistics_routes
  drop constraint if exists logistics_routes_arrival_reason_check;

alter table public.logistics_routes
  add constraint logistics_routes_arrival_reason_check check (
    arrival_reason_code is null or arrival_reason_code in (
      'completed_normally', 'unfinished_stops', 'vehicle_problem', 'other'
    )
  );

create unique index if not exists logistics_routes_arrival_operation_uidx
  on public.logistics_routes(organization_id, arrival_operation_key)
  where arrival_operation_key is not null and arrival_operation_key <> '';

create or replace function public.complete_conductor_route_arrival(
  target_route_id uuid,
  target_warehouse_id uuid,
  reason_code text,
  note_value text,
  captured_at timestamptz,
  operation_key text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  organization_value uuid := public.current_organization_id();
  route_row public.logistics_routes%rowtype;
  warehouse_name_value text;
  actor_name_value text;
  stop_count_value integer;
  exception_count_value integer;
  existing_route_id uuid;
  reason_label_value text;
begin
  if organization_value is null then raise exception 'FORBIDDEN'; end if;
  if coalesce(btrim($6), '') = '' then raise exception 'OPERATION_KEY_REQUIRED'; end if;
  if coalesce($3, '') not in ('completed_normally', 'unfinished_stops', 'vehicle_problem', 'other') then
    raise exception 'ARRIVAL_REASON_REQUIRED';
  end if;
  if $3 = 'other' and char_length(btrim(coalesce($4, ''))) < 3 then
    raise exception 'ARRIVAL_NOTE_REQUIRED';
  end if;
  if char_length(btrim(coalesce($4, ''))) > 500 then raise exception 'ARRIVAL_NOTE_TOO_LONG'; end if;

  select route.id into existing_route_id
  from public.logistics_routes route
  where route.organization_id = organization_value and route.arrival_operation_key = btrim($6)
  limit 1;
  if existing_route_id is not null then
    if existing_route_id = $1 then return existing_route_id; end if;
    raise exception 'OPERATION_KEY_REUSED';
  end if;

  select * into route_row
  from public.logistics_routes route
  where route.id = $1 and route.organization_id = organization_value
  for update;
  if route_row.id is null then raise exception 'ROUTE_NOT_FOUND'; end if;
  if route_row.status = 'completed' then raise exception 'ROUTE_ALREADY_COMPLETED'; end if;
  if route_row.status <> 'in_progress' then raise exception 'ROUTE_NOT_IN_PROGRESS'; end if;
  if not (
    route_row.assigned_to = auth.uid()
    or (
      public.current_role_slug() <> 'conductor'
      and public.user_has_permission('routes.update_status')
    )
  ) then raise exception 'FORBIDDEN'; end if;

  select warehouse.name into warehouse_name_value
  from public.warehouses warehouse
  where warehouse.id = $2 and warehouse.organization_id = organization_value and warehouse.is_active;
  if warehouse_name_value is null then raise exception 'WAREHOUSE_NOT_FOUND'; end if;
  if route_row.warehouse_id is distinct from $2 and char_length(btrim(coalesce($4, ''))) < 3 then
    raise exception 'WAREHOUSE_CHANGE_NOTE_REQUIRED';
  end if;

  select
    count(*)::integer,
    count(*) filter (where stop.outcome is distinct from 'completed')::integer
  into stop_count_value, exception_count_value
  from public.logistics_route_stops stop
  where stop.route_id = route_row.id and stop.organization_id = organization_value
    and stop.released_at is null
    and stop.outcome in ('completed', 'failed', 'cancelled');

  if stop_count_value = 0 then raise exception 'ROUTE_WITHOUT_CLOSED_STOPS'; end if;
  if exists (
    select 1 from public.logistics_route_stops stop
    where stop.route_id = route_row.id and stop.organization_id = organization_value
      and stop.released_at is null
      and (stop.outcome is null or stop.outcome not in ('completed', 'failed', 'cancelled'))
  ) then raise exception 'ROUTE_HAS_OPEN_STOPS'; end if;
  if exception_count_value > 0 and $3 = 'completed_normally' then
    raise exception 'ROUTE_HAS_EXCEPTIONS';
  end if;

  update public.logistics_routes set
    status = 'completed',
    completed_at = now(),
    completed_by = auth.uid(),
    arrival_warehouse_id = $2,
    arrival_reason_code = $3,
    arrival_note = btrim(coalesce($4, '')),
    arrival_reported_at = least(coalesce($5, now()), now()),
    arrival_confirmed_at = now(),
    arrival_confirmed_by = auth.uid(),
    arrival_operation_key = btrim($6),
    updated_at = now()
  where id = route_row.id;

  select coalesce(nullif(profile.full_name, ''), profile.email, 'Conductor') into actor_name_value
  from public.profiles profile where profile.id = auth.uid();
  reason_label_value := case $3
    when 'completed_normally' then 'Terminó todo'
    when 'unfinished_stops' then 'Quedaron entregas'
    when 'vehicle_problem' then 'Problema con el camión'
    else 'Otra razón'
  end;

  insert into public.activity_history(
    organization_id, actor_id, actor_name, action, entity_type, entity_id,
    title, description, metadata
  ) values (
    organization_value, auth.uid(), coalesce(actor_name_value, 'Conductor'),
    'logistics.route_arrived_at_warehouse', 'logistics_route', route_row.id,
    'Ruta entregada en bodega: ' || route_row.name,
    warehouse_name_value || ' · ' || reason_label_value,
    jsonb_build_object(
      'routeId', route_row.id,
      'plannedWarehouseId', route_row.warehouse_id,
      'arrivalWarehouseId', $2,
      'arrivalWarehouseName', warehouse_name_value,
      'reasonCode', $3,
      'reasonNote', btrim(coalesce($4, '')),
      'stopCount', stop_count_value,
      'exceptionStopCount', exception_count_value,
      'source', 'conductor.tareas'
    )
  );

  return route_row.id;
end;
$$;

grant execute on function public.complete_conductor_route_arrival(uuid, uuid, text, text, timestamptz, text) to authenticated;

drop policy if exists logistics_routes_write on public.logistics_routes;
create policy logistics_routes_write on public.logistics_routes for all
  using (
    organization_id = public.current_organization_id()
    and (
      (
        public.current_role_slug() = 'conductor'
        and assigned_to = auth.uid()
        and public.user_has_permission('routes.update_status')
      )
      or (
        public.current_role_slug() <> 'conductor'
        and (
          public.user_has_permission('routes.update_status')
          or public.user_has_permission('sales.manage')
        )
      )
    )
  )
  with check (
    organization_id = public.current_organization_id()
    and (
      (
        public.current_role_slug() = 'conductor'
        and assigned_to = auth.uid()
        and public.user_has_permission('routes.update_status')
      )
      or (
        public.current_role_slug() <> 'conductor'
        and (
          public.user_has_permission('routes.update_status')
          or public.user_has_permission('sales.manage')
        )
      )
    )
  );

create or replace function public.mark_route_packages_arrived()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed' and old.status <> 'completed' then
    update public.shipment_packages package set
      truck_arrived_at = coalesce(package.truck_arrived_at, new.arrival_confirmed_at, new.completed_at, now()),
      warehouse_id = coalesce(new.arrival_warehouse_id, package.warehouse_id),
      updated_at = now()
    where package.organization_id = new.organization_id
      and package.truck_route_id = new.id and package.status = 'in_truck';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_intake_arrival_warehouse()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  arrival_warehouse_value uuid;
begin
  select route.arrival_warehouse_id into arrival_warehouse_value
  from public.logistics_routes route where route.id = new.route_id;
  if arrival_warehouse_value is not null and arrival_warehouse_value <> new.warehouse_id then
    raise exception 'ARRIVAL_WAREHOUSE_MISMATCH';
  end if;
  return new;
end;
$$;

drop trigger if exists warehouse_intake_arrival_warehouse_guard on public.warehouse_intake_sessions;
create trigger warehouse_intake_arrival_warehouse_guard
before insert on public.warehouse_intake_sessions
for each row execute function public.enforce_intake_arrival_warehouse();
