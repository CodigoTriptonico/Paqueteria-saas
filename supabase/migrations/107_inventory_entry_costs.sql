-- Phase 1 COGS: store entry costs on movements and weighted average on stock.

alter table public.inventory_stock
  add column if not exists avg_cost numeric not null default 0 check (avg_cost >= 0);

alter table public.inventory_movements
  add column if not exists unit_cost numeric check (unit_cost is null or unit_cost >= 0),
  add column if not exists total_cost numeric check (total_cost is null or total_cost >= 0);

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
  p_movement_key text default null,
  p_unit_cost numeric default null,
  p_total_cost numeric default null
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
  next_avg_cost numeric;
  new_movement_id uuid;
  effective_reason text := coalesce(nullif(btrim(p_reason_code), ''), 'unspecified');
  effective_from_type text := p_from_location_type;
  effective_from_id uuid := p_from_location_id;
  effective_from_label text := coalesce(p_from_location_label, '');
  effective_to_type text := p_to_location_type;
  effective_to_id uuid := p_to_location_id;
  effective_to_label text := coalesce(p_to_location_label, '');
  effective_unit_cost numeric := null;
  effective_total_cost numeric := null;
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
  next_avg_cost := coalesce(stock_row.avg_cost, 0);

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

  if p_type = 'entrada' and (p_unit_cost is not null or p_total_cost is not null) then
    if p_unit_cost is not null and p_unit_cost < 0 then
      raise exception 'Costo unitario invalido';
    end if;

    if p_total_cost is not null and p_total_cost < 0 then
      raise exception 'Costo total invalido';
    end if;

    if p_unit_cost is not null and p_total_cost is not null then
      effective_unit_cost := p_unit_cost;
      effective_total_cost := p_total_cost;
    elsif p_unit_cost is not null then
      effective_unit_cost := p_unit_cost;
      effective_total_cost := round(p_unit_cost * p_qty, 4);
    else
      effective_total_cost := p_total_cost;
      effective_unit_cost := round(p_total_cost / p_qty, 4);
    end if;

    if stock_row.stock + p_qty > 0 then
      next_avg_cost := round(
        (
          stock_row.stock * coalesce(stock_row.avg_cost, 0)
          + p_qty * effective_unit_cost
        ) / (stock_row.stock + p_qty),
        4
      );
    else
      next_avg_cost := effective_unit_cost;
    end if;
  end if;

  update public.inventory_stock
  set stock = next_stock,
      avg_cost = next_avg_cost
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
    movement_key,
    unit_cost,
    total_cost
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
    nullif(btrim(p_movement_key), ''),
    case when p_type = 'entrada' then effective_unit_cost else null end,
    case when p_type = 'entrada' then effective_total_cost else null end
  )
  returning id into new_movement_id;

  return jsonb_build_object(
    'movement_id', new_movement_id,
    'stock', next_stock,
    'avg_cost', next_avg_cost
  );
end;
$$;

grant execute on function public.record_inventory_movement_atomic(
  uuid, uuid, uuid, text, text, numeric, text, uuid, uuid,
  text, text, uuid, text, text, uuid, text, text, uuid, jsonb,
  uuid, uuid, uuid, text, numeric, numeric
) to authenticated, service_role;
