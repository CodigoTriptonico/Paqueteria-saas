-- A physical box can arrive in a warehouse without a known truck or manifest.
-- Preserve that uncertainty as a blocking custody exception instead of inventing a route.

alter table public.warehouse_intake_sessions
  alter column route_id drop not null;

alter table public.warehouse_intake_sessions
  add column if not exists intake_kind text not null default 'truck_manifest';

alter table public.warehouse_intake_sessions
  drop constraint if exists warehouse_intake_sessions_kind_check;
alter table public.warehouse_intake_sessions
  add constraint warehouse_intake_sessions_kind_check check (
    intake_kind in ('truck_manifest', 'found_in_warehouse')
  );

alter table public.operational_exceptions
  drop constraint if exists operational_exceptions_exception_type_check;
alter table public.operational_exceptions
  add constraint operational_exceptions_exception_type_check check (
    exception_type in (
      'not_delivered', 'damaged', 'lost', 'weight_difference',
      'cancel_pre_departure', 'unknown_custody'
    )
  );

create or replace function public.open_found_warehouse_intake(
  target_warehouse_id uuid,
  operation_key text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  organization_value uuid := public.current_organization_id();
  session_id_value uuid;
  next_number_value bigint;
begin
  if organization_value is null or auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
  if not (public.user_has_permission('warehouses.manage') or public.user_has_permission('sales.manage')) then raise exception 'FORBIDDEN'; end if;
  if coalesce(btrim($2), '') = '' then raise exception 'OPERATION_KEY_REQUIRED'; end if;
  if not public.user_can_access_warehouse($1) then raise exception 'WAREHOUSE_FORBIDDEN'; end if;
  if not exists (
    select 1 from public.warehouses warehouse
    where warehouse.id = $1 and warehouse.organization_id = organization_value and warehouse.is_active
  ) then raise exception 'WAREHOUSE_NOT_FOUND'; end if;

  select intake.id into session_id_value
  from public.warehouse_intake_sessions intake
  where intake.organization_id = organization_value and intake.operation_key = btrim($2);
  if session_id_value is not null then return session_id_value; end if;

  insert into public.warehouse_intake_counters(organization_id, next_number)
  values (organization_value, 2)
  on conflict (organization_id) do update
    set next_number = public.warehouse_intake_counters.next_number + 1
  returning next_number - 1 into next_number_value;

  insert into public.warehouse_intake_sessions(
    organization_id, warehouse_id, route_id, intake_kind, code, expected_count, operation_key, started_by
  ) values (
    organization_value, $1, null, 'found_in_warehouse',
    'HALL-' || lpad(next_number_value::text, 6, '0'), 0, btrim($2), auth.uid()
  ) returning id into session_id_value;

  insert into public.warehouse_intake_events(
    organization_id, session_id, event_type, actor_id, note, evidence, operation_key
  ) values (
    organization_value, session_id_value, 'opened', auth.uid(), 'Caja encontrada sin camion ni manifiesto',
    jsonb_build_object('warehouseId', $1, 'intakeKind', 'found_in_warehouse'), btrim($2) || ':opened'
  );
  return session_id_value;
end;
$$;

create or replace function public.scan_found_warehouse_intake_package(
  target_session_id uuid,
  scanned_code_value text,
  received_weight_value numeric,
  note_value text,
  evidence_path_value text,
  operation_key text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  organization_value uuid := public.current_organization_id();
  session_row public.warehouse_intake_sessions%rowtype;
  package_row public.shipment_packages%rowtype;
  item_id_value uuid;
begin
  if organization_value is null or auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
  if not (public.user_has_permission('warehouses.manage') or public.user_has_permission('sales.manage')) then raise exception 'FORBIDDEN'; end if;
  if coalesce(btrim($2), '') = '' then raise exception 'PACKAGE_CODE_REQUIRED'; end if;
  if coalesce(btrim($4), '') = '' or coalesce(btrim($5), '') = '' then raise exception 'EXCEPTION_EVIDENCE_REQUIRED'; end if;
  if coalesce(btrim($6), '') = '' then raise exception 'OPERATION_KEY_REQUIRED'; end if;

  select * into session_row from public.warehouse_intake_sessions intake
  where intake.id = $1 and intake.organization_id = organization_value for update;
  if session_row.id is null then raise exception 'INTAKE_NOT_FOUND'; end if;
  if not public.user_can_access_warehouse(session_row.warehouse_id) then raise exception 'WAREHOUSE_FORBIDDEN'; end if;
  if session_row.intake_kind <> 'found_in_warehouse' then raise exception 'INTAKE_KIND_MISMATCH'; end if;
  if session_row.status not in ('unloading', 'in_review') then raise exception 'INTAKE_CLOSED'; end if;
  if exists (
    select 1 from public.warehouse_intake_items item
    where item.session_id = session_row.id and lower(item.scanned_code) = lower(btrim($2))
  ) then raise exception 'PACKAGE_ALREADY_SCANNED'; end if;

  select * into package_row from public.shipment_packages package
  where package.organization_id = organization_value and lower(package.code) = lower(btrim($2))
  for update;

  if package_row.id is null then
    insert into public.warehouse_intake_items(
      organization_id, session_id, scanned_code, match_status, physical_condition,
      location_label, note, evidence_path, operation_key, scanned_by
    ) values (
      organization_value, session_row.id, btrim($2), 'unidentified', 'unidentified',
      'Cuarentena', btrim($4), btrim($5), btrim($6), auth.uid()
    ) returning id into item_id_value;
  else
    if package_row.status in ('handed_to_carrier', 'delivered') then raise exception 'PACKAGE_CUSTODY_CONFLICT'; end if;
    if $3 is null or $3 <= 0 then raise exception 'WEIGHT_INVALID'; end if;

    insert into public.warehouse_intake_items(
      organization_id, session_id, package_id, scanned_code, match_status, physical_condition,
      received_weight_kg, warehouse_bin_id, location_label, note, evidence_path, operation_key, scanned_by
    ) values (
      organization_value, session_row.id, package_row.id, package_row.code, 'unexpected', 'correct',
      $3, null, 'Cuarentena', btrim($4), btrim($5), btrim($6), auth.uid()
    ) returning id into item_id_value;

    update public.shipment_packages set
      status = 'warehouse_intake', warehouse_id = session_row.warehouse_id, warehouse_bin_id = null,
      warehouse_location_label = 'Cuarentena', intake_condition = 'correct', intake_session_id = session_row.id,
      intake_weight_kg = $3, intake_recorded_at = now(), intake_recorded_by = auth.uid(),
      weight_difference_kg = null, weight_difference_note = btrim($4), updated_at = now()
    where id = package_row.id and organization_id = organization_value;

    insert into public.operational_exceptions(
      organization_id, package_id, shipment_id, exception_type, status, blocks_release,
      reason, evidence, reported_by, idempotency_key
    ) values (
      organization_value, package_row.id, package_row.shipment_id, 'unknown_custody', 'open', true,
      btrim($4), jsonb_build_object(
        'photoPath', btrim($5), 'intakeSessionId', session_row.id,
        'warehouseId', session_row.warehouse_id, 'intakeKind', 'found_in_warehouse'
      ), auth.uid(), btrim($6) || ':unknown-custody'
    ) on conflict do nothing;
  end if;

  insert into public.warehouse_intake_events(
    organization_id, session_id, item_id, event_type, actor_id, note, evidence, operation_key
  ) values (
    organization_value, session_row.id, item_id_value, 'exception_recorded', auth.uid(), btrim($4),
    jsonb_build_object('code', btrim($2), 'matchStatus', case when package_row.id is null then 'unidentified' else 'unexpected' end,
      'intakeKind', 'found_in_warehouse'), btrim($6) || ':event'
  );
  return item_id_value;
exception
  when unique_violation then
    select item.id into item_id_value from public.warehouse_intake_items item
    where item.organization_id = organization_value and item.operation_key = btrim($6);
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
  if not $4 then raise exception 'RECEIVER_CONFIRMATION_REQUIRED'; end if;
  select * into session_row from public.warehouse_intake_sessions intake
  where intake.id = $1 and intake.organization_id = organization_value for update;
  if session_row.id is null then raise exception 'INTAKE_NOT_FOUND'; end if;
  if not public.user_can_access_warehouse(session_row.warehouse_id) then raise exception 'WAREHOUSE_FORBIDDEN'; end if;
  if session_row.close_operation_key = btrim($5) and session_row.closed_at is not null then return session_row.close_summary; end if;
  if session_row.status not in ('unloading', 'in_review') then raise exception 'INTAKE_CLOSED'; end if;
  if session_row.intake_kind = 'truck_manifest' and not $2 and coalesce(btrim($3), '') = '' then
    raise exception 'DRIVER_CONFIRMATION_OR_NOTE_REQUIRED';
  end if;

  select count(*)::integer, count(*) filter (where match_status = 'unexpected')::integer,
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
    driver_confirmed = case when intake_kind = 'found_in_warehouse' then false else $2 end,
    driver_exception_note = case when intake_kind = 'found_in_warehouse' then 'Sin conductor ni manifiesto identificado' else btrim(coalesce($3, '')) end,
    receiver_confirmed = $4, close_summary = summary_value, updated_at = now()
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

grant execute on function public.open_found_warehouse_intake(uuid, text) to authenticated;
grant execute on function public.scan_found_warehouse_intake_package(uuid, text, numeric, text, text, text) to authenticated;
