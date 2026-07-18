-- Turns agency requests into route stops that can be completed by the assigned driver.

alter table public.logistics_route_stops
  alter column task_id drop not null,
  add column if not exists agency_visit_id uuid references public.agency_visits(id) on delete cascade;

drop index if exists public.logistics_route_stops_active_task_uidx;
create unique index if not exists logistics_route_stops_active_task_uidx
  on public.logistics_route_stops (task_id) where task_id is not null and released_at is null;
create unique index if not exists logistics_route_stops_active_agency_visit_uidx
  on public.logistics_route_stops (agency_visit_id) where agency_visit_id is not null and released_at is null;

alter table public.logistics_route_stops
  drop constraint if exists logistics_route_stops_source_check;
alter table public.logistics_route_stops
  add constraint logistics_route_stops_source_check check (
    (task_id is not null and agency_visit_id is null)
    or (task_id is null and agency_visit_id is not null)
  );

create table if not exists public.agency_route_proposals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  agency_id uuid not null references public.agencies(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null check (btrim(name) <> ''),
  weekday smallint not null check (weekday between 0 and 6),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  note text not null default '',
  reviewed_by_membership_id uuid references public.organization_memberships(id) on delete restrict,
  reviewed_at timestamptz,
  review_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists agency_route_proposals_scope_idx
  on public.agency_route_proposals(tenant_id, organization_id, status, created_at desc);

-- Sellers work from the same small agency operation surface as the administrator.
insert into public.role_permissions(role_id, permission_id, granted)
select role.id, permission.id, true
from public.roles role
join public.permissions permission on permission.key = 'agency.requests.create'
where role.slug = 'vendedor_agencia'
on conflict (role_id, permission_id) do update set granted = true;

create or replace function public.create_agency_service_request(lines jsonb, requested_date date, note text, idempotency_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  tenant uuid := public.current_tenant_id();
  membership uuid := public.current_membership_id();
  agency_row public.agencies;
  request_id uuid;
  line jsonb;
  operation public.idempotency_operations;
begin
  if tenant is null or membership is null or jsonb_typeof(lines) <> 'array' or jsonb_array_length(lines) = 0 then raise exception 'SOLICITUD_INVALIDA'; end if;
  select agency.* into agency_row from public.agencies agency where agency.tenant_id = tenant and agency.organization_id = public.current_business_organization_id() and agency.archived_at is null;
  if agency_row.id is null or not public.current_membership_has_permission('agency.requests.create', tenant, agency_row.organization_id) then raise exception 'FORBIDDEN'; end if;
  insert into public.idempotency_operations(tenant_id, operation_type, idempotency_key, actor_membership_id, status)
  values(tenant, 'create_agency_service_request', btrim(idempotency_key), membership, 'executing')
  on conflict(tenant_id, operation_type, idempotency_key) do nothing returning * into operation;
  if operation.id is null then
    select * into operation from public.idempotency_operations where tenant_id = tenant and operation_type = 'create_agency_service_request' and idempotency_key = btrim(idempotency_key);
    if operation.status = 'completed' then return operation.result || jsonb_build_object('replayed', true); end if;
    raise exception 'OPERATION_IN_PROGRESS';
  end if;
  insert into public.agency_service_requests(tenant_id, organization_id, agency_id, code, status, requested_service_date, address_snapshot, notes, created_by_membership_id)
  values(tenant, agency_row.organization_id, agency_row.id, 'AG-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)), 'submitted', requested_date, '{}'::jsonb, left(coalesce(note, ''), 1000), membership)
  returning id into request_id;
  for line in select value from jsonb_array_elements(lines) loop
    if coalesce((line->>'quantity')::integer, 0) <= 0 or coalesce(line->>'serviceKind', '') not in ('empty_box_delivery', 'full_box_pickup') then raise exception 'LINEA_INVALIDA'; end if;
    insert into public.agency_service_request_lines(tenant_id, organization_id, request_id, service_kind, requested_quantity, inventory_item_id, matrix_warehouse_id, product_key, box_size, unit_charge_amount_cents, currency, details)
    values(tenant, agency_row.organization_id, request_id, line->>'serviceKind', (line->>'quantity')::integer,
      nullif(line->>'inventoryItemId', '')::uuid, nullif(line->>'warehouseId', '')::uuid,
      coalesce(line->>'productKey', ''), coalesce(line->>'boxSize', ''), coalesce((line->>'unitChargeAmountCents')::bigint, 0), 'USD', coalesce(line->'details', '{}'::jsonb));
  end loop;
  update public.idempotency_operations set status = 'completed', result = jsonb_build_object('requestId', request_id, 'replayed', false), completed_at = now() where id = operation.id;
  return jsonb_build_object('requestId', request_id, 'replayed', false);
end;
$$;

create or replace function public.assign_agency_request_to_route(target_request_id uuid, target_route_id uuid, scheduled_for_value timestamptz, idempotency_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  tenant uuid := public.current_tenant_id();
  membership uuid := public.current_membership_id();
  request_row public.agency_service_requests;
  route_row public.logistics_routes;
  visit_id uuid;
  operation public.idempotency_operations;
begin
  if tenant is null or membership is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into request_row from public.agency_service_requests where id = target_request_id and tenant_id = tenant for update;
  select * into route_row from public.logistics_routes where id = target_route_id and organization_id = public.current_business_organization_id() and status not in ('cancelled', 'completed');
  if request_row.id is null or route_row.id is null or not public.current_membership_has_permission('agency.requests.assign', tenant, route_row.organization_id) then raise exception 'FORBIDDEN'; end if;
  insert into public.idempotency_operations(tenant_id, operation_type, idempotency_key, actor_membership_id, status)
  values(tenant, 'assign_agency_request_to_route', btrim(idempotency_key), membership, 'executing')
  on conflict(tenant_id, operation_type, idempotency_key) do nothing returning * into operation;
  if operation.id is null then
    select * into operation from public.idempotency_operations where tenant_id=tenant and operation_type='assign_agency_request_to_route' and idempotency_key=btrim(idempotency_key);
    if operation.status='completed' then return operation.result || jsonb_build_object('replayed', true); end if;
    raise exception 'OPERATION_IN_PROGRESS';
  end if;
  insert into public.agency_visits(tenant_id, organization_id, agency_id, route_id, status, scheduled_for, address_snapshot, notes, created_by_membership_id)
  select tenant, request_row.organization_id, request_row.agency_id, route_row.id, 'assigned', coalesce(scheduled_for_value, route_row.route_date::timestamptz), request_row.address_snapshot, request_row.notes, membership
  returning id into visit_id;
  insert into public.agency_visit_lines(tenant_id, organization_id, visit_id, request_line_id, requested_quantity)
  select tenant, request_row.organization_id, visit_id, line.id, line.requested_quantity from public.agency_service_request_lines line where line.request_id=request_row.id;
  insert into public.logistics_route_stops(organization_id, route_id, agency_visit_id, stop_order, address_snapshot, lat, lng, postal_code, city)
  values(route_row.organization_id, route_row.id, visit_id,
    coalesce((select max(stop_order)+1 from public.logistics_route_stops where route_id=route_row.id), 1),
    (select address_snapshot from public.agency_visits where id=visit_id), null, null, '', '');
  update public.agency_service_requests set status='assigned', status_version=status_version+1, updated_at=now() where id=request_row.id;
  update public.idempotency_operations set status='completed', result=jsonb_build_object('visitId', visit_id, 'replayed', false), completed_at=now() where id=operation.id;
  return jsonb_build_object('visitId', visit_id, 'replayed', false);
end;
$$;

-- Allow the existing atomic visit confirmation function to be used only by the driver assigned to that route.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.confirm_agency_visit(uuid,jsonb,text,text,text)'::regprocedure) into definition;
  definition := replace(definition,
    'or not public.current_membership_has_permission(''agency.visits.confirm'', tenant, visit_row.organization_id) then',
    'or not (public.current_membership_has_permission(''agency.visits.confirm'', tenant, visit_row.organization_id) or (public.current_role_slug() = ''conductor'' and exists (select 1 from public.logistics_routes route where route.id = visit_row.route_id and route.assigned_to = auth.uid()))) then');
  execute definition;
end $$;

create or replace function public.complete_agency_visit_by_driver(target_visit_id uuid, line_confirmations jsonb, confirmation_reason text, payment jsonb, idempotency_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  tenant uuid := public.current_tenant_id();
  membership uuid := public.current_membership_id();
  visit_row public.agency_visits;
  payment_id uuid;
  payment_amount bigint := coalesce((payment->>'amountCents')::bigint, 0);
  application jsonb;
  applied bigint := 0;
  result jsonb;
begin
  select * into visit_row from public.agency_visits where id=target_visit_id and tenant_id=tenant;
  if visit_row.id is null or public.current_role_slug() <> 'conductor' or not exists(select 1 from public.logistics_routes route where route.id=visit_row.route_id and route.assigned_to=auth.uid()) then raise exception 'FORBIDDEN'; end if;
  result := public.confirm_agency_visit(target_visit_id, line_confirmations, confirmation_reason, null, btrim(idempotency_key) || ':visit');
  if payment is null or payment_amount <= 0 then return result || jsonb_build_object('paymentId', null); end if;
  insert into public.agency_payments(tenant_id, matrix_organization_id, agency_organization_id, amount_cents, method, reference, created_by_membership_id, idempotency_key, metadata)
  select tenant, agency.matrix_organization_id, visit_row.organization_id, payment_amount, coalesce(nullif(btrim(payment->>'method'), ''), 'other'), coalesce(payment->>'reference', ''), membership, btrim(idempotency_key) || ':payment', jsonb_build_object('visitId', visit_row.id)
  from public.agencies agency where agency.id=visit_row.agency_id
  on conflict(tenant_id, idempotency_key) do update set idempotency_key=excluded.idempotency_key
  returning id into payment_id;
  for application in select value from jsonb_array_elements(coalesce(payment->'applications', '[]'::jsonb)) loop
    if coalesce((application->>'amountCents')::bigint, 0) <= 0 then raise exception 'APLICACION_INVALIDA'; end if;
    applied := applied + (application->>'amountCents')::bigint;
    if not exists(select 1 from public.agency_charge_balances balance join public.agency_charges charge on charge.id=balance.charge_id where charge.id=(application->>'chargeId')::uuid and charge.agency_organization_id=visit_row.organization_id and balance.outstanding_cents >= (application->>'amountCents')::bigint) then raise exception 'CARGO_INVALIDO'; end if;
    insert into public.agency_payment_applications(tenant_id, matrix_organization_id, agency_organization_id, payment_id, charge_id, amount_cents, applied_by_membership_id)
    select tenant, agency.matrix_organization_id, visit_row.organization_id, payment_id, (application->>'chargeId')::uuid, (application->>'amountCents')::bigint, membership from public.agencies agency where agency.id=visit_row.agency_id;
  end loop;
  if applied > payment_amount then raise exception 'PAGO_SOBREAPLICADO'; end if;
  if coalesce(payment->>'method', '') = 'cash' then
    insert into public.driver_cash_custody_events(tenant_id, matrix_organization_id, driver_membership_id, beneficiary_organization_id, source_type, source_id, amount_cents, collected_at, evidence, idempotency_key)
    select tenant, agency.matrix_organization_id, membership, agency.matrix_organization_id, 'matrix_receivable', payment_id, payment_amount, now(), coalesce(payment->'evidence', '{}'::jsonb), btrim(idempotency_key) || ':cash' from public.agencies agency where agency.id=visit_row.agency_id;
  end if;
  return result || jsonb_build_object('paymentId', payment_id, 'appliedCents', applied);
end;
$$;

grant execute on function public.create_agency_service_request(jsonb,date,text,text) to authenticated;
grant execute on function public.assign_agency_request_to_route(uuid,uuid,timestamptz,text) to authenticated;
grant execute on function public.complete_agency_visit_by_driver(uuid,jsonb,text,jsonb,text) to authenticated;
