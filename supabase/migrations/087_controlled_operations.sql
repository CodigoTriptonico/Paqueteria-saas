-- Controlled operations: physical custody, operational exceptions and agency daily close.
-- Facts are append-only. Current state is a small projection maintained only by RPCs.

insert into public.permissions (key, name, description) values
  ('package.custody.view', 'Ver custodia', 'Consultar quién tiene cada caja y sus recepciones'),
  ('package.custody.transfer', 'Entregar cajas', 'Iniciar traspasos físicos de cajas'),
  ('package.custody.receive', 'Recibir cajas', 'Aceptar o rechazar traspasos físicos'),
  ('exceptions.report', 'Reportar excepciones', 'Reportar entrega fallida, daño, extravío o diferencia'),
  ('exceptions.resolve', 'Resolver excepciones', 'Proponer la resolución operativa de una excepción'),
  ('exceptions.approve', 'Aprobar excepciones', 'Aprobar pérdidas, daños, liberaciones y cancelaciones'),
  ('sales.cancel_pre_departure', 'Cancelar antes de salida', 'Cancelar una venta antes de que la caja salga'),
  ('agency.daily_close.view', 'Ver cierres diarios', 'Consultar cierres y diferencias de la agencia'),
  ('agency.daily_close.prepare', 'Preparar cierre diario', 'Contar efectivo y preparar el cierre de la agencia'),
  ('agency.daily_close.finalize', 'Finalizar cierre diario', 'Congelar el cierre diario de la agencia')
on conflict (key) do update set name = excluded.name, description = excluded.description;

-- Existing agencies receive conservative templates. The administrator special-case
-- remains full access; these grants make agency roles explicitly usable as templates.
insert into public.role_permissions (role_id, permission_id, granted)
select role.id, permission.id, true
from public.roles role
join public.permissions permission on permission.key in (
  'package.custody.view', 'package.custody.transfer', 'package.custody.receive',
  'exceptions.report', 'exceptions.resolve', 'exceptions.approve',
  'sales.cancel_pre_departure', 'agency.daily_close.view',
  'agency.daily_close.prepare', 'agency.daily_close.finalize'
)
where role.slug = 'administrador_agencia'
on conflict (role_id, permission_id) do update set granted = excluded.granted;

insert into public.role_permissions (role_id, permission_id, granted)
select role.id, permission.id, true
from public.roles role
join public.permissions permission on permission.key in (
  'package.custody.view', 'exceptions.report', 'agency.daily_close.view', 'agency.daily_close.prepare'
)
where role.slug = 'caja_agencia'
on conflict (role_id, permission_id) do update set granted = excluded.granted;

insert into public.role_permissions (role_id, permission_id, granted)
select role.id, permission.id, true
from public.roles role
join public.permissions permission on permission.key in (
  'package.custody.view', 'exceptions.report'
)
where role.slug in ('vendedor_agencia', 'operador_agencia', 'conductor', 'bodega', 'logistica')
on conflict (role_id, permission_id) do update set granted = excluded.granted;

create table if not exists public.package_custody_handoffs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  package_id uuid not null references public.shipment_packages(id) on delete restrict,
  shipment_id uuid not null references public.shipments(id) on delete restrict,
  from_holder_type text not null check (from_holder_type in ('unknown', 'agency', 'conductor', 'bodega', 'paleta', 'proveedor')),
  from_holder_id uuid,
  from_holder_label text not null default '',
  to_holder_type text not null check (to_holder_type in ('agency', 'conductor', 'bodega', 'paleta', 'proveedor')),
  to_holder_id uuid,
  to_holder_label text not null default '',
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  initiated_by uuid not null references public.profiles(id) on delete restrict,
  initiated_at timestamptz not null default now(),
  received_by uuid references public.profiles(id) on delete restrict,
  received_at timestamptz,
  rejected_by uuid references public.profiles(id) on delete restrict,
  rejected_at timestamptz,
  reason text not null default '',
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence) = 'object'),
  receive_evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(receive_evidence) = 'object'),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  check ((status = 'pending' and received_at is null and rejected_at is null) or status <> 'pending'),
  unique (organization_id, idempotency_key)
);

