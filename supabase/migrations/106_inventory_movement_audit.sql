-- Inventory movement audit trail: structured reason, origin/destination, document link, evidence.
-- Modeled after package_custody_events.

alter table public.inventory_movements
  add column if not exists reason_code text not null default 'unspecified',
  add column if not exists from_location_type text,
  add column if not exists from_location_id uuid,
  add column if not exists from_location_label text not null default '',
  add column if not exists to_location_type text,
  add column if not exists to_location_id uuid,
  add column if not exists to_location_label text not null default '',
  add column if not exists reference_type text,
  add column if not exists reference_id uuid,
  add column if not exists evidence jsonb not null default '{}'::jsonb,
  add column if not exists reversal_of_movement_id uuid,
  add column if not exists movement_key text;

alter table public.inventory_movements
  drop constraint if exists inventory_movements_reason_code_check;

alter table public.inventory_movements
  add constraint inventory_movements_reason_code_check check (
    reason_code in (
      'unspecified',
      'manual_entry',
      'manual_exit',
      'physical_count',
      'sale_fulfillment',
      'warehouse_transfer_out',
      'warehouse_transfer_in',
      'warehouse_transfer_cancel',
      'assignment_issue',
      'assignment_return',
      'assignment_consume',
      'assignment_damage',
      'assignment_loss',
      'agency_delivery',
      'correction_reversal',
      'other'
    )
  );

alter table public.inventory_movements
  drop constraint if exists inventory_movements_from_location_type_check;

alter table public.inventory_movements
  add constraint inventory_movements_from_location_type_check check (
    from_location_type is null
    or from_location_type in ('warehouse', 'assignee', 'truck', 'agency', 'external', 'shipment', 'unknown')
  );

alter table public.inventory_movements
  drop constraint if exists inventory_movements_to_location_type_check;

alter table public.inventory_movements
  add constraint inventory_movements_to_location_type_check check (
    to_location_type is null
    or to_location_type in ('warehouse', 'assignee', 'truck', 'agency', 'external', 'shipment', 'unknown')
  );

alter table public.inventory_movements
  drop constraint if exists inventory_movements_reference_type_check;

alter table public.inventory_movements
  add constraint inventory_movements_reference_type_check check (
    reference_type is null
    or reference_type in (
      'shipment',
      'assignment',
      'warehouse_transfer',
      'sale_reservation',
      'agency_visit',
      'physical_count',
      'manual'
    )
  );

alter table public.inventory_movements
  drop constraint if exists inventory_movements_evidence_object_check;

alter table public.inventory_movements
  add constraint inventory_movements_evidence_object_check check (jsonb_typeof(evidence) = 'object');

alter table public.inventory_movements
  drop constraint if exists inventory_movements_reversal_of_movement_id_fkey;

alter table public.inventory_movements
  add constraint inventory_movements_reversal_of_movement_id_fkey
  foreign key (reversal_of_movement_id) references public.inventory_movements (id) on delete set null;

create unique index if not exists idx_inventory_movements_org_movement_key
  on public.inventory_movements (organization_id, movement_key)
  where movement_key is not null;

create index if not exists idx_inventory_movements_reference
  on public.inventory_movements (organization_id, reference_type, reference_id, created_at desc);

-- Backfill reason codes from legacy movement types.
update public.inventory_movements
set reason_code = case type
  when 'entrada' then 'manual_entry'
  when 'salida' then 'manual_exit'
  when 'ajuste' then 'physical_count'
  when 'asignacion' then 'assignment_issue'
  when 'devolucion' then 'assignment_return'
  when 'consumo' then 'assignment_consume'
  when 'dano' then 'assignment_damage'
  when 'perdida' then 'assignment_loss'
  else 'unspecified'
end
where reason_code = 'unspecified';

update public.inventory_movements mov
set
  reference_type = 'assignment',
  reference_id = mov.assignment_id
where mov.assignment_id is not null
  and mov.reference_type is null;

update public.inventory_movements mov
set
  reference_type = 'warehouse_transfer',
  reference_id = mov.warehouse_transfer_id
where mov.warehouse_transfer_id is not null
  and mov.reference_type is null;

create or replace function public.inventory_movements_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'IMMUTABLE_INVENTORY_MOVEMENT';
end;
$$;

drop trigger if exists inventory_movements_immutable on public.inventory_movements;
create trigger inventory_movements_immutable
  before update or delete on public.inventory_movements
  for each row execute function public.inventory_movements_immutable();

