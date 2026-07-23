-- Enforce designated custody, close invariants and agency minimum prices.

insert into public.permissions (key, name, description)
values (
  'package.custody.receive.delegated',
  'Recibir custodia delegada',
  'Aceptar traspasos dirigidos a un almacén o entidad colectiva'
)
on conflict (key) do update
set name = excluded.name, description = excluded.description;

insert into public.role_permissions (role_id, permission_id, granted)
select role.id, permission.id, true
from public.roles role
join public.permissions permission
  on permission.key = 'package.custody.receive.delegated'
where role.slug = 'administrador'
on conflict (role_id, permission_id) do update set granted = true;

create or replace function public.accept_package_custody_handoff(
  target_handoff_id uuid,
  receive_evidence_value jsonb,
  operation_key text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  handoff public.package_custody_handoffs;
  package_row public.shipment_packages;
begin
  if auth.uid() is null or not public.user_has_permission('package.custody.receive') then
    raise exception 'FORBIDDEN';
  end if;
  if jsonb_typeof(coalesce(receive_evidence_value, '{}'::jsonb)) <> 'object'
     or receive_evidence_value = '{}'::jsonb then
    raise exception 'CUSTODY_EVIDENCE_REQUIRED';
  end if;
  if coalesce(nullif(btrim(operation_key), ''), '') = '' then
    raise exception 'CUSTODY_OPERATION_KEY_REQUIRED';
  end if;

  select * into handoff
  from public.package_custody_handoffs
  where id = target_handoff_id
    and organization_id = public.current_organization_id()
  for update;

  if handoff.id is null then raise exception 'CUSTODY_HANDOFF_NOT_FOUND'; end if;
  if handoff.status = 'accepted' then
    return jsonb_build_object('handoffId', handoff.id, 'status', 'accepted', 'replayed', true);
  end if;
  if handoff.status <> 'pending' then raise exception 'CUSTODY_HANDOFF_NOT_PENDING'; end if;
  if handoff.initiated_by = auth.uid() then raise exception 'CUSTODY_RECEIVER_MUST_BE_DISTINCT'; end if;

  if handoff.to_holder_id is not null
     and handoff.to_holder_id <> auth.uid()
     and not public.user_has_permission('package.custody.receive.delegated') then
    raise exception 'CUSTODY_DESIGNATED_RECEIVER_REQUIRED';
  end if;
  if handoff.to_holder_id is null
     and not public.user_has_permission('package.custody.receive.delegated') then
    raise exception 'CUSTODY_DELEGATION_REQUIRED';
  end if;

  update public.package_custody_handoffs
  set status = 'accepted',
      received_by = auth.uid(),
      received_at = now(),
      receive_evidence = receive_evidence_value
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
    package_row.status, auth.uid(), receive_evidence_value, 'manual_handoff',
    handoff.received_at, 'handoff:' || handoff.id::text
  ) on conflict (organization_id, event_key) do nothing;

  return jsonb_build_object('handoffId', handoff.id, 'status', 'accepted', 'replayed', false);
end;
$$;

revoke execute on function public.accept_package_custody_handoff(uuid, jsonb, text)
  from public, anon;
grant execute on function public.accept_package_custody_handoff(uuid, jsonb, text)
  to authenticated;

create or replace function public.finalize_agency_daily_close(target_closure_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  closure_row public.agency_daily_closures;
  current_summary jsonb;
begin
  if auth.uid() is null or not public.user_has_permission('agency.daily_close.finalize') then
    raise exception 'FORBIDDEN';
  end if;
  select * into closure_row
  from public.agency_daily_closures
  where id = target_closure_id
    and organization_id = public.current_organization_id()
  for update;
  if closure_row.id is null or closure_row.status <> 'prepared' then
    raise exception 'DAILY_CLOSE_NOT_PREPARED';
  end if;
  if closure_row.prepared_by = auth.uid() then
    raise exception 'DAILY_CLOSE_FINALIZER_MUST_BE_DISTINCT';
  end if;

  perform 1
  from public.operational_exceptions
  where organization_id = closure_row.organization_id
    and status in ('open', 'in_resolution', 'pending_approval')
  for update;

  if exists (
    select 1 from public.operational_exceptions
    where organization_id = closure_row.organization_id
      and status in ('open', 'in_resolution', 'pending_approval')
      and blocks_release = true
  ) then
    raise exception 'DAILY_CLOSE_BLOCKING_EXCEPTIONS';
  end if;
  if exists (
    select 1 from public.package_custody_handoffs
    where organization_id = closure_row.organization_id and status = 'pending'
  ) then
    raise exception 'DAILY_CLOSE_PENDING_CUSTODY';
  end if;

  current_summary := public.agency_daily_close_summary(
    closure_row.organization_id, closure_row.operating_date, closure_row.timezone
  );
  update public.agency_daily_closures
  set status = 'closed',
      finalized_by = auth.uid(),
      finalized_at = now(),
      summary = current_summary
  where id = closure_row.id;
  insert into public.agency_daily_closure_events (
    closure_id, organization_id, event_type, actor_id, snapshot
  ) values (
    closure_row.id, closure_row.organization_id, 'finalized', auth.uid(), current_summary
  );
  return jsonb_build_object('closureId', closure_row.id, 'status', 'closed');
end;
$$;

revoke execute on function public.finalize_agency_daily_close(uuid) from public, anon;
grant execute on function public.finalize_agency_daily_close(uuid) to authenticated;

create or replace function public.guard_agency_sale_minimum_price()
returns trigger language plpgsql set search_path = public as $$
declare
  public_snapshot jsonb := coalesce(new.rate_snapshot->'public', '{}'::jsonb);
  source_id uuid;
  minimum_value bigint;
begin
  if new.concept not in ('international_shipping', 'home_delivery', 'home_pickup') then
    return new;
  end if;
  source_id := nullif(public_snapshot->>'sourceId', '')::uuid;
  if source_id is not null then
    select coalesce(minimum_amount_cents, amount_cents)
    into minimum_value
    from public.commercial_pricing_overrides
    where id = source_id and valid_until is null;
  end if;
  minimum_value := coalesce(
    minimum_value,
    nullif(public_snapshot->>'minimumAmountCents', '')::bigint,
    nullif(public_snapshot->>'suggestedAmountCents', '')::bigint,
    nullif(public_snapshot->>'amountCents', '')::bigint
  );
  if minimum_value is null then
    raise exception 'AGENCY_MINIMUM_PRICE_UNRESOLVED';
  end if;
  if new.unit_amount_cents < minimum_value then
    raise exception 'AGENCY_PUBLIC_PRICE_BELOW_MINIMUM';
  end if;
  return new;
end;
$$;

drop trigger if exists agency_sale_minimum_price_guard on public.sale_lines;
create trigger agency_sale_minimum_price_guard
before insert or update of unit_amount_cents, rate_snapshot on public.sale_lines
for each row execute function public.guard_agency_sale_minimum_price();

revoke execute on function public.guard_agency_sale_minimum_price()
  from public, anon, authenticated;
grant execute on function public.guard_agency_sale_minimum_price()
  to service_role;
