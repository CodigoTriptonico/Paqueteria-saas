-- Every physical package transition produces an immutable custody fact.
-- The latest fact is the deterministic answer to: who has this box now?

alter table public.package_custody_handoffs
  drop constraint if exists package_custody_handoffs_from_holder_type_check,
  drop constraint if exists package_custody_handoffs_to_holder_type_check;

alter table public.package_custody_handoffs
  add constraint package_custody_handoffs_from_holder_type_check
    check (from_holder_type in ('unknown', 'cliente', 'agency', 'conductor', 'bodega', 'paleta', 'proveedor')),
  add constraint package_custody_handoffs_to_holder_type_check
    check (to_holder_type in ('cliente', 'agency', 'conductor', 'bodega', 'paleta', 'proveedor'));

create table if not exists public.package_custody_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  package_id uuid not null references public.shipment_packages(id) on delete restrict,
  shipment_id uuid not null references public.shipments(id) on delete restrict,
  event_type text not null check (event_type in (
    'created', 'collected', 'unloaded', 'intake_confirmed', 'placed_in_warehouse',
    'palletized', 'released_to_carrier', 'manual_handoff', 'status_correction'
  )),
  from_holder_type text check (from_holder_type is null or from_holder_type in ('cliente', 'agency', 'conductor', 'bodega', 'paleta', 'proveedor')),
  from_holder_id uuid,
  from_holder_label text not null default '',
  to_holder_type text not null check (to_holder_type in ('cliente', 'agency', 'conductor', 'bodega', 'paleta', 'proveedor')),
  to_holder_id uuid,
  to_holder_label text not null default '',
  package_status text not null,
  actor_id uuid references public.profiles(id) on delete set null,
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence) = 'object'),
  source text not null check (source in ('package_status', 'manual_handoff', 'backfill')),
  occurred_at timestamptz not null default now(),
  event_key text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, event_key)
);

create index if not exists package_custody_events_package_history_idx
  on public.package_custody_events(package_id, occurred_at desc, created_at desc);
create index if not exists package_custody_events_org_current_idx
  on public.package_custody_events(organization_id, occurred_at desc, created_at desc);

alter table public.package_custody_events enable row level security;
create policy package_custody_events_read on public.package_custody_events for select
  using (
    organization_id = public.current_organization_id()
    and public.user_has_permission('package.custody.view')
  );

create or replace function public.package_custody_events_immutable()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  raise exception 'IMMUTABLE_PACKAGE_CUSTODY_EVENT';
end;
$$;

drop trigger if exists package_custody_events_immutable on public.package_custody_events;
create trigger package_custody_events_immutable
  before update or delete on public.package_custody_events
  for each row execute function public.package_custody_events_immutable();

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
begin
  if effective_status = 'awaiting_full_box' then
    select nullif(btrim(concat_ws(' ',
      shipment.recipient_snapshot ->> 'firstName',
      shipment.recipient_snapshot ->> 'lastName'
    )), '') into recipient_label
    from public.shipments shipment where shipment.id = target_package.shipment_id;
    return query select 'cliente'::text, null::uuid, coalesce(recipient_label, 'Cliente pendiente de caja llena');
  elsif effective_status = 'in_truck' then
    select route.assigned_to, coalesce(nullif(btrim(profile.full_name), ''), profile.email, 'Conductor asignado')
      into route_driver_id, route_driver_label
    from public.logistics_routes route
    left join public.profiles profile on profile.id = route.assigned_to
    where route.id = target_package.truck_route_id;
    return query select 'conductor'::text, route_driver_id, coalesce(route_driver_label, 'Conductor sin identificar');
  elsif effective_status = 'on_pallet' then
    select pallet.code into pallet_label from public.warehouse_pallets pallet where pallet.id = target_package.pallet_id;
    return query select 'paleta'::text, target_package.pallet_id, coalesce(nullif(btrim(pallet_label), ''), 'Paleta sin código');
  elsif effective_status = 'handed_to_carrier' then
    return query select 'proveedor'::text, null::uuid, coalesce(nullif(btrim(target_package.provider_name), ''), 'Proveedor sin identificar');
  end if;

  return query select 'bodega'::text, null::uuid, 'Bodega';
