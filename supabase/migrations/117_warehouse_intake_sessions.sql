-- Formal warehouse intake: immutable manifest, atomic scans, physical condition,
-- internal location, reconciliation and audited close/reopen operations.

alter table public.shipment_packages
  add column if not exists warehouse_id uuid references public.warehouses(id) on delete set null,
  add column if not exists warehouse_bin_id uuid references public.warehouse_bins(id) on delete set null,
  add column if not exists warehouse_location_label text not null default '',
  add column if not exists intake_condition text,
  add column if not exists intake_session_id uuid;

alter table public.shipment_packages
  drop constraint if exists shipment_packages_intake_condition_check;
alter table public.shipment_packages
  add constraint shipment_packages_intake_condition_check check (
    intake_condition is null or intake_condition in (
      'correct', 'opened', 'dented', 'wet', 'broken', 'poorly_sealed',
      'unreadable_label', 'exposed_contents', 'unidentified'
    )
  );

create table if not exists public.warehouse_intake_counters (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  next_number bigint not null default 1 check (next_number > 0)
);

create table if not exists public.warehouse_intake_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  route_id uuid not null references public.logistics_routes(id) on delete restrict,
  code text not null,
  status text not null default 'unloading' check (
    status in ('unloading', 'in_review', 'completed', 'completed_with_exceptions', 'cancelled')
  ),
  expected_count integer not null check (expected_count >= 0),
  operation_key text not null,
  started_by uuid not null references public.profiles(id) on delete restrict,
  started_at timestamptz not null default now(),
  closed_by uuid references public.profiles(id) on delete restrict,
  closed_at timestamptz,
  close_operation_key text,
  driver_confirmed boolean not null default false,
  driver_exception_note text not null default '',
  receiver_confirmed boolean not null default false,
  close_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(close_summary) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  unique (organization_id, operation_key)
);

create unique index if not exists warehouse_intake_one_open_route_idx
  on public.warehouse_intake_sessions(organization_id, route_id)
  where status in ('unloading', 'in_review');
create unique index if not exists warehouse_intake_close_operation_idx
  on public.warehouse_intake_sessions(organization_id, close_operation_key)
  where close_operation_key is not null;
create index if not exists warehouse_intake_sessions_scope_idx
  on public.warehouse_intake_sessions(organization_id, warehouse_id, started_at desc);

create table if not exists public.warehouse_intake_expected_packages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  session_id uuid not null references public.warehouse_intake_sessions(id) on delete restrict,
  package_id uuid not null references public.shipment_packages(id) on delete restrict,
  package_code text not null,
  created_at timestamptz not null default now(),
  unique (session_id, package_id),
  unique (session_id, package_code)
);

create table if not exists public.warehouse_intake_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  session_id uuid not null references public.warehouse_intake_sessions(id) on delete restrict,
  package_id uuid references public.shipment_packages(id) on delete restrict,
  scanned_code text not null check (btrim(scanned_code) <> ''),
  match_status text not null check (match_status in ('expected', 'unexpected', 'unidentified')),
  physical_condition text not null check (physical_condition in (
    'correct', 'opened', 'dented', 'wet', 'broken', 'poorly_sealed',
    'unreadable_label', 'exposed_contents', 'unidentified'
  )),
  received_weight_kg numeric,
  weight_difference_kg numeric,
  weight_out_of_tolerance boolean not null default false,
  warehouse_bin_id uuid references public.warehouse_bins(id) on delete restrict,
  location_label text not null,
  note text not null default '',
  evidence_path text not null default '',
  operation_key text not null,
  scanned_by uuid not null references public.profiles(id) on delete restrict,
  scanned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (received_weight_kg is null or received_weight_kg > 0),
  check (weight_difference_kg is null or weight_difference_kg >= 0),
  check (
    physical_condition = 'correct'
    or (btrim(note) <> '' and btrim(evidence_path) <> '' and location_label = 'Cuarentena')
  ),
  check (
    (match_status = 'unidentified' and package_id is null and physical_condition = 'unidentified')
    or (match_status <> 'unidentified' and package_id is not null and received_weight_kg is not null)
  ),
  unique (organization_id, operation_key)
);