create or replace function public.record_inventory_movement_atomic(
  target_org_id uuid,
  p_warehouse_id uuid,
  p_item_id uuid,
  p_item_name text,
  p_type text,
  p_qty numeric,
  p_note text,
  p_created_by uuid,
  p_assignee_id uuid default null,
  p_reason_code text default 'unspecified',
  p_from_location_type text default null,
  p_from_location_id uuid default null,
  p_from_location_label text default '',
  p_to_location_type text default null,
  p_to_location_id uuid default null,
  p_to_location_label text default '',
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_evidence jsonb default '{}'::jsonb,
  p_assignment_id uuid default null,
  p_warehouse_transfer_id uuid default null,
  p_reversal_of_movement_id uuid default null,
  p_movement_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  warehouse_org uuid;
  item_org uuid;
  warehouse_row public.warehouses%rowtype;
  stock_row public.inventory_stock%rowtype;
  next_stock numeric;
  new_movement_id uuid;
  effective_reason text := coalesce(nullif(btrim(p_reason_code), ''), 'unspecified');
  effective_from_type text := p_from_location_type;
  effective_from_id uuid := p_from_location_id;
  effective_from_label text := coalesce(p_from_location_label, '');
  effective_to_type text := p_to_location_type;
  effective_to_id uuid := p_to_location_id;
  effective_to_label text := coalesce(p_to_location_label, '');
begin
  if target_org_id is null then
    raise exception 'Organizacion invalida';
  end if;

  if target_org_id is distinct from public.current_organization_id()
     and auth.role() <> 'service_role' then
    raise exception 'Forbidden';
  end if;

  if auth.role() <> 'service_role' then
    if p_type in ('entrada', 'ajuste', 'devolucion') then
      if not public.user_has_permission('inventory.adjust') then
        raise exception 'Forbidden';
      end if;
    elsif p_type = 'salida' then
      if not (
        public.user_has_permission('inventory.reserve')
        or public.user_has_permission('inventory.adjust')
      ) then
        raise exception 'Forbidden';
      end if;
    end if;
  end if;

  if p_qty is null or p_qty <= 0 then
    raise exception 'Cantidad invalida';
  end if;

  if p_type not in ('entrada', 'salida', 'ajuste', 'devolucion') then
    raise exception 'Tipo de movimiento invalido';
  end if;

  if p_type in ('ajuste', 'dano', 'perdida')
     and effective_reason in ('unspecified')
     and char_length(btrim(coalesce(p_note, ''))) = 0 then
    raise exception 'Motivo requerido';
  end if;

  if effective_reason = 'other'
     and char_length(btrim(coalesce(p_note, ''))) < 3 then
    raise exception 'Detalle requerido para motivo Otro';
  end if;

  select organization_id into warehouse_org
  from public.warehouses
  where id = p_warehouse_id;

  if warehouse_org is null or warehouse_org is distinct from target_org_id then
    raise exception 'Bodega no encontrada';
  end if;

  select * into warehouse_row
  from public.warehouses
  where id = p_warehouse_id;

  select organization_id into item_org
  from public.inventory_items
  where id = p_item_id;

  if item_org is null or item_org is distinct from target_org_id then
    raise exception 'Item no encontrado';
  end if;

  if effective_from_type is null and effective_to_type is null then
    if p_type = 'entrada' then
      effective_from_type := 'external';
      effective_from_label := coalesce(nullif(effective_from_label, ''), 'Entrada externa');
      effective_to_type := 'warehouse';
      effective_to_id := p_warehouse_id;
      effective_to_label := coalesce(nullif(effective_to_label, ''), warehouse_row.name, 'Bodega');
    elsif p_type = 'salida' then
      effective_from_type := 'warehouse';
      effective_from_id := p_warehouse_id;
      effective_from_label := coalesce(nullif(effective_from_label, ''), warehouse_row.name, 'Bodega');
      effective_to_type := 'external';
      effective_to_label := coalesce(nullif(effective_to_label, ''), 'Salida');
    elsif p_type in ('ajuste', 'devolucion') then
      effective_to_type := 'warehouse';
      effective_to_id := p_warehouse_id;
      effective_to_label := coalesce(nullif(effective_to_label, ''), warehouse_row.name, 'Bodega');
    end if;
  end if;

  select *
  into stock_row
  from public.inventory_stock
  where warehouse_id = p_warehouse_id
    and item_id = p_item_id
    and organization_id = target_org_id
  for update;

  if stock_row.id is null then
    raise exception 'Stock no encontrado';
  end if;

  next_stock := stock_row.stock;

  if p_type in ('entrada', 'devolucion') then
    next_stock := next_stock + p_qty;
  elsif p_type = 'salida' then
    if next_stock < p_qty then
      raise exception 'Stock insuficiente';
    end if;
    next_stock := next_stock - p_qty;
  else
    next_stock := p_qty;
  end if;

  if next_stock < 0 then
    raise exception 'Stock insuficiente';
  end if;

  update public.inventory_stock
  set stock = next_stock
  where id = stock_row.id;

  insert into public.inventory_movements (
    organization_id,
    warehouse_id,
    item_id,
    item_name,
    type,
    qty,
    note,
    created_by,
    assignee_id,
    reason_code,
    from_location_type,
    from_location_id,
    from_location_label,
    to_location_type,
    to_location_id,
    to_location_label,
    reference_type,
    reference_id,
    evidence,
    assignment_id,
    warehouse_transfer_id,
    reversal_of_movement_id,
    movement_key
  ) values (
    target_org_id,
    p_warehouse_id,
    p_item_id,
    coalesce(nullif(btrim(p_item_name), ''), 'Item'),
    p_type,
    p_qty,
    coalesce(p_note, ''),
    p_created_by,
    p_assignee_id,
    effective_reason,
    effective_from_type,
    effective_from_id,
    effective_from_label,
    effective_to_type,
    effective_to_id,
    effective_to_label,
    p_reference_type,
    p_reference_id,
    coalesce(p_evidence, '{}'::jsonb),
    p_assignment_id,
    p_warehouse_transfer_id,
    p_reversal_of_movement_id,
    nullif(btrim(p_movement_key), '')
  )
  returning id into new_movement_id;

  return jsonb_build_object(
    'movement_id', new_movement_id,
    'stock', next_stock
  );
end;
$$;

grant execute on function public.record_inventory_movement_atomic(
  uuid, uuid, uuid, text, text, numeric, text, uuid, uuid,
  text, text, uuid, text, text, uuid, text, text, uuid, jsonb,
  uuid, uuid, uuid, text
) to authenticated, service_role;

-- Assignments: populate audit trail on issue and close.
create or replace function public.assign_inventory_item(
  p_warehouse_id uuid,
  p_item_id uuid,
  p_assignee_id uuid,
  p_qty numeric,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  stock_row record;
  item_row record;
  assignee_row record;
  warehouse_row record;
  assignee_label text;
  new_assignment_id uuid;
  new_movement_id uuid;
begin
  if auth.uid() is null then
    raise exception 'FORBIDDEN';
  end if;

  if not public.user_has_permission('inventory.assign') then
    raise exception 'FORBIDDEN';
  end if;

  if not public.user_can_access_warehouse(p_warehouse_id) then
    raise exception 'FORBIDDEN';
  end if;

  if p_qty is null or p_qty <= 0 then
    raise exception 'Cantidad invalida';
  end if;

  select organization_id into org_id from public.profiles where id = auth.uid();

  select * into stock_row
  from public.inventory_stock
  where warehouse_id = p_warehouse_id
    and item_id = p_item_id
    and organization_id = org_id
  for update;

  if stock_row.id is null then
    raise exception 'Stock no encontrado';
  end if;

  if stock_row.stock < p_qty then
    raise exception 'Stock insuficiente en bodega';
  end if;

  select id, name into item_row
  from public.inventory_items
  where id = p_item_id and organization_id = org_id;

  if item_row.id is null then
    raise exception 'Item no encontrado';
  end if;

  select id,
    coalesce(nullif(btrim(full_name), ''), email, 'Empleado') as label
  into assignee_row
  from public.profiles
  where id = p_assignee_id
    and organization_id = org_id
    and is_active = true;

  if assignee_row.id is null then
    raise exception 'Empleado no encontrado';
  end if;

  assignee_label := assignee_row.label;

  select id, name into warehouse_row
  from public.warehouses
  where id = p_warehouse_id;

  update public.inventory_stock
  set stock = stock - p_qty,
      assigned = assigned + p_qty
  where id = stock_row.id;

  insert into public.inventory_assignments (
    organization_id, warehouse_id, item_id, item_name,
    assignee_id, qty_assigned, note, assigned_by
  ) values (
    org_id, p_warehouse_id, p_item_id, item_row.name,
    p_assignee_id, p_qty, coalesce(p_note, ''), auth.uid()
  )
  returning id into new_assignment_id;

  insert into public.inventory_movements (
    organization_id, warehouse_id, item_id, item_name,
    type, qty, note, created_by, assignment_id, assignee_id,
    reason_code,
    from_location_type, from_location_id, from_location_label,
    to_location_type, to_location_id, to_location_label,
    reference_type, reference_id,
    movement_key
  ) values (
    org_id, p_warehouse_id, p_item_id, item_row.name,
    'asignacion', p_qty, coalesce(p_note, ''), auth.uid(),
    new_assignment_id, p_assignee_id,
    'assignment_issue',
    'warehouse', p_warehouse_id, coalesce(warehouse_row.name, 'Bodega'),
    'assignee', p_assignee_id, assignee_label,
    'assignment', new_assignment_id,
    'assignment:' || new_assignment_id::text
  )
  returning id into new_movement_id;

  return jsonb_build_object(
    'assignment_id', new_assignment_id,
    'movement_id', new_movement_id
  );
end;
$$;

create or replace function public.close_inventory_assignment(
  p_assignment_id uuid,
  p_outcome text,
  p_qty_returned numeric default 0,
  p_qty_consumed numeric default 0,
  p_qty_damaged numeric default 0,
  p_qty_lost numeric default 0,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  asg record;
  stock_row record;
  warehouse_row record;
  assignee_label text;
  open_qty numeric;
  total_close numeric;
begin
  if auth.uid() is null then
    raise exception 'FORBIDDEN';
  end if;

  if not public.user_has_permission('inventory.return') then
    raise exception 'FORBIDDEN';
  end if;

  select organization_id into org_id from public.profiles where id = auth.uid();

  select * into asg
  from public.inventory_assignments
  where id = p_assignment_id
    and organization_id = org_id
  for update;

  if asg.id is null then
    raise exception 'Asignacion no encontrada';
  end if;

  if asg.status <> 'open' then
    raise exception 'Asignacion ya cerrada';
  end if;

  if not public.user_can_access_warehouse(asg.warehouse_id) then
    raise exception 'FORBIDDEN';
  end if;

  select coalesce(nullif(btrim(full_name), ''), email, 'Empleado')
  into assignee_label
  from public.profiles
  where id = asg.assignee_id;

  select id, name into warehouse_row
  from public.warehouses
  where id = asg.warehouse_id;

  open_qty := asg.qty_assigned;

  if p_outcome = 'returned_intact' then
    p_qty_returned := open_qty;
    p_qty_consumed := 0;
    p_qty_damaged := 0;
    p_qty_lost := 0;
  elsif p_outcome = 'consumed' then
    p_qty_returned := 0;
    p_qty_consumed := open_qty;
    p_qty_damaged := 0;
    p_qty_lost := 0;
  elsif p_outcome = 'damaged' then
    p_qty_returned := 0;
    p_qty_consumed := 0;
    p_qty_damaged := open_qty;
    p_qty_lost := 0;
  elsif p_outcome = 'lost' then
    p_qty_returned := 0;
    p_qty_consumed := 0;
    p_qty_damaged := 0;
    p_qty_lost := open_qty;
  elsif p_outcome <> 'partial' then
    raise exception 'Resultado invalido';
  end if;

  if p_outcome in ('damaged', 'lost', 'partial')
     and char_length(btrim(coalesce(p_note, ''))) = 0 then
    raise exception 'Motivo requerido';
  end if;

  total_close := coalesce(p_qty_returned, 0)
    + coalesce(p_qty_consumed, 0)
    + coalesce(p_qty_damaged, 0)
    + coalesce(p_qty_lost, 0);

  if total_close <> open_qty then
    raise exception 'Las cantidades no suman el total asignado';
  end if;

  select * into stock_row
  from public.inventory_stock
  where warehouse_id = asg.warehouse_id
    and item_id = asg.item_id
    and organization_id = org_id
  for update;

  if stock_row.id is null then
    raise exception 'Stock no encontrado';
  end if;

  if stock_row.assigned < open_qty then
    raise exception 'Stock asignado inconsistente';
  end if;

  update public.inventory_stock
  set stock = stock + coalesce(p_qty_returned, 0),
      assigned = assigned - open_qty,
      unavailable = unavailable
        + coalesce(p_qty_consumed, 0)
        + coalesce(p_qty_damaged, 0)
        + coalesce(p_qty_lost, 0)
  where id = stock_row.id;

  update public.inventory_assignments
  set status = 'closed',
      outcome = p_outcome,
      qty_returned = coalesce(p_qty_returned, 0),
      qty_consumed = coalesce(p_qty_consumed, 0),
      qty_damaged = coalesce(p_qty_damaged, 0),
      qty_lost = coalesce(p_qty_lost, 0),
      note = case
        when coalesce(p_note, '') <> '' then p_note
        else note
      end,
      closed_by = auth.uid(),
      closed_at = now()
  where id = asg.id;

  if coalesce(p_qty_returned, 0) > 0 then
    insert into public.inventory_movements (
      organization_id, warehouse_id, item_id, item_name,
      type, qty, note, created_by, assignment_id, assignee_id,
      reason_code,
      from_location_type, from_location_id, from_location_label,
      to_location_type, to_location_id, to_location_label,
      reference_type, reference_id,
      movement_key
    ) values (
      org_id, asg.warehouse_id, asg.item_id, asg.item_name,
      'devolucion', p_qty_returned, coalesce(p_note, ''), auth.uid(),
      asg.id, asg.assignee_id,
      'assignment_return',
      'assignee', asg.assignee_id, assignee_label,
      'warehouse', asg.warehouse_id, coalesce(warehouse_row.name, 'Bodega'),
      'assignment', asg.id,
      'assignment-return:' || asg.id::text
    );
  end if;

  if coalesce(p_qty_consumed, 0) > 0 then
    insert into public.inventory_movements (
      organization_id, warehouse_id, item_id, item_name,
      type, qty, note, created_by, assignment_id, assignee_id,
      reason_code,
      from_location_type, from_location_id, from_location_label,
      to_location_type, to_location_label,
      reference_type, reference_id,
      movement_key
    ) values (
      org_id, asg.warehouse_id, asg.item_id, asg.item_name,
      'consumo', p_qty_consumed, coalesce(p_note, ''), auth.uid(),
      asg.id, asg.assignee_id,
      'assignment_consume',
      'assignee', asg.assignee_id, assignee_label,
      'external', 'Consumo interno',
      'assignment', asg.id,
      'assignment-consume:' || asg.id::text
    );
  end if;

  if coalesce(p_qty_damaged, 0) > 0 then
    insert into public.inventory_movements (
      organization_id, warehouse_id, item_id, item_name,
      type, qty, note, created_by, assignment_id, assignee_id,
      reason_code,
      from_location_type, from_location_id, from_location_label,
      to_location_type, to_location_label,
      reference_type, reference_id,
      movement_key
    ) values (
      org_id, asg.warehouse_id, asg.item_id, asg.item_name,
      'dano', p_qty_damaged, coalesce(p_note, ''), auth.uid(),
      asg.id, asg.assignee_id,
      'assignment_damage',
      'assignee', asg.assignee_id, assignee_label,
      'external', 'Dañado / no utilizable',
      'assignment', asg.id,
      'assignment-damage:' || asg.id::text
    );
  end if;

  if coalesce(p_qty_lost, 0) > 0 then
    insert into public.inventory_movements (
      organization_id, warehouse_id, item_id, item_name,
      type, qty, note, created_by, assignment_id, assignee_id,
      reason_code,
      from_location_type, from_location_id, from_location_label,
      to_location_type, to_location_label,
      reference_type, reference_id,
      movement_key
    ) values (
      org_id, asg.warehouse_id, asg.item_id, asg.item_name,
      'perdida', p_qty_lost, coalesce(p_note, ''), auth.uid(),
      asg.id, asg.assignee_id,
      'assignment_loss',
      'assignee', asg.assignee_id, assignee_label,
      'external', 'Extraviado',
      'assignment', asg.id,
      'assignment-loss:' || asg.id::text
    );
  end if;

  return jsonb_build_object('assignment_id', asg.id, 'outcome', p_outcome);
end;
$$;

-- Sale fulfillment: link salida to shipment.
create or replace function public.fulfill_inventory_sale_stock(
  target_org_id uuid,
  p_shipment_id uuid,
  p_note text,
  p_created_by uuid default null,
  p_assignee_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  reservation_row public.inventory_sale_reservations%rowtype;
  stock_row public.inventory_stock%rowtype;
  warehouse_row public.warehouses%rowtype;
  shipment_code text;
  fulfilled_count integer := 0;
begin
  if target_org_id is null then
    raise exception 'Organizacion invalida';
  end if;

  if target_org_id is distinct from public.current_organization_id()
     and auth.role() <> 'service_role' then
    raise exception 'Forbidden';
  end if;

  if auth.role() <> 'service_role' then
    if not (
      public.user_has_permission('inventory.reserve')
      or public.user_has_permission('inventory.adjust')
      or public.user_has_permission('sales.manage')
    ) then
      raise exception 'Forbidden';
    end if;
  end if;

  select coalesce(nullif(btrim(code), ''), 'Envio')
  into shipment_code
  from public.shipments
  where id = p_shipment_id
    and organization_id = target_org_id;

  for reservation_row in
    select *
    from public.inventory_sale_reservations
    where organization_id = target_org_id
      and shipment_id = p_shipment_id
      and status = 'active'
    order by created_at
    for update
  loop
    select * into warehouse_row
    from public.warehouses
    where id = reservation_row.warehouse_id;

    select *
    into stock_row
    from public.inventory_stock
    where warehouse_id = reservation_row.warehouse_id
      and item_id = reservation_row.item_id
      and organization_id = target_org_id
    for update;

    if stock_row.id is null then
      raise exception 'Stock no encontrado';
    end if;

    if stock_row.reserved < reservation_row.qty then
      raise exception 'Reserva insuficiente';
    end if;

    if stock_row.stock < reservation_row.qty then
      raise exception 'Stock insuficiente';
    end if;

    update public.inventory_stock
    set
      stock = stock - reservation_row.qty,
      reserved = reserved - reservation_row.qty
    where id = stock_row.id;

    insert into public.inventory_movements (
      organization_id,
      warehouse_id,
      item_id,
      item_name,
      type,
      qty,
      note,
      created_by,
      assignee_id,
      reason_code,
      from_location_type,
      from_location_id,
      from_location_label,
      to_location_type,
      to_location_id,
      to_location_label,
      reference_type,
      reference_id,
      movement_key
    ) values (
      target_org_id,
      reservation_row.warehouse_id,
      reservation_row.item_id,
      reservation_row.item_name,
      'salida',
      reservation_row.qty,
      coalesce(p_note, ''),
      p_created_by,
      p_assignee_id,
      'sale_fulfillment',
      'warehouse',
      reservation_row.warehouse_id,
      coalesce(warehouse_row.name, 'Bodega'),
      'shipment',
      p_shipment_id,
      coalesce(shipment_code, 'Envio'),
      'shipment',
      p_shipment_id,
      'sale-fulfill:' || reservation_row.id::text
    );

    update public.inventory_sale_reservations
    set
      status = 'fulfilled',
      fulfilled_at = now()
    where id = reservation_row.id;

    fulfilled_count := fulfilled_count + 1;
  end loop;

  return jsonb_build_object('fulfilled_count', fulfilled_count);
end;
$$;

-- Warehouse transfers: audit trail on dispatch, receive, cancel.
create or replace function public.create_inventory_warehouse_transfer(
  target_org_id uuid,
  p_from_warehouse_id uuid,
  p_to_warehouse_id uuid,
  p_item_id uuid,
  p_qty numeric,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  stock_row public.inventory_stock%rowtype;
  item_row public.inventory_items%rowtype;
  from_wh public.warehouses%rowtype;
  to_wh public.warehouses%rowtype;
  available_qty numeric;
  new_transfer_id uuid;
  new_movement_id uuid;
begin
  if target_org_id is null then
    raise exception 'Organizacion invalida';
  end if;

  if target_org_id is distinct from public.current_organization_id()
     and auth.role() <> 'service_role' then
    raise exception 'Forbidden';
  end if;

  if auth.role() <> 'service_role' then
    if not public.user_has_permission('inventory.adjust') then
      raise exception 'Forbidden';
    end if;

    if not public.user_can_access_warehouse(p_from_warehouse_id) then
      raise exception 'Forbidden';
    end if;
  end if;

  if p_from_warehouse_id = p_to_warehouse_id then
    raise exception 'Origen y destino deben ser distintos';
  end if;

  if p_qty is null or p_qty <= 0 then
    raise exception 'Cantidad invalida';
  end if;

  select * into from_wh
  from public.warehouses
  where id = p_from_warehouse_id
    and organization_id = target_org_id;

  if from_wh.id is null then
    raise exception 'Bodega de origen no encontrada';
  end if;

  select * into to_wh
  from public.warehouses
  where id = p_to_warehouse_id
    and organization_id = target_org_id;

  if to_wh.id is null then
    raise exception 'Bodega de destino no encontrada';
  end if;

  select * into item_row
  from public.inventory_items
  where id = p_item_id
    and organization_id = target_org_id;

  if item_row.id is null then
    raise exception 'Item no encontrado';
  end if;

  select *
  into stock_row
  from public.inventory_stock
  where warehouse_id = p_from_warehouse_id
    and item_id = p_item_id
    and organization_id = target_org_id
  for update;

  if stock_row.id is null then
    raise exception 'Stock no encontrado';
  end if;

  available_qty := greatest(0, stock_row.stock - stock_row.reserved);

  if available_qty < p_qty then
    raise exception 'Stock disponible insuficiente';
  end if;

  insert into public.inventory_warehouse_transfers (
    organization_id,
    from_warehouse_id,
    to_warehouse_id,
    item_id,
    item_name,
    qty,
    status,
    note,
    created_by
  ) values (
    target_org_id,
    p_from_warehouse_id,
    p_to_warehouse_id,
    p_item_id,
    item_row.name,
    p_qty,
    'in_transit',
    coalesce(p_note, ''),
    auth.uid()
  )
  returning id into new_transfer_id;

  update public.inventory_stock
  set stock = stock - p_qty
  where id = stock_row.id;

  insert into public.inventory_movements (
    organization_id,
    warehouse_id,
    item_id,
    item_name,
    type,
    qty,
    note,
    created_by,
    warehouse_transfer_id,
    reason_code,
    from_location_type,
    from_location_id,
    from_location_label,
    to_location_type,
    to_location_id,
    to_location_label,
    reference_type,
    reference_id,
    movement_key
  ) values (
    target_org_id,
    p_from_warehouse_id,
    p_item_id,
    item_row.name,
    'salida',
    p_qty,
    case
      when coalesce(btrim(p_note), '') = '' then format('Transferencia a %s', to_wh.name)
      else format('Transferencia a %s · %s', to_wh.name, btrim(p_note))
    end,
    auth.uid(),
    new_transfer_id,
    'warehouse_transfer_out',
    'warehouse', p_from_warehouse_id, from_wh.name,
    'warehouse', p_to_warehouse_id, to_wh.name,
    'warehouse_transfer', new_transfer_id,
    'transfer-out:' || new_transfer_id::text
  )
  returning id into new_movement_id;

  update public.inventory_warehouse_transfers
  set outbound_movement_id = new_movement_id
  where id = new_transfer_id;

  return jsonb_build_object(
    'transfer_id', new_transfer_id,
    'movement_id', new_movement_id,
    'status', 'in_transit'
  );
end;
$$;

create or replace function public.receive_inventory_warehouse_transfer(
  target_org_id uuid,
  p_transfer_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  transfer_row public.inventory_warehouse_transfers%rowtype;
  stock_row public.inventory_stock%rowtype;
  from_wh public.warehouses%rowtype;
  to_wh public.warehouses%rowtype;
  new_movement_id uuid;
begin
  if target_org_id is null then
    raise exception 'Organizacion invalida';
  end if;

  if target_org_id is distinct from public.current_organization_id()
     and auth.role() <> 'service_role' then
    raise exception 'Forbidden';
  end if;

  if auth.role() <> 'service_role' then
    if not public.user_has_permission('inventory.adjust') then
      raise exception 'Forbidden';
    end if;
  end if;

  select *
  into transfer_row
  from public.inventory_warehouse_transfers
  where id = p_transfer_id
    and organization_id = target_org_id
  for update;

  if transfer_row.id is null then
    raise exception 'Transferencia no encontrada';
  end if;

  if transfer_row.status <> 'in_transit' then
    raise exception 'La transferencia ya fue cerrada';
  end if;

  if auth.role() <> 'service_role' then
    if not public.user_can_access_warehouse(transfer_row.to_warehouse_id) then
      raise exception 'Forbidden';
    end if;
  end if;

  select * into from_wh
  from public.warehouses
  where id = transfer_row.from_warehouse_id;

  select * into to_wh
  from public.warehouses
  where id = transfer_row.to_warehouse_id;

  select *
  into stock_row
  from public.inventory_stock
  where warehouse_id = transfer_row.to_warehouse_id
    and item_id = transfer_row.item_id
    and organization_id = target_org_id
  for update;

  if stock_row.id is null then
    insert into public.inventory_stock (
      organization_id,
      warehouse_id,
      item_id,
      stock,
      reserved,
      min_stock
    ) values (
      target_org_id,
      transfer_row.to_warehouse_id,
      transfer_row.item_id,
      transfer_row.qty,
      0,
      2
    );
  else
    update public.inventory_stock
    set stock = stock + transfer_row.qty
    where id = stock_row.id;
  end if;

  insert into public.inventory_movements (
    organization_id,
    warehouse_id,
    item_id,
    item_name,
    type,
    qty,
    note,
    created_by,
    warehouse_transfer_id,
    reason_code,
    from_location_type,
    from_location_id,
    from_location_label,
    to_location_type,
    to_location_id,
    to_location_label,
    reference_type,
    reference_id,
    movement_key
  ) values (
    target_org_id,
    transfer_row.to_warehouse_id,
    transfer_row.item_id,
    transfer_row.item_name,
    'entrada',
    transfer_row.qty,
    format('Transferencia desde %s', coalesce(from_wh.name, 'bodega origen')),
    auth.uid(),
    transfer_row.id,
    'warehouse_transfer_in',
    'warehouse', transfer_row.from_warehouse_id, coalesce(from_wh.name, 'Bodega origen'),
    'warehouse', transfer_row.to_warehouse_id, coalesce(to_wh.name, 'Bodega destino'),
    'warehouse_transfer', transfer_row.id,
    'transfer-in:' || transfer_row.id::text
  )
  returning id into new_movement_id;

  update public.inventory_warehouse_transfers
  set status = 'received',
      inbound_movement_id = new_movement_id,
      received_by = auth.uid(),
      received_at = now()
  where id = transfer_row.id;

  return jsonb_build_object(
    'transfer_id', transfer_row.id,
    'movement_id', new_movement_id,
    'status', 'received'
  );
end;
$$;

create or replace function public.cancel_inventory_warehouse_transfer(
  target_org_id uuid,
  p_transfer_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  transfer_row public.inventory_warehouse_transfers%rowtype;
  stock_row public.inventory_stock%rowtype;
  from_wh public.warehouses%rowtype;
  to_wh public.warehouses%rowtype;
  new_movement_id uuid;
begin
  if target_org_id is null then
    raise exception 'Organizacion invalida';
  end if;

  if target_org_id is distinct from public.current_organization_id()
     and auth.role() <> 'service_role' then
    raise exception 'Forbidden';
  end if;

  if auth.role() <> 'service_role' then
    if not public.user_has_permission('inventory.adjust') then
      raise exception 'Forbidden';
    end if;
  end if;

  select *
  into transfer_row
  from public.inventory_warehouse_transfers
  where id = p_transfer_id
    and organization_id = target_org_id
  for update;

  if transfer_row.id is null then
    raise exception 'Transferencia no encontrada';
  end if;

  if transfer_row.status <> 'in_transit' then
    raise exception 'La transferencia ya fue cerrada';
  end if;

  if auth.role() <> 'service_role' then
    if not public.user_can_access_warehouse(transfer_row.from_warehouse_id) then
      raise exception 'Forbidden';
    end if;
  end if;

  select * into from_wh
  from public.warehouses
  where id = transfer_row.from_warehouse_id;

  select * into to_wh
  from public.warehouses
  where id = transfer_row.to_warehouse_id;

  select *
  into stock_row
  from public.inventory_stock
  where warehouse_id = transfer_row.from_warehouse_id
    and item_id = transfer_row.item_id
    and organization_id = target_org_id
  for update;

  if stock_row.id is null then
    raise exception 'Stock no encontrado en bodega de origen';
  end if;

  update public.inventory_stock
  set stock = stock + transfer_row.qty
  where id = stock_row.id;

  insert into public.inventory_movements (
    organization_id,
    warehouse_id,
    item_id,
    item_name,
    type,
    qty,
    note,
    created_by,
    warehouse_transfer_id,
    reason_code,
    from_location_type,
    from_location_id,
    from_location_label,
    to_location_type,
    to_location_id,
    to_location_label,
    reference_type,
    reference_id,
    movement_key
  ) values (
    target_org_id,
    transfer_row.from_warehouse_id,
    transfer_row.item_id,
    transfer_row.item_name,
    'devolucion',
    transfer_row.qty,
    format(
      'Cancelacion de transferencia a %s',
      coalesce(to_wh.name, 'bodega destino')
    ),
    auth.uid(),
    transfer_row.id,
    'warehouse_transfer_cancel',
    'warehouse', transfer_row.to_warehouse_id, coalesce(to_wh.name, 'Bodega destino'),
    'warehouse', transfer_row.from_warehouse_id, coalesce(from_wh.name, 'Bodega origen'),
    'warehouse_transfer', transfer_row.id,
    'transfer-cancel:' || transfer_row.id::text
  )
  returning id into new_movement_id;

  update public.inventory_warehouse_transfers
  set status = 'cancelled',
      cancelled_by = auth.uid(),
      cancelled_at = now()
  where id = transfer_row.id;

  return jsonb_build_object(
    'transfer_id', transfer_row.id,
    'movement_id', new_movement_id,
    'status', 'cancelled'
  );
end;
$$;