end;
$$;

create or replace function public.package_custody_event_type_for_status(target_status text)
returns text language sql immutable as $$
  select case target_status
    when 'in_truck' then 'collected'
    when 'pending_intake' then 'unloaded'
    when 'warehouse_intake' then 'intake_confirmed'
    when 'in_warehouse' then 'placed_in_warehouse'
    when 'on_pallet' then 'palletized'
    when 'handed_to_carrier' then 'released_to_carrier'
    else 'status_correction'
  end;
$$;

create or replace function public.record_package_custody_status_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  previous_holder record;
  next_holder record;
  event_actor_id uuid;
  event_type_value text;
  event_key_value text;
begin
  select * into next_holder from public.resolve_package_custody_holder(new);
  if tg_op = 'INSERT' then
    event_type_value := 'created';
    event_key_value := 'created:' || new.id::text;
  else
    if new.status is not distinct from old.status
      and new.truck_route_id is not distinct from old.truck_route_id
      and new.pallet_id is not distinct from old.pallet_id
      and new.provider_name is not distinct from old.provider_name then
      return new;
    end if;
    select * into previous_holder from public.resolve_package_custody_holder(old);
    event_type_value := public.package_custody_event_type_for_status(new.status);
    event_key_value := 'status:' || new.id::text || ':' || new.status || ':' || new.updated_at::text;
  end if;

  event_actor_id := case new.status
    when 'pending_intake' then new.truck_unloaded_by
    when 'warehouse_intake' then new.intake_recorded_by
    when 'in_warehouse' then new.warehouse_placed_by
    when 'on_pallet' then new.palletized_by
    else auth.uid()
  end;
  if event_actor_id is null and new.status = 'in_truck' then
    event_actor_id := next_holder.holder_id;
  end if;

  insert into public.package_custody_events (
    organization_id, package_id, shipment_id, event_type,
    from_holder_type, from_holder_id, from_holder_label,
    to_holder_type, to_holder_id, to_holder_label,
    package_status, actor_id, evidence, source, occurred_at, event_key
  ) values (
    new.organization_id, new.id, new.shipment_id, event_type_value,
    case when tg_op = 'INSERT' then null else previous_holder.holder_type end,
    case when tg_op = 'INSERT' then null else previous_holder.holder_id end,
    case when tg_op = 'INSERT' then '' else previous_holder.holder_label end,
    next_holder.holder_type, next_holder.holder_id, next_holder.holder_label,
    new.status, event_actor_id,
    jsonb_strip_nulls(jsonb_build_object('collectionWeightKg', new.collection_weight_kg, 'intakeWeightKg', new.intake_weight_kg, 'palletId', new.pallet_id, 'routeId', new.truck_route_id)),
    'package_status', coalesce(new.updated_at, now()), event_key_value
  ) on conflict (organization_id, event_key) do nothing;
  return new;
end;
$$;

drop trigger if exists shipment_packages_custody_timeline on public.shipment_packages;
create trigger shipment_packages_custody_timeline
  after insert or update of status, truck_route_id, pallet_id, provider_name on public.shipment_packages
  for each row execute function public.record_package_custody_status_event();

-- Existing rows get an honest baseline. New transitions are recorded by the trigger above.
insert into public.package_custody_events (
  organization_id, package_id, shipment_id, event_type,
  to_holder_type, to_holder_id, to_holder_label,
  package_status, actor_id, evidence, source, occurred_at, event_key
)
select
  package.organization_id, package.id, package.shipment_id, 'status_correction',
  holder.holder_type, holder.holder_id, holder.holder_label,
  package.status,
  case package.status
    when 'pending_intake' then package.truck_unloaded_by
    when 'warehouse_intake' then package.intake_recorded_by
    when 'in_warehouse' then package.warehouse_placed_by
    when 'on_pallet' then package.palletized_by
    else null
  end,
  jsonb_build_object('note', 'Estado físico existente al activar la cadena de custodia'),
  'backfill', coalesce(package.updated_at, package.created_at), 'baseline:' || package.id::text
