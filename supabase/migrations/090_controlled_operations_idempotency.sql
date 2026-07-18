-- Do not append a second audit event when a mobile client retries the same key.

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
  inserted_id uuid;
begin
  if auth.uid() is null or not public.user_has_permission('package.custody.transfer') then raise exception 'FORBIDDEN'; end if;
  if coalesce(nullif(btrim(operation_key), ''), '') = '' or jsonb_typeof(coalesce(handoff_evidence, '{}'::jsonb)) <> 'object' then raise exception 'CUSTODY_INPUT_INVALID'; end if;
  if target_holder_type not in ('agency', 'conductor', 'bodega', 'paleta', 'proveedor') then raise exception 'CUSTODY_HOLDER_INVALID'; end if;
  select * into package_row from public.shipment_packages where id = target_package_id and organization_id = public.current_organization_id() for update;
  if package_row.id is null then raise exception 'PACKAGE_NOT_FOUND'; end if;
  if exists(select 1 from public.package_custody_handoffs where package_id = package_row.id and status = 'pending') then
    select * into new_handoff from public.package_custody_handoffs where organization_id = package_row.organization_id and idempotency_key = btrim(operation_key);
    if new_handoff.id is not null then return jsonb_build_object('handoffId', new_handoff.id, 'status', new_handoff.status, 'replayed', true); end if;
    raise exception 'PACKAGE_HANDOFF_PENDING';
  end if;
  select * into current_handoff from public.package_custody_handoffs where package_id = package_row.id and status = 'accepted' order by received_at desc nulls last, initiated_at desc limit 1;
  insert into public.package_custody_handoffs (
    organization_id, package_id, shipment_id, from_holder_type, from_holder_id, from_holder_label,
    to_holder_type, to_holder_id, to_holder_label, initiated_by, reason, evidence, idempotency_key
  ) values (
    package_row.organization_id, package_row.id, package_row.shipment_id,
    coalesce(current_handoff.to_holder_type, 'unknown'), current_handoff.to_holder_id, coalesce(current_handoff.to_holder_label, ''),
    target_holder_type, target_holder_id, btrim(coalesce(target_holder_label, '')), auth.uid(), btrim(coalesce(handoff_reason, '')),
    coalesce(handoff_evidence, '{}'::jsonb), btrim(operation_key)
  ) on conflict (organization_id, idempotency_key) do nothing
  returning id into inserted_id;
  if inserted_id is null then
    select * into new_handoff from public.package_custody_handoffs
    where organization_id = package_row.organization_id and idempotency_key = btrim(operation_key);
    return jsonb_build_object('handoffId', new_handoff.id, 'status', new_handoff.status, 'replayed', true);
  end if;
  select * into new_handoff from public.package_custody_handoffs where id = inserted_id;
  return jsonb_build_object('handoffId', new_handoff.id, 'status', new_handoff.status, 'replayed', false);
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
declare
  package_row public.shipment_packages;
  exception_row public.operational_exceptions;
  blocking boolean;
  inserted_id uuid;
begin
  if auth.uid() is null or not public.user_has_permission('exceptions.report') then raise exception 'FORBIDDEN'; end if;
  if exception_kind not in ('not_delivered', 'damaged', 'lost', 'weight_difference', 'cancel_pre_departure') or nullif(btrim(exception_reason), '') is null then raise exception 'EXCEPTION_INPUT_INVALID'; end if;
  if jsonb_typeof(coalesce(exception_evidence, '{}'::jsonb)) <> 'object' then raise exception 'EXCEPTION_EVIDENCE_INVALID'; end if;
  select * into package_row from public.shipment_packages where id = target_package_id and organization_id = public.current_organization_id();
  if package_row.id is null then raise exception 'PACKAGE_NOT_FOUND'; end if;
  blocking := exception_kind in ('damaged', 'lost', 'weight_difference');
  insert into public.operational_exceptions (organization_id, package_id, shipment_id, logistics_task_id, exception_type, blocks_release, reason, evidence, reported_by, idempotency_key)
  values (package_row.organization_id, package_row.id, package_row.shipment_id, target_task_id, exception_kind, blocking, btrim(exception_reason), coalesce(exception_evidence, '{}'::jsonb), auth.uid(), btrim(operation_key))
  on conflict (organization_id, idempotency_key) do nothing
  returning id into inserted_id;
  if inserted_id is null then
    select * into exception_row from public.operational_exceptions
    where organization_id = package_row.organization_id and idempotency_key = btrim(operation_key);
    return jsonb_build_object('exceptionId', exception_row.id, 'status', exception_row.status, 'replayed', true);
  end if;
  select * into exception_row from public.operational_exceptions where id = inserted_id;
  insert into public.operational_exception_events(exception_id, organization_id, event_type, actor_id, note, evidence)
  values (exception_row.id, package_row.organization_id, 'reported', auth.uid(), exception_row.reason, exception_row.evidence);
  return jsonb_build_object('exceptionId', exception_row.id, 'status', exception_row.status, 'replayed', false);
end;
$$;
