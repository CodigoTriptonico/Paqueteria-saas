-- Warehouse-to-warehouse transfers: dispatch, in-transit ledger, receive confirmation.

create table if not exists public.inventory_warehouse_transfers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  from_warehouse_id uuid not null references public.warehouses (id) on delete restrict,
  to_warehouse_id uuid not null references public.warehouses (id) on delete restrict,
  item_id uuid not null references public.inventory_items (id) on delete restrict,
  item_name text not null,
  qty numeric not null check (qty > 0),
  status text not null default 'in_transit' check (status in ('in_transit', 'received', 'cancelled')),
  note text not null default '',
  outbound_movement_id uuid,
  inbound_movement_id uuid,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  received_by uuid references public.profiles (id) on delete set null,
  received_at timestamptz,
  cancelled_by uuid references public.profiles (id) on delete set null,
  cancelled_at timestamptz,
  check (from_warehouse_id <> to_warehouse_id)
);

create index if not exists idx_inventory_warehouse_transfers_org_status
  on public.inventory_warehouse_transfers (organization_id, status, created_at desc);

create index if not exists idx_inventory_warehouse_transfers_from_wh
  on public.inventory_warehouse_transfers (from_warehouse_id, status, created_at desc);

create index if not exists idx_inventory_warehouse_transfers_to_wh
  on public.inventory_warehouse_transfers (to_warehouse_id, status, created_at desc);

alter table public.inventory_movements
  add column if not exists warehouse_transfer_id uuid;

alter table public.inventory_warehouse_transfers
  drop constraint if exists inventory_warehouse_transfers_outbound_movement_id_fkey;

alter table public.inventory_warehouse_transfers
  add constraint inventory_warehouse_transfers_outbound_movement_id_fkey
  foreign key (outbound_movement_id) references public.inventory_movements (id) on delete set null;

alter table public.inventory_warehouse_transfers
  drop constraint if exists inventory_warehouse_transfers_inbound_movement_id_fkey;

alter table public.inventory_warehouse_transfers
  add constraint inventory_warehouse_transfers_inbound_movement_id_fkey
  foreign key (inbound_movement_id) references public.inventory_movements (id) on delete set null;

alter table public.inventory_movements
  drop constraint if exists inventory_movements_warehouse_transfer_id_fkey;

alter table public.inventory_movements
  add constraint inventory_movements_warehouse_transfer_id_fkey
  foreign key (warehouse_transfer_id) references public.inventory_warehouse_transfers (id) on delete set null;

alter table public.inventory_warehouse_transfers enable row level security;

create policy inventory_warehouse_transfers_select on public.inventory_warehouse_transfers
  for select using (
    organization_id = public.current_organization_id()
    and public.user_has_permission('inventory.view')
    and (
      public.user_can_access_warehouse(from_warehouse_id)
      or public.user_can_access_warehouse(to_warehouse_id)
    )
  );

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
    raise exception 'Stock no encontrado en bodega de origen';
  end if;

  available_qty := greatest(stock_row.stock - stock_row.reserved, 0);

  if available_qty < p_qty then
    raise exception 'Stock disponible insuficiente en bodega de origen';
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
    warehouse_transfer_id
  ) values (
    target_org_id,
    p_from_warehouse_id,
    p_item_id,
    item_row.name,
    'salida',
    p_qty,
    format(
      'Transferencia a %s%s',
      to_wh.name,
      case when coalesce(btrim(p_note), '') = '' then '' else format(' · %s', btrim(p_note)) end
    ),
    auth.uid(),
    new_transfer_id
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
    warehouse_transfer_id
  ) values (
    target_org_id,
    transfer_row.to_warehouse_id,
    transfer_row.item_id,
    transfer_row.item_name,
    'entrada',
    transfer_row.qty,
    format('Transferencia desde %s', coalesce(from_wh.name, 'bodega origen')),
    auth.uid(),
    transfer_row.id
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
    warehouse_transfer_id
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
    transfer_row.id
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

grant execute on function public.create_inventory_warehouse_transfer(
  uuid, uuid, uuid, uuid, numeric, text
) to authenticated, service_role;

grant execute on function public.receive_inventory_warehouse_transfer(uuid, uuid)
  to authenticated, service_role;

grant execute on function public.cancel_inventory_warehouse_transfer(uuid, uuid)
  to authenticated, service_role;