create unique index if not exists warehouse_intake_item_code_idx
  on public.warehouse_intake_items(session_id, lower(scanned_code));
create unique index if not exists warehouse_intake_item_package_idx
  on public.warehouse_intake_items(session_id, package_id)
  where package_id is not null;
create index if not exists warehouse_intake_items_session_idx
  on public.warehouse_intake_items(session_id, scanned_at desc);

create table if not exists public.warehouse_intake_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  session_id uuid not null references public.warehouse_intake_sessions(id) on delete restrict,
  item_id uuid references public.warehouse_intake_items(id) on delete restrict,
  event_type text not null check (event_type in ('opened', 'scanned', 'exception_recorded', 'closed', 'reopened')),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  note text not null default '',
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence) = 'object'),
  operation_key text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, operation_key)
);

create index if not exists warehouse_intake_events_session_idx
  on public.warehouse_intake_events(session_id, created_at);

alter table public.shipment_packages
  drop constraint if exists shipment_packages_intake_session_id_fkey;
alter table public.shipment_packages
  add constraint shipment_packages_intake_session_id_fkey
  foreign key (intake_session_id) references public.warehouse_intake_sessions(id) on delete set null;

alter table public.warehouse_intake_sessions enable row level security;
alter table public.warehouse_intake_expected_packages enable row level security;
alter table public.warehouse_intake_items enable row level security;
alter table public.warehouse_intake_events enable row level security;

create policy warehouse_intake_sessions_select on public.warehouse_intake_sessions for select
  using (
    organization_id = public.current_organization_id()
    and public.user_can_access_warehouse(warehouse_id)
    and (public.user_has_permission('warehouses.manage') or public.user_has_permission('sales.manage'))
  );
create policy warehouse_intake_expected_select on public.warehouse_intake_expected_packages for select
  using (
    organization_id = public.current_organization_id()
    and exists (
      select 1 from public.warehouse_intake_sessions intake
      where intake.id = session_id and public.user_can_access_warehouse(intake.warehouse_id)
    )
    and (public.user_has_permission('warehouses.manage') or public.user_has_permission('sales.manage'))
  );
create policy warehouse_intake_items_select on public.warehouse_intake_items for select
  using (
    organization_id = public.current_organization_id()
    and exists (
      select 1 from public.warehouse_intake_sessions intake
      where intake.id = session_id and public.user_can_access_warehouse(intake.warehouse_id)
    )
    and (public.user_has_permission('warehouses.manage') or public.user_has_permission('sales.manage'))
  );
create policy warehouse_intake_events_select on public.warehouse_intake_events for select
  using (
    organization_id = public.current_organization_id()
    and exists (
      select 1 from public.warehouse_intake_sessions intake
      where intake.id = session_id and public.user_can_access_warehouse(intake.warehouse_id)
    )
    and (public.user_has_permission('warehouses.manage') or public.user_has_permission('sales.manage'))
  );

drop policy if exists shipment_packages_select on public.shipment_packages;
create policy shipment_packages_select on public.shipment_packages for select
  using (
    organization_id = public.current_organization_id()
    and (
      public.user_has_permission('sales.manage')
      or public.user_has_permission('routes.view')
      or public.user_has_permission('warehouse.operations')
      or public.user_has_permission('warehouses.manage')
    )
  );
drop policy if exists shipment_packages_write on public.shipment_packages;
create policy shipment_packages_write on public.shipment_packages for all
  using (
    organization_id = public.current_organization_id()
    and (
      public.user_has_permission('sales.manage')
      or public.user_has_permission('routes.update_status')
      or public.user_has_permission('warehouse.operations')
      or public.user_has_permission('warehouses.manage')
    )
  )
  with check (
    organization_id = public.current_organization_id()
    and (
      public.user_has_permission('sales.manage')
      or public.user_has_permission('routes.update_status')
      or public.user_has_permission('warehouse.operations')
      or public.user_has_permission('warehouses.manage')
    )
  );