create unique index if not exists package_custody_one_pending_idx
  on public.package_custody_handoffs(package_id) where status = 'pending';
create index if not exists package_custody_package_history_idx
  on public.package_custody_handoffs(package_id, initiated_at desc);

create table if not exists public.operational_exceptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  package_id uuid references public.shipment_packages(id) on delete restrict,
  shipment_id uuid references public.shipments(id) on delete restrict,
  logistics_task_id uuid references public.shipment_logistics_tasks(id) on delete set null,
  exception_type text not null check (exception_type in ('not_delivered', 'damaged', 'lost', 'weight_difference', 'cancel_pre_departure')),
  status text not null default 'open' check (status in ('open', 'in_resolution', 'pending_approval', 'resolved', 'rejected')),
  blocks_release boolean not null default false,
  reason text not null check (btrim(reason) <> ''),
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence) = 'object'),
  reported_by uuid not null references public.profiles(id) on delete restrict,
  reported_at timestamptz not null default now(),
  resolution text not null default '',
  resolved_by uuid references public.profiles(id) on delete restrict,
  resolved_at timestamptz,
  approved_by uuid references public.profiles(id) on delete restrict,
  approved_at timestamptz,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create unique index if not exists operational_exception_one_open_weight_idx
  on public.operational_exceptions(package_id, exception_type)
  where exception_type = 'weight_difference' and status in ('open', 'in_resolution', 'pending_approval');
create index if not exists operational_exceptions_scope_status_idx
  on public.operational_exceptions(organization_id, status, reported_at desc);

