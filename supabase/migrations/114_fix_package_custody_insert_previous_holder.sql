-- Finishing a sale inserts shipment_packages and fires the custody timeline
-- trigger with tg_op = INSERT. PL/pgSQL substitutes record fields into the
-- SQL statement before CASE short-circuits, so reading previous_holder fields
-- from an INSERT branch raised: record "previous_holder" is not assigned yet.
--
-- Also stop resolve_package_custody_holder from returning a second 'bodega'
-- row after a matched status: RETURN QUERY does not exit the function.

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
    return;
  elsif effective_status = 'in_truck' then
    select route.assigned_to, coalesce(nullif(btrim(profile.full_name), ''), profile.email, 'Conductor asignado')
      into route_driver_id, route_driver_label
    from public.logistics_routes route
    left join public.profiles profile on profile.id = route.assigned_to
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

  return query select 'bodega'::text, null::uuid, 'Bodega';
end;
$$;

create or replace function public.record_package_custody_status_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  previous_holder record;
  next_holder record;
  from_holder_type_value text;
  from_holder_id_value uuid;
  from_holder_label_value text := '';
  event_actor_id uuid;
  event_type_value text;
  event_key_value text;
begin
  select * into strict next_holder from public.resolve_package_custody_holder(new);
  if tg_op = 'INSERT' then
    event_type_value := 'created';
    event_key_value := 'created:' || new.id::text;
    from_holder_type_value := null;
    from_holder_id_value := null;
    from_holder_label_value := '';
  else
    if new.status is not distinct from old.status
      and new.truck_route_id is not distinct from old.truck_route_id
      and new.pallet_id is not distinct from old.pallet_id
      and new.provider_name is not distinct from old.provider_name then
      return new;
    end if;
    select * into strict previous_holder from public.resolve_package_custody_holder(old);
    from_holder_type_value := previous_holder.holder_type;
    from_holder_id_value := previous_holder.holder_id;
    from_holder_label_value := previous_holder.holder_label;
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
    from_holder_type_value, from_holder_id_value, from_holder_label_value,
    next_holder.holder_type, next_holder.holder_id, next_holder.holder_label,
    new.status, event_actor_id,
    jsonb_strip_nulls(jsonb_build_object('collectionWeightKg', new.collection_weight_kg, 'intakeWeightKg', new.intake_weight_kg, 'palletId', new.pallet_id, 'routeId', new.truck_route_id)),
    'package_status', coalesce(new.updated_at, now()), event_key_value
  ) on conflict (organization_id, event_key) do nothing;
  return new;
end;
$$;