drop policy if exists warehouse_bins_select on public.warehouse_bins;
create policy warehouse_bins_select on public.warehouse_bins for select
  using (
    organization_id = public.current_organization_id()
    and public.user_can_access_warehouse(warehouse_id)
    and (public.user_has_permission('inventory.view') or public.user_has_permission('warehouses.manage'))
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'warehouse-intake-evidence',
  'warehouse-intake-evidence',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists warehouse_intake_evidence_select on storage.objects;
create policy warehouse_intake_evidence_select on storage.objects for select
  using (
    bucket_id = 'warehouse-intake-evidence'
    and (storage.foldername(name))[1] = public.current_organization_id()::text
    and (public.user_has_permission('warehouses.manage') or public.user_has_permission('sales.manage'))
  );

create or replace function public.open_warehouse_intake(
  target_route_id uuid,
  target_warehouse_id uuid,
  operation_key text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  organization_value uuid := public.current_organization_id();
  session_id_value uuid;
  expected_count_value integer;
  next_number_value bigint;
  now_value timestamptz := now();
begin
  if organization_value is null or auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
  if not (public.user_has_permission('warehouses.manage') or public.user_has_permission('sales.manage')) then raise exception 'FORBIDDEN'; end if;
  if coalesce(btrim($3), '') = '' then raise exception 'OPERATION_KEY_REQUIRED'; end if;
  if not public.user_can_access_warehouse(target_warehouse_id) then raise exception 'WAREHOUSE_FORBIDDEN'; end if;
  if not exists (
    select 1 from public.warehouses warehouse
    where warehouse.id = target_warehouse_id and warehouse.organization_id = organization_value and warehouse.is_active
  ) then raise exception 'WAREHOUSE_NOT_FOUND'; end if;
  if not exists (
    select 1 from public.logistics_routes route
    where route.id = target_route_id and route.organization_id = organization_value and route.status = 'completed'
  ) then raise exception 'ROUTE_NOT_READY'; end if;

  select intake.id into session_id_value
  from public.warehouse_intake_sessions intake
  where intake.organization_id = organization_value and intake.operation_key = btrim($3);
  if session_id_value is not null then return session_id_value; end if;

  select intake.id into session_id_value
  from public.warehouse_intake_sessions intake
  where intake.organization_id = organization_value and intake.route_id = target_route_id
    and intake.status in ('unloading', 'in_review');
  if session_id_value is not null then return session_id_value; end if;

  select count(*)::integer into expected_count_value
  from public.shipment_packages package
  where package.organization_id = organization_value
    and package.truck_route_id = target_route_id
    and package.status = 'in_truck';
  if expected_count_value = 0 then raise exception 'ROUTE_WITHOUT_PACKAGES'; end if;

  insert into public.warehouse_intake_counters(organization_id, next_number)
  values (organization_value, 2)
  on conflict (organization_id) do update
    set next_number = public.warehouse_intake_counters.next_number + 1
  returning next_number - 1 into next_number_value;

  insert into public.warehouse_intake_sessions(
    organization_id, warehouse_id, route_id, code, expected_count, operation_key, started_by
  ) values (
    organization_value, target_warehouse_id, target_route_id,
    'ING-' || lpad(next_number_value::text, 6, '0'), expected_count_value, btrim($3), auth.uid()
  ) returning id into session_id_value;

  insert into public.warehouse_intake_expected_packages(
    organization_id, session_id, package_id, package_code
  )
  select organization_value, session_id_value, package.id, package.code
  from public.shipment_packages package
  where package.organization_id = organization_value
    and package.truck_route_id = target_route_id
    and package.status = 'in_truck';

  update public.shipment_packages
  set truck_unloaded_at = coalesce(truck_unloaded_at, now_value),
      truck_unloaded_by = coalesce(truck_unloaded_by, auth.uid()),
      updated_at = now_value
  where organization_id = organization_value
    and truck_route_id = target_route_id
    and status = 'in_truck';

  insert into public.warehouse_intake_events(
    organization_id, session_id, event_type, actor_id, note, evidence, operation_key
  ) values (
    organization_value, session_id_value, 'opened', auth.uid(), 'Descarga iniciada',
    jsonb_build_object('expectedCount', expected_count_value, 'routeId', target_route_id, 'warehouseId', target_warehouse_id),
    btrim($3) || ':opened'
  );
  return session_id_value;
end;
$$;

create or replace function public.scan_warehouse_intake_package(
  target_session_id uuid,
  scanned_code_value text,
  received_weight_value numeric,
  condition_value text,
  note_value text,
  evidence_path_value text,
  target_bin_id uuid,
  operation_key text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  organization_value uuid := public.current_organization_id();
  session_row public.warehouse_intake_sessions%rowtype;
  package_row public.shipment_packages%rowtype;
  item_id_value uuid;
  match_status_value text;
  location_value text;
  bin_label_value text;
  tolerance_value numeric := 0;
  difference_value numeric;
  expected_received_value integer;
  is_physical_exception boolean;
  now_value timestamptz := now();
begin
  if organization_value is null or auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
  if not (public.user_has_permission('warehouses.manage') or public.user_has_permission('sales.manage')) then raise exception 'FORBIDDEN'; end if;
  if coalesce(btrim($8), '') = '' then raise exception 'OPERATION_KEY_REQUIRED'; end if;
  if coalesce(btrim(scanned_code_value), '') = '' then raise exception 'PACKAGE_CODE_REQUIRED'; end if;

  select item.id into item_id_value from public.warehouse_intake_items item
  where item.organization_id = organization_value and item.operation_key = btrim($8);
  if item_id_value is not null then return item_id_value; end if;

  select * into session_row from public.warehouse_intake_sessions intake
  where intake.id = target_session_id and intake.organization_id = organization_value for update;
  if session_row.id is null then raise exception 'INTAKE_NOT_FOUND'; end if;
  if not public.user_can_access_warehouse(session_row.warehouse_id) then raise exception 'WAREHOUSE_FORBIDDEN'; end if;
  if session_row.status not in ('unloading', 'in_review') then raise exception 'INTAKE_CLOSED'; end if;
  if condition_value not in (
    'correct', 'opened', 'dented', 'wet', 'broken', 'poorly_sealed',
    'unreadable_label', 'exposed_contents', 'unidentified'
  ) then raise exception 'CONDITION_INVALID'; end if;

  if exists (
    select 1 from public.warehouse_intake_items item
    where item.session_id = session_row.id and lower(item.scanned_code) = lower(btrim(scanned_code_value))
  ) then raise exception 'PACKAGE_ALREADY_SCANNED'; end if;

  select * into package_row from public.shipment_packages package
  where package.organization_id = organization_value and lower(package.code) = lower(btrim(scanned_code_value))
  for update;

  if package_row.id is null then
    if condition_value <> 'unidentified' then raise exception 'PACKAGE_NOT_FOUND'; end if;
    if coalesce(btrim(note_value), '') = '' or coalesce(btrim(evidence_path_value), '') = '' then
      raise exception 'EXCEPTION_EVIDENCE_REQUIRED';
    end if;
    insert into public.warehouse_intake_items(
      organization_id, session_id, scanned_code, match_status, physical_condition,
      location_label, note, evidence_path, operation_key, scanned_by
    ) values (
      organization_value, session_row.id, btrim(scanned_code_value), 'unidentified', 'unidentified',
      'Cuarentena', btrim(note_value), btrim(evidence_path_value), btrim($8), auth.uid()
    ) returning id into item_id_value;
  else
    if package_row.status not in ('in_truck', 'pending_intake') then raise exception 'PACKAGE_ALREADY_RECEIVED'; end if;
    if received_weight_value is null or received_weight_value <= 0 then raise exception 'WEIGHT_INVALID'; end if;

    select case when exists (
      select 1 from public.warehouse_intake_expected_packages expected
      where expected.session_id = session_row.id and expected.package_id = package_row.id
    ) then 'expected' else 'unexpected' end into match_status_value;

    is_physical_exception := condition_value <> 'correct';
    if is_physical_exception and (coalesce(btrim(note_value), '') = '' or coalesce(btrim(evidence_path_value), '') = '') then
      raise exception 'EXCEPTION_EVIDENCE_REQUIRED';
    end if;

    select greatest(0, coalesce((organization.settings ->> 'warehouse_weight_tolerance_kg')::numeric, 0))
      into tolerance_value
    from public.organizations organization where organization.id = organization_value;
    difference_value := case when package_row.collection_weight_kg is null then null
      else abs(received_weight_value - package_row.collection_weight_kg) end;
    if difference_value is not null and difference_value > tolerance_value and coalesce(btrim(note_value), '') = '' then
      raise exception 'WEIGHT_NOTE_REQUIRED';
    end if;

    if target_bin_id is not null then
      select bin.label into bin_label_value from public.warehouse_bins bin
      where bin.id = target_bin_id and bin.organization_id = organization_value
        and bin.warehouse_id = session_row.warehouse_id and bin.is_active;
      if bin_label_value is null then raise exception 'BIN_NOT_FOUND'; end if;
    end if;
    location_value := case
      when is_physical_exception or match_status_value = 'unexpected'
        or (difference_value is not null and difference_value > tolerance_value) then 'Cuarentena'
      when bin_label_value is not null then bin_label_value
      else 'Recepción pendiente'
    end;

    insert into public.warehouse_intake_items(
      organization_id, session_id, package_id, scanned_code, match_status, physical_condition,
      received_weight_kg, weight_difference_kg, weight_out_of_tolerance, warehouse_bin_id, location_label,
      note, evidence_path, operation_key, scanned_by
    ) values (
      organization_value, session_row.id, package_row.id, package_row.code, match_status_value, condition_value,
      received_weight_value, difference_value,
      difference_value is not null and difference_value > tolerance_value,
      case when location_value = 'Cuarentena' then null else target_bin_id end,
      location_value, btrim(coalesce(note_value, '')), btrim(coalesce(evidence_path_value, '')),
      btrim($8), auth.uid()
    ) returning id into item_id_value;

    update public.shipment_packages
    set status = 'warehouse_intake',
        warehouse_id = session_row.warehouse_id,
        warehouse_bin_id = case when location_value = 'Cuarentena' then null else target_bin_id end,
        warehouse_location_label = location_value,
        intake_condition = condition_value,
        intake_session_id = session_row.id,
        intake_weight_kg = received_weight_value,
        intake_recorded_at = now_value,
        intake_recorded_by = auth.uid(),
        weight_difference_kg = difference_value,
        weight_difference_note = btrim(coalesce(note_value, '')),
        updated_at = now_value
    where id = package_row.id and organization_id = organization_value
      and status in ('in_truck', 'pending_intake');

    if is_physical_exception then
      insert into public.operational_exceptions(
        organization_id, package_id, shipment_id, exception_type, status, blocks_release,
        reason, evidence, reported_by, idempotency_key
      ) values (
        organization_value, package_row.id, package_row.shipment_id, 'damaged', 'open', true,
        btrim(note_value), jsonb_build_object('photoPath', evidence_path_value, 'condition', condition_value,
          'intakeSessionId', session_row.id, 'location', location_value), auth.uid(), btrim($8) || ':damage'
      ) on conflict do nothing;
    end if;
    if difference_value is not null and difference_value > tolerance_value then
      insert into public.operational_exceptions(
        organization_id, package_id, shipment_id, exception_type, status, blocks_release,
        reason, evidence, reported_by, idempotency_key
      ) values (
        organization_value, package_row.id, package_row.shipment_id, 'weight_difference', 'open', true,
        btrim(note_value), jsonb_build_object('intakeSessionId', session_row.id,
          'collectionWeightKg', package_row.collection_weight_kg, 'intakeWeightKg', received_weight_value,
          'differenceKg', difference_value, 'toleranceKg', tolerance_value), auth.uid(), btrim($8) || ':weight'
      ) on conflict do nothing;
    end if;
  end if;

  insert into public.warehouse_intake_events(
    organization_id, session_id, item_id, event_type, actor_id, note, evidence, operation_key
  ) values (
    organization_value, session_row.id, item_id_value,
    case when condition_value = 'correct' and coalesce(match_status_value, 'unidentified') = 'expected'
      then 'scanned' else 'exception_recorded' end,
    auth.uid(), btrim(coalesce(note_value, '')),
    jsonb_build_object('code', btrim(scanned_code_value), 'condition', condition_value,
      'matchStatus', coalesce(match_status_value, 'unidentified')), btrim($8) || ':event'
  );

  select count(*)::integer into expected_received_value
  from public.warehouse_intake_items item
  where item.session_id = session_row.id and item.match_status = 'expected';
  if expected_received_value >= session_row.expected_count then
    update public.warehouse_intake_sessions set status = 'in_review', updated_at = now_value
    where id = session_row.id and status = 'unloading';
  end if;
  return item_id_value;
exception
  when unique_violation then
    select item.id into item_id_value from public.warehouse_intake_items item
    where item.organization_id = organization_value and item.operation_key = btrim($8);
    if item_id_value is not null then return item_id_value; end if;
    raise exception 'PACKAGE_ALREADY_SCANNED';
end;
$$;

create or replace function public.close_warehouse_intake(
  target_session_id uuid,
  driver_confirmed_value boolean,
  driver_exception_note_value text,
  receiver_confirmed_value boolean,
  operation_key text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  organization_value uuid := public.current_organization_id();
  session_row public.warehouse_intake_sessions%rowtype;
  summary_value jsonb;
  missing_value integer;
  unexpected_value integer;
  damaged_value integer;
  unidentified_value integer;
  weight_value integer;
  quarantine_value integer;
  received_value integer;
  final_status text;
begin
  if organization_value is null or auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
  if not (public.user_has_permission('warehouses.manage') or public.user_has_permission('sales.manage')) then raise exception 'FORBIDDEN'; end if;
  if coalesce(btrim($5), '') = '' then raise exception 'OPERATION_KEY_REQUIRED'; end if;
  if not receiver_confirmed_value then raise exception 'RECEIVER_CONFIRMATION_REQUIRED'; end if;
  if not driver_confirmed_value and coalesce(btrim(driver_exception_note_value), '') = '' then
    raise exception 'DRIVER_CONFIRMATION_OR_NOTE_REQUIRED';
  end if;

  select * into session_row from public.warehouse_intake_sessions intake
  where intake.id = target_session_id and intake.organization_id = organization_value for update;
  if session_row.id is null then raise exception 'INTAKE_NOT_FOUND'; end if;
  if not public.user_can_access_warehouse(session_row.warehouse_id) then raise exception 'WAREHOUSE_FORBIDDEN'; end if;
  if session_row.close_operation_key = btrim($5) and session_row.closed_at is not null then
    return session_row.close_summary;
  end if;
  if session_row.status not in ('unloading', 'in_review') then raise exception 'INTAKE_CLOSED'; end if;

  select
    count(*)::integer,
    count(*) filter (where match_status = 'unexpected')::integer,
    count(*) filter (where physical_condition <> 'correct' and physical_condition <> 'unidentified')::integer,
    count(*) filter (where match_status = 'unidentified')::integer,
    count(*) filter (where weight_out_of_tolerance)::integer,
    count(*) filter (where location_label = 'Cuarentena')::integer
  into received_value, unexpected_value, damaged_value, unidentified_value, weight_value, quarantine_value
  from public.warehouse_intake_items where session_id = session_row.id;
  select greatest(0, session_row.expected_count - count(*) filter (where match_status = 'expected'))::integer
    into missing_value from public.warehouse_intake_items where session_id = session_row.id;

  summary_value := jsonb_build_object(
    'expected', session_row.expected_count, 'received', received_value, 'missing', missing_value,
    'unexpected', unexpected_value, 'damaged', damaged_value, 'unidentified', unidentified_value,
    'weightDifferences', weight_value, 'quarantine', quarantine_value
  );
  final_status := case when missing_value + unexpected_value + damaged_value + unidentified_value + weight_value + quarantine_value > 0
    then 'completed_with_exceptions' else 'completed' end;

  update public.warehouse_intake_sessions set
    status = final_status, closed_by = auth.uid(), closed_at = now(), close_operation_key = btrim($5),
    driver_confirmed = driver_confirmed_value,
    driver_exception_note = btrim(coalesce(driver_exception_note_value, '')),
    receiver_confirmed = receiver_confirmed_value, close_summary = summary_value, updated_at = now()
  where id = session_row.id;
  insert into public.warehouse_intake_events(
    organization_id, session_id, event_type, actor_id, note, evidence, operation_key
  ) values (
    organization_value, session_row.id, 'closed', auth.uid(),
    case when final_status = 'completed' then 'Ingreso completado' else 'Ingreso completado con excepciones abiertas' end,
    summary_value, btrim($5) || ':closed'
  );
  return summary_value;
end;
$$;

create or replace function public.reopen_warehouse_intake(
  target_session_id uuid,
  reason_value text,
  operation_key text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  organization_value uuid := public.current_organization_id();
  session_row public.warehouse_intake_sessions%rowtype;
begin
  if organization_value is null or auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
  if not public.user_has_permission('settings.manage') then raise exception 'FORBIDDEN'; end if;
  if coalesce(btrim(reason_value), '') = '' or coalesce(btrim($3), '') = '' then raise exception 'REOPEN_REASON_REQUIRED'; end if;
  select * into session_row from public.warehouse_intake_sessions intake
  where intake.id = target_session_id and intake.organization_id = organization_value for update;
  if session_row.id is null then raise exception 'INTAKE_NOT_FOUND'; end if;
  if session_row.status not in ('completed', 'completed_with_exceptions') then raise exception 'INTAKE_NOT_CLOSED'; end if;
  update public.warehouse_intake_sessions set
    status = 'in_review', closed_by = null, closed_at = null, close_operation_key = null,
    driver_confirmed = false, driver_exception_note = '', receiver_confirmed = false,
    close_summary = '{}'::jsonb, updated_at = now()
  where id = session_row.id;
  insert into public.warehouse_intake_events(
    organization_id, session_id, event_type, actor_id, note, evidence, operation_key
  ) values (
    organization_value, session_row.id, 'reopened', auth.uid(), btrim(reason_value),
    jsonb_build_object('previousSummary', session_row.close_summary), btrim($3)
  );
  return session_row.id;
end;
$$;

create or replace function public.prevent_warehouse_intake_record_mutation()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'WAREHOUSE_INTAKE_RECORDS_ARE_APPEND_ONLY';
end;
$$;

drop trigger if exists warehouse_intake_items_append_only on public.warehouse_intake_items;
create trigger warehouse_intake_items_append_only
before update or delete on public.warehouse_intake_items
for each row execute function public.prevent_warehouse_intake_record_mutation();
drop trigger if exists warehouse_intake_events_append_only on public.warehouse_intake_events;
create trigger warehouse_intake_events_append_only
before update or delete on public.warehouse_intake_events
for each row execute function public.prevent_warehouse_intake_record_mutation();
drop trigger if exists warehouse_intake_expected_append_only on public.warehouse_intake_expected_packages;
create trigger warehouse_intake_expected_append_only
before update or delete on public.warehouse_intake_expected_packages
for each row execute function public.prevent_warehouse_intake_record_mutation();

create or replace function public.resolve_package_custody_holder(
  target_package public.shipment_packages,
  target_status text default null
) returns table(holder_type text, holder_id uuid, holder_label text)
language plpgsql stable security definer set search_path = public as $$
declare
  effective_status text := coalesce(target_status, target_package.status);
  recipient_label text;
  route_driver_id uuid;
  route_driver_label text;
  pallet_label text;
  warehouse_label text;
  receiver_label text;
begin
  if effective_status = 'awaiting_full_box' then
    select nullif(btrim(concat_ws(' ', shipment.recipient_snapshot ->> 'firstName', shipment.recipient_snapshot ->> 'lastName')), '')
      into recipient_label from public.shipments shipment where shipment.id = target_package.shipment_id;
    return query select 'cliente'::text, null::uuid, coalesce(recipient_label, 'Cliente pendiente de caja llena');
    return;
  elsif effective_status in ('in_truck', 'pending_intake') and target_package.truck_route_id is not null then
    select route.assigned_to, coalesce(nullif(btrim(profile.full_name), ''), profile.email, 'Conductor asignado')
      into route_driver_id, route_driver_label
    from public.logistics_routes route left join public.profiles profile on profile.id = route.assigned_to
    where route.id = target_package.truck_route_id;
    return query select 'conductor'::text, route_driver_id, coalesce(route_driver_label, 'Conductor sin identificar');
    return;
  elsif effective_status = 'on_pallet' then
    select pallet.code into pallet_label from public.warehouse_pallets pallet where pallet.id = target_package.pallet_id;
    return query select 'paleta'::text, target_package.pallet_id, coalesce(nullif(btrim(pallet_label), ''), 'Paleta sin código');
    return;
  elsif effective_status = 'handed_to_carrier' then
    return query select 'proveedor'::text, null::uuid, coalesce(nullif(btrim(target_package.provider_name), ''), 'Proveedor sin identificar');
    return;
  end if;
  select warehouse.name into warehouse_label from public.warehouses warehouse where warehouse.id = target_package.warehouse_id;
  select coalesce(nullif(btrim(profile.full_name), ''), profile.email) into receiver_label
    from public.profiles profile where profile.id = target_package.intake_recorded_by;
  return query select 'bodega'::text, target_package.warehouse_id,
    concat_ws(' / ', coalesce(nullif(btrim(warehouse_label), ''), 'Bodega'), nullif(btrim(receiver_label), ''));
end;
$$;

grant select on public.warehouse_intake_sessions, public.warehouse_intake_expected_packages,
  public.warehouse_intake_items, public.warehouse_intake_events to authenticated;
grant execute on function public.open_warehouse_intake(uuid, uuid, text) to authenticated;
grant execute on function public.scan_warehouse_intake_package(uuid, text, numeric, text, text, text, uuid, text) to authenticated;
grant execute on function public.close_warehouse_intake(uuid, boolean, text, boolean, text) to authenticated;
grant execute on function public.reopen_warehouse_intake(uuid, text, text) to authenticated;

create or replace function public.mark_collected_packages_in_truck()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  route_id_value uuid;
  driver_id_value uuid;
begin
  if new.task_type <> 'pickup_full_box' or new.status <> 'completed'
    or old.status = 'completed' then return new; end if;
  select stop.route_id, coalesce(route.assigned_to, new.assigned_to)
    into route_id_value, driver_id_value
  from public.logistics_route_stops stop
  join public.logistics_routes route on route.id = stop.route_id
  where stop.task_id = new.id and stop.released_at is null
  order by stop.created_at desc limit 1;
  if route_id_value is null then return new; end if;
  update public.shipment_packages package set
    status = 'in_truck', truck_route_id = route_id_value, truck_task_id = new.id,
    collection_source = 'driver', collection_recorded_at = coalesce(package.collection_recorded_at, new.completed_at, now()),
    collection_recorded_by = coalesce(package.collection_recorded_by, driver_id_value), updated_at = now()
  where package.organization_id = new.organization_id and package.shipment_id = new.shipment_id
    and package.status = 'awaiting_full_box';
  return new;
end;
$$;

drop trigger if exists shipment_task_package_truck_custody on public.shipment_logistics_tasks;
create trigger shipment_task_package_truck_custody
after update of status on public.shipment_logistics_tasks
for each row execute function public.mark_collected_packages_in_truck();

create or replace function public.mark_route_packages_arrived()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' and old.status <> 'completed' then
    update public.shipment_packages package set
      truck_arrived_at = coalesce(package.truck_arrived_at, new.completed_at, now()),
      updated_at = now()
    where package.organization_id = new.organization_id
      and package.truck_route_id = new.id and package.status = 'in_truck';
  end if;
  return new;
end;
$$;

drop trigger if exists logistics_route_package_arrival on public.logistics_routes;
create trigger logistics_route_package_arrival
after update of status on public.logistics_routes
for each row execute function public.mark_route_packages_arrived();