create table if not exists public.operational_exception_events (
  id uuid primary key default gen_random_uuid(),
  exception_id uuid not null references public.operational_exceptions(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_type text not null check (event_type in ('reported', 'resolution_proposed', 'approved', 'rejected')),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  note text not null default '',
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists operational_exception_events_history_idx
  on public.operational_exception_events(exception_id, created_at);

create table if not exists public.agency_daily_closures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  operating_date date not null,
  timezone text not null default 'America/Los_Angeles',
  status text not null default 'prepared' check (status in ('prepared', 'closed')),
  expected_cash_cents bigint not null check (expected_cash_cents >= 0),
  counted_cash_cents bigint not null check (counted_cash_cents >= 0),
  difference_cents bigint generated always as (counted_cash_cents - expected_cash_cents) stored,
  difference_reason text not null default '',
  summary jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object'),
  prepared_by uuid not null references public.profiles(id) on delete restrict,
  prepared_at timestamptz not null default now(),
  finalized_by uuid references public.profiles(id) on delete restrict,
  finalized_at timestamptz,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  check (difference_cents = 0 or btrim(difference_reason) <> ''),
  unique (organization_id, operating_date),
  unique (organization_id, idempotency_key)
);

create table if not exists public.agency_daily_closure_events (
  id uuid primary key default gen_random_uuid(),
  closure_id uuid not null references public.agency_daily_closures(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  event_type text not null check (event_type in ('prepared', 'finalized')),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists agency_daily_closures_recent_idx
  on public.agency_daily_closures(organization_id, operating_date desc);

alter table public.package_custody_handoffs enable row level security;
alter table public.operational_exceptions enable row level security;
alter table public.operational_exception_events enable row level security;
alter table public.agency_daily_closures enable row level security;
alter table public.agency_daily_closure_events enable row level security;

create policy package_custody_read on public.package_custody_handoffs for select
  using (organization_id = public.current_organization_id() and public.user_has_permission('package.custody.view'));
create policy operational_exceptions_read on public.operational_exceptions for select
  using (organization_id = public.current_organization_id() and public.user_has_permission('exceptions.report'));
create policy operational_exception_events_read on public.operational_exception_events for select
  using (organization_id = public.current_organization_id() and public.user_has_permission('exceptions.report'));
create policy agency_daily_closures_read on public.agency_daily_closures for select
  using (organization_id = public.current_organization_id() and public.user_has_permission('agency.daily_close.view'));
create policy agency_daily_closure_events_read on public.agency_daily_closure_events for select
  using (organization_id = public.current_organization_id() and public.user_has_permission('agency.daily_close.view'));

create or replace function public.controlled_operations_immutable()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  raise exception 'IMMUTABLE_CONTROLLED_OPERATION';
end;
$$;

drop trigger if exists package_custody_handoffs_immutable on public.package_custody_handoffs;
create trigger package_custody_handoffs_immutable before delete on public.package_custody_handoffs for each row execute function public.controlled_operations_immutable();
drop trigger if exists operational_exception_events_immutable on public.operational_exception_events;
create trigger operational_exception_events_immutable before update or delete on public.operational_exception_events for each row execute function public.controlled_operations_immutable();
drop trigger if exists agency_daily_closure_events_immutable on public.agency_daily_closure_events;
create trigger agency_daily_closure_events_immutable before update or delete on public.agency_daily_closure_events for each row execute function public.controlled_operations_immutable();

create or replace function public.package_has_blocking_exception(target_package_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.operational_exceptions
    where package_id = target_package_id
      and blocks_release = true
      and status in ('open', 'in_resolution', 'pending_approval')
  );
$$;

create or replace function public.prevent_blocked_package_release()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'handed_to_carrier' and public.package_has_blocking_exception(new.id) then
    raise exception 'PACKAGE_EXCEPTION_BLOCKS_RELEASE';
  end if;
  return new;
end;
$$;

drop trigger if exists shipment_packages_blocked_release on public.shipment_packages;
create trigger shipment_packages_blocked_release
  before update of status on public.shipment_packages
  for each row execute function public.prevent_blocked_package_release();

create or replace function public.initiate_package_custody_handoff(
  target_package_id uuid,
  target_holder_type text,
  target_holder_id uuid,
  target_holder_label text,
  handoff_reason text,
  handoff_evidence jsonb,
  operation_key text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  package_row public.shipment_packages;
  current_handoff public.package_custody_handoffs;
  new_handoff public.package_custody_handoffs;
begin
  if auth.uid() is null or not public.user_has_permission('package.custody.transfer') then raise exception 'FORBIDDEN'; end if;
  if coalesce(nullif(btrim(operation_key), ''), '') = '' or jsonb_typeof(coalesce(handoff_evidence, '{}'::jsonb)) <> 'object' then raise exception 'CUSTODY_INPUT_INVALID'; end if;
  if target_holder_type not in ('agency', 'conductor', 'bodega', 'paleta', 'proveedor') then raise exception 'CUSTODY_HOLDER_INVALID'; end if;
  select * into package_row from public.shipment_packages where id = target_package_id and organization_id = public.current_organization_id() for update;
  if package_row.id is null then raise exception 'PACKAGE_NOT_FOUND'; end if;
  if exists(select 1 from public.package_custody_handoffs where package_id = package_row.id and status = 'pending') then raise exception 'PACKAGE_HANDOFF_PENDING'; end if;
  select * into current_handoff from public.package_custody_handoffs where package_id = package_row.id and status = 'accepted' order by received_at desc nulls last, initiated_at desc limit 1;
  insert into public.package_custody_handoffs (
    organization_id, package_id, shipment_id, from_holder_type, from_holder_id, from_holder_label,
    to_holder_type, to_holder_id, to_holder_label, initiated_by, reason, evidence, idempotency_key
  ) values (
    package_row.organization_id, package_row.id, package_row.shipment_id,
    coalesce(current_handoff.to_holder_type, 'unknown'), current_handoff.to_holder_id, coalesce(current_handoff.to_holder_label, ''),
    target_holder_type, target_holder_id, btrim(coalesce(target_holder_label, '')), auth.uid(), btrim(coalesce(handoff_reason, '')),
    coalesce(handoff_evidence, '{}'::jsonb), btrim(operation_key)
  ) on conflict (organization_id, idempotency_key) do update set idempotency_key = excluded.idempotency_key
  returning * into new_handoff;
  return jsonb_build_object('handoffId', new_handoff.id, 'status', new_handoff.status, 'replayed', new_handoff.initiated_by <> auth.uid());
end;
$$;

create or replace function public.accept_package_custody_handoff(
  target_handoff_id uuid,
  receive_evidence_value jsonb,
  operation_key text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare handoff public.package_custody_handoffs;
begin
  if auth.uid() is null or not public.user_has_permission('package.custody.receive') then raise exception 'FORBIDDEN'; end if;
  if jsonb_typeof(coalesce(receive_evidence_value, '{}'::jsonb)) <> 'object' then raise exception 'CUSTODY_EVIDENCE_INVALID'; end if;
  select * into handoff from public.package_custody_handoffs where id = target_handoff_id and organization_id = public.current_organization_id() for update;
  if handoff.id is null then raise exception 'CUSTODY_HANDOFF_NOT_FOUND'; end if;
  if handoff.status = 'accepted' then return jsonb_build_object('handoffId', handoff.id, 'status', 'accepted', 'replayed', true); end if;
  if handoff.status <> 'pending' then raise exception 'CUSTODY_HANDOFF_NOT_PENDING'; end if;
  if handoff.initiated_by = auth.uid() then raise exception 'CUSTODY_RECEIVER_MUST_BE_DISTINCT'; end if;
  update public.package_custody_handoffs set status = 'accepted', received_by = auth.uid(), received_at = now(), receive_evidence = coalesce(receive_evidence_value, '{}'::jsonb) where id = handoff.id;
  return jsonb_build_object('handoffId', handoff.id, 'status', 'accepted', 'replayed', false);
end;
$$;

create or replace function public.reject_package_custody_handoff(
  target_handoff_id uuid,
  rejection_reason text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare handoff public.package_custody_handoffs;
begin
  if auth.uid() is null or not public.user_has_permission('package.custody.receive') then raise exception 'FORBIDDEN'; end if;
  if nullif(btrim(rejection_reason), '') is null then raise exception 'CUSTODY_REJECTION_REASON_REQUIRED'; end if;
  select * into handoff from public.package_custody_handoffs where id = target_handoff_id and organization_id = public.current_organization_id() for update;
  if handoff.id is null or handoff.status <> 'pending' then raise exception 'CUSTODY_HANDOFF_NOT_PENDING'; end if;
  update public.package_custody_handoffs set status = 'rejected', rejected_by = auth.uid(), rejected_at = now(), reason = btrim(rejection_reason) where id = handoff.id;
  return jsonb_build_object('handoffId', handoff.id, 'status', 'rejected');
end;
$$;

create or replace function public.report_operational_exception(
  target_package_id uuid,
  target_task_id uuid,
  exception_kind text,
  exception_reason text,
  exception_evidence jsonb,
  operation_key text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare package_row public.shipment_packages; exception_row public.operational_exceptions; blocking boolean;
begin
  if auth.uid() is null or not public.user_has_permission('exceptions.report') then raise exception 'FORBIDDEN'; end if;
  if exception_kind not in ('not_delivered', 'damaged', 'lost', 'weight_difference', 'cancel_pre_departure') or nullif(btrim(exception_reason), '') is null then raise exception 'EXCEPTION_INPUT_INVALID'; end if;
  if jsonb_typeof(coalesce(exception_evidence, '{}'::jsonb)) <> 'object' then raise exception 'EXCEPTION_EVIDENCE_INVALID'; end if;
  select * into package_row from public.shipment_packages where id = target_package_id and organization_id = public.current_organization_id();
  if package_row.id is null then raise exception 'PACKAGE_NOT_FOUND'; end if;
  blocking := exception_kind in ('damaged', 'lost', 'weight_difference');
  insert into public.operational_exceptions (organization_id, package_id, shipment_id, logistics_task_id, exception_type, blocks_release, reason, evidence, reported_by, idempotency_key)
  values (package_row.organization_id, package_row.id, package_row.shipment_id, target_task_id, exception_kind, blocking, btrim(exception_reason), coalesce(exception_evidence, '{}'::jsonb), auth.uid(), btrim(operation_key))
  on conflict (organization_id, idempotency_key) do update set idempotency_key = excluded.idempotency_key
  returning * into exception_row;
  insert into public.operational_exception_events(exception_id, organization_id, event_type, actor_id, note, evidence)
  values (exception_row.id, package_row.organization_id, 'reported', auth.uid(), exception_row.reason, exception_row.evidence);
  return jsonb_build_object('exceptionId', exception_row.id, 'status', exception_row.status, 'replayed', false);
end;
$$;

create or replace function public.resolve_operational_exception(
  target_exception_id uuid,
  resolution_note text,
  resolution_evidence jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare exception_row public.operational_exceptions; needs_approval boolean;
begin
  if auth.uid() is null or not public.user_has_permission('exceptions.resolve') then raise exception 'FORBIDDEN'; end if;
  if nullif(btrim(resolution_note), '') is null or jsonb_typeof(coalesce(resolution_evidence, '{}'::jsonb)) <> 'object' then raise exception 'EXCEPTION_RESOLUTION_INVALID'; end if;
  select * into exception_row from public.operational_exceptions where id = target_exception_id and organization_id = public.current_organization_id() for update;
  if exception_row.id is null or exception_row.status not in ('open', 'in_resolution') then raise exception 'EXCEPTION_NOT_RESOLVABLE'; end if;
  needs_approval := exception_row.exception_type in ('damaged', 'lost', 'weight_difference', 'cancel_pre_departure');
  update public.operational_exceptions set status = case when needs_approval then 'pending_approval' else 'resolved' end, resolution = btrim(resolution_note), resolved_by = auth.uid(), resolved_at = now() where id = exception_row.id;
  insert into public.operational_exception_events(exception_id, organization_id, event_type, actor_id, note, evidence)
  values (exception_row.id, exception_row.organization_id, 'resolution_proposed', auth.uid(), btrim(resolution_note), coalesce(resolution_evidence, '{}'::jsonb));
  return jsonb_build_object('exceptionId', exception_row.id, 'status', case when needs_approval then 'pending_approval' else 'resolved' end);
end;
$$;

-- A weighed mismatch is never just a yellow badge. Reception creates the
-- controlled exception in the same database transaction that records the weight.
create or replace function public.capture_weight_difference_exception()
returns trigger language plpgsql security definer set search_path = public as $$
declare exception_row public.operational_exceptions;
begin
  if new.weight_difference_kg is null or new.weight_difference_kg <= 0 then return new; end if;
  if exists (
    select 1 from public.operational_exceptions
    where package_id = new.id and exception_type = 'weight_difference'
      and status in ('open', 'in_resolution', 'pending_approval')
  ) then return new; end if;
  insert into public.operational_exceptions (
    organization_id, package_id, shipment_id, exception_type, blocks_release, reason,
    evidence, reported_by, idempotency_key
  ) values (
    new.organization_id, new.id, new.shipment_id, 'weight_difference', true,
    coalesce(nullif(btrim(new.weight_difference_note), ''), 'Diferencia de peso detectada en ingreso a bodega'),
    jsonb_build_object('collectionWeightKg', new.collection_weight_kg, 'intakeWeightKg', new.intake_weight_kg, 'differenceKg', new.weight_difference_kg),
    coalesce(new.intake_recorded_by, auth.uid()), 'weight:' || new.id::text || ':' || coalesce(new.intake_recorded_at::text, now()::text)
  ) returning * into exception_row;
  insert into public.operational_exception_events(exception_id, organization_id, event_type, actor_id, note, evidence)
  values (exception_row.id, new.organization_id, 'reported', coalesce(new.intake_recorded_by, auth.uid()), exception_row.reason, exception_row.evidence);
  return new;
end;
$$;

drop trigger if exists shipment_packages_weight_exception on public.shipment_packages;
create trigger shipment_packages_weight_exception
  after update of intake_weight_kg, weight_difference_kg on public.shipment_packages
  for each row execute function public.capture_weight_difference_exception();

create or replace function public.approve_operational_exception(target_exception_id uuid, approval_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare exception_row public.operational_exceptions;
begin
  if auth.uid() is null or not public.user_has_permission('exceptions.approve') then raise exception 'FORBIDDEN'; end if;
  select * into exception_row from public.operational_exceptions where id = target_exception_id and organization_id = public.current_organization_id() for update;
  if exception_row.id is null or exception_row.status <> 'pending_approval' then raise exception 'EXCEPTION_NOT_PENDING_APPROVAL'; end if;
  if auth.uid() in (exception_row.reported_by, exception_row.resolved_by) then raise exception 'EXCEPTION_APPROVER_MUST_BE_DISTINCT'; end if;
  update public.operational_exceptions set status = 'resolved', approved_by = auth.uid(), approved_at = now() where id = exception_row.id;
  insert into public.operational_exception_events(exception_id, organization_id, event_type, actor_id, note)
  values (exception_row.id, exception_row.organization_id, 'approved', auth.uid(), btrim(coalesce(approval_note, '')));
  return jsonb_build_object('exceptionId', exception_row.id, 'status', 'resolved');
end;
$$;

create or replace function public.agency_daily_close_summary(target_organization_id uuid, target_date date, target_timezone text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare start_at timestamptz; end_at timestamptz;
begin
  start_at := (target_date::timestamp at time zone target_timezone);
  end_at := ((target_date + 1)::timestamp at time zone target_timezone);
  return jsonb_build_object(
    'salesCount', (select count(*) from public.sales where selling_organization_id = target_organization_id and created_at >= start_at and created_at < end_at and status = 'confirmed'),
    'salesCents', (select coalesce(sum(total_cents), 0) from public.sales where selling_organization_id = target_organization_id and created_at >= start_at and created_at < end_at and status = 'confirmed'),
    'customerPaymentsCents', (select coalesce(sum(amount_cents), 0) from public.customer_payments where organization_id = target_organization_id and received_at >= start_at and received_at < end_at),
    'expectedCashCents', (select coalesce(sum(amount_cents), 0) from public.customer_payments where organization_id = target_organization_id and received_at >= start_at and received_at < end_at and lower(method) = 'cash'),
    'agencyPaymentsCents', (select coalesce(sum(amount_cents), 0) from public.agency_payments where agency_organization_id = target_organization_id and created_at >= start_at and created_at < end_at),
    'shipmentsCreated', (select count(*) from public.shipments where organization_id = target_organization_id and created_at >= start_at and created_at < end_at),
    'pendingCustody', (select count(*) from public.package_custody_handoffs where organization_id = target_organization_id and status = 'pending'),
    'openExceptions', (select count(*) from public.operational_exceptions where organization_id = target_organization_id and status in ('open', 'in_resolution', 'pending_approval'))
  );
end;
$$;

create or replace function public.prepare_agency_daily_close(
  target_date date,
  target_timezone text,
  counted_cash bigint,
  close_difference_reason text,
  operation_key text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare org_id uuid := public.current_organization_id(); summary_value jsonb; expected_cash bigint; closure_row public.agency_daily_closures;
begin
  if auth.uid() is null or not public.user_has_permission('agency.daily_close.prepare') then raise exception 'FORBIDDEN'; end if;
  if target_date is null or counted_cash < 0 or nullif(btrim(operation_key), '') is null then raise exception 'DAILY_CLOSE_INPUT_INVALID'; end if;
  if not exists(select 1 from public.organizations where id = org_id and organization_type = 'agency') then raise exception 'AGENCY_REQUIRED'; end if;
  if exists(select 1 from public.agency_daily_closures where organization_id = org_id and operating_date = target_date and status = 'closed') then raise exception 'DAILY_CLOSE_ALREADY_FINALIZED'; end if;
  summary_value := public.agency_daily_close_summary(org_id, target_date, coalesce(nullif(btrim(target_timezone), ''), 'America/Los_Angeles'));
  expected_cash := coalesce((summary_value->>'expectedCashCents')::bigint, 0);
  if expected_cash <> counted_cash and nullif(btrim(close_difference_reason), '') is null then raise exception 'DAILY_CLOSE_DIFFERENCE_REASON_REQUIRED'; end if;
  insert into public.agency_daily_closures(organization_id, operating_date, timezone, expected_cash_cents, counted_cash_cents, difference_reason, summary, prepared_by, idempotency_key)
  values (org_id, target_date, coalesce(nullif(btrim(target_timezone), ''), 'America/Los_Angeles'), expected_cash, counted_cash, btrim(coalesce(close_difference_reason, '')), summary_value, auth.uid(), btrim(operation_key))
  on conflict (organization_id, operating_date) do update set timezone = excluded.timezone, expected_cash_cents = excluded.expected_cash_cents, counted_cash_cents = excluded.counted_cash_cents, difference_reason = excluded.difference_reason, summary = excluded.summary, prepared_by = excluded.prepared_by, prepared_at = now(), idempotency_key = excluded.idempotency_key
  returning * into closure_row;
  insert into public.agency_daily_closure_events(closure_id, organization_id, event_type, actor_id, snapshot) values (closure_row.id, org_id, 'prepared', auth.uid(), jsonb_build_object('summary', summary_value, 'countedCashCents', counted_cash));
  return jsonb_build_object('closureId', closure_row.id, 'status', closure_row.status, 'summary', closure_row.summary, 'expectedCashCents', closure_row.expected_cash_cents, 'countedCashCents', closure_row.counted_cash_cents, 'differenceCents', closure_row.difference_cents);
end;
$$;

create or replace function public.finalize_agency_daily_close(target_closure_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare closure_row public.agency_daily_closures;
begin
  if auth.uid() is null or not public.user_has_permission('agency.daily_close.finalize') then raise exception 'FORBIDDEN'; end if;
  select * into closure_row from public.agency_daily_closures where id = target_closure_id and organization_id = public.current_organization_id() for update;
  if closure_row.id is null or closure_row.status <> 'prepared' then raise exception 'DAILY_CLOSE_NOT_PREPARED'; end if;
  if closure_row.prepared_by = auth.uid() then raise exception 'DAILY_CLOSE_FINALIZER_MUST_BE_DISTINCT'; end if;
  update public.agency_daily_closures set status = 'closed', finalized_by = auth.uid(), finalized_at = now() where id = closure_row.id;
  insert into public.agency_daily_closure_events(closure_id, organization_id, event_type, actor_id, snapshot) values (closure_row.id, closure_row.organization_id, 'finalized', auth.uid(), closure_row.summary);
  return jsonb_build_object('closureId', closure_row.id, 'status', 'closed');
end;
$$;

revoke insert, update, delete on public.package_custody_handoffs from authenticated;
revoke insert, update, delete on public.operational_exceptions from authenticated;
revoke insert, update, delete on public.operational_exception_events from authenticated;
revoke insert, update, delete on public.agency_daily_closures from authenticated;
revoke insert, update, delete on public.agency_daily_closure_events from authenticated;
grant execute on function public.initiate_package_custody_handoff(uuid, text, uuid, text, text, jsonb, text) to authenticated;
grant execute on function public.accept_package_custody_handoff(uuid, jsonb, text) to authenticated;
grant execute on function public.reject_package_custody_handoff(uuid, text) to authenticated;
grant execute on function public.report_operational_exception(uuid, uuid, text, text, jsonb, text) to authenticated;
grant execute on function public.resolve_operational_exception(uuid, text, jsonb) to authenticated;
grant execute on function public.approve_operational_exception(uuid, text) to authenticated;
grant execute on function public.agency_daily_close_summary(uuid, date, text) to authenticated;
grant execute on function public.prepare_agency_daily_close(date, text, bigint, text, text) to authenticated;
grant execute on function public.finalize_agency_daily_close(uuid) to authenticated;