from public.shipment_packages package
cross join lateral public.resolve_package_custody_holder(package) holder
on conflict (organization_id, event_key) do nothing;

insert into public.package_custody_events (
  organization_id, package_id, shipment_id, event_type,
  from_holder_type, from_holder_id, from_holder_label,
  to_holder_type, to_holder_id, to_holder_label,
  package_status, actor_id, evidence, source, occurred_at, event_key
)
select
  handoff.organization_id, handoff.package_id, handoff.shipment_id, 'manual_handoff',
  handoff.from_holder_type, handoff.from_holder_id, handoff.from_holder_label,
  handoff.to_holder_type, handoff.to_holder_id, handoff.to_holder_label,
  package.status, handoff.received_by,
  handoff.receive_evidence, 'manual_handoff', coalesce(handoff.received_at, handoff.initiated_at), 'handoff:' || handoff.id::text
from public.package_custody_handoffs handoff
join public.shipment_packages package on package.id = handoff.package_id
where handoff.status = 'accepted'
on conflict (organization_id, event_key) do nothing;

create or replace view public.package_custody_current
with (security_invoker = true) as
select distinct on (event.package_id)
  event.package_id, event.shipment_id, event.organization_id,
  event.to_holder_type as holder_type, event.to_holder_id as holder_id,
  event.to_holder_label as holder_label, event.package_status,
  event.actor_id, event.occurred_at, event.id as custody_event_id
from public.package_custody_events event
order by event.package_id, event.occurred_at desc, event.created_at desc, event.id desc;

create or replace function public.accept_package_custody_handoff(
  target_handoff_id uuid,
  receive_evidence_value jsonb,
  operation_key text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  handoff public.package_custody_handoffs;
  package_row public.shipment_packages;
begin
  if auth.uid() is null or not public.user_has_permission('package.custody.receive') then raise exception 'FORBIDDEN'; end if;
  if jsonb_typeof(coalesce(receive_evidence_value, '{}'::jsonb)) <> 'object' or receive_evidence_value = '{}'::jsonb then raise exception 'CUSTODY_EVIDENCE_REQUIRED'; end if;
  if coalesce(nullif(btrim(operation_key), ''), '') = '' then raise exception 'CUSTODY_OPERATION_KEY_REQUIRED'; end if;
  select * into handoff from public.package_custody_handoffs where id = target_handoff_id and organization_id = public.current_organization_id() for update;
  if handoff.id is null then raise exception 'CUSTODY_HANDOFF_NOT_FOUND'; end if;
  if handoff.status = 'accepted' then return jsonb_build_object('handoffId', handoff.id, 'status', 'accepted', 'replayed', true); end if;
  if handoff.status <> 'pending' then raise exception 'CUSTODY_HANDOFF_NOT_PENDING'; end if;
  if handoff.initiated_by = auth.uid() then raise exception 'CUSTODY_RECEIVER_MUST_BE_DISTINCT'; end if;
  update public.package_custody_handoffs
    set status = 'accepted', received_by = auth.uid(), received_at = now(), receive_evidence = receive_evidence_value
    where id = handoff.id
    returning * into handoff;
  select * into package_row from public.shipment_packages where id = handoff.package_id;
  insert into public.package_custody_events (
    organization_id, package_id, shipment_id, event_type,
    from_holder_type, from_holder_id, from_holder_label,
    to_holder_type, to_holder_id, to_holder_label,
    package_status, actor_id, evidence, source, occurred_at, event_key
  ) values (
    handoff.organization_id, handoff.package_id, handoff.shipment_id, 'manual_handoff',
    handoff.from_holder_type, handoff.from_holder_id, handoff.from_holder_label,
    handoff.to_holder_type, handoff.to_holder_id, handoff.to_holder_label,
    package_row.status, auth.uid(), receive_evidence_value, 'manual_handoff', handoff.received_at, 'handoff:' || handoff.id::text
  ) on conflict (organization_id, event_key) do nothing;
  return jsonb_build_object('handoffId', handoff.id, 'status', 'accepted', 'replayed', false);
end;
$$;
