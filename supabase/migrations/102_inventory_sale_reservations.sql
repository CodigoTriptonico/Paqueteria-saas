-- Reserve empty-box stock when a sale is created; fulfill on handoff/load; release on cancel.

create table if not exists public.inventory_sale_reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  shipment_id uuid not null references public.shipments (id) on delete cascade,
  warehouse_id uuid not null references public.warehouses (id) on delete cascade,
  item_id uuid not null references public.inventory_items (id) on delete cascade,
  item_name text not null,
  qty numeric not null check (qty > 0),
  status text not null default 'active' check (status in ('active', 'fulfilled', 'released')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  fulfilled_at timestamptz,
  released_at timestamptz,
  unique (shipment_id, item_id)
);

create index if not exists idx_inventory_sale_reservations_org_shipment
  on public.inventory_sale_reservations (organization_id, shipment_id, status);

alter table public.inventory_sale_reservations enable row level security;

drop policy if exists inventory_sale_reservations_select on public.inventory_sale_reservations;
create policy inventory_sale_reservations_select on public.inventory_sale_reservations
  for select using (
    organization_id = public.current_organization_id()
    and public.user_has_permission('inventory.view')
  );

create or replace function public.reserve_inventory_sale_stock(
  target_org_id uuid,
  p_shipment_id uuid,
  p_warehouse_id uuid,
  p_item_id uuid,
  p_item_name text,
  p_qty numeric,
  p_created_by uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  stock_row public.inventory_stock%rowtype;
  available_qty numeric;
  reservation_id uuid;
  existing_id uuid;
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
      or public.user_has_permission('sales.manage')
    ) then
      raise exception 'Forbidden';
    end if;
  end if;

  if p_qty is null or p_qty <= 0 then
    raise exception 'Cantidad invalida';
  end if;

  select id
  into existing_id
  from public.inventory_sale_reservations
  where shipment_id = p_shipment_id
    and item_id = p_item_id
    and status = 'active'
  limit 1;

  if existing_id is not null then
    return jsonb_build_object('reservation_id', existing_id, 'idempotent', true);
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

  available_qty := stock_row.stock - stock_row.reserved;
  if available_qty < p_qty then
    raise exception 'Stock insuficiente para reservar';
  end if;

  update public.inventory_stock
  set reserved = reserved + p_qty
  where id = stock_row.id;

  insert into public.inventory_sale_reservations (
    organization_id,
    shipment_id,
    warehouse_id,
    item_id,
    item_name,
    qty,
    status,
    created_by
  ) values (
    target_org_id,
    p_shipment_id,
    p_warehouse_id,
    p_item_id,
    coalesce(nullif(btrim(p_item_name), ''), 'Item'),
    p_qty,
    'active',
    p_created_by
  )
  returning id into reservation_id;

  return jsonb_build_object(
    'reservation_id', reservation_id,
    'reserved', stock_row.reserved + p_qty,
    'available', available_qty - p_qty
  );
end;
$$;

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

  for reservation_row in
    select *
    from public.inventory_sale_reservations
    where organization_id = target_org_id
      and shipment_id = p_shipment_id
      and status = 'active'
    order by created_at
    for update
  loop
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
      assignee_id
    ) values (
      target_org_id,
      reservation_row.warehouse_id,
      reservation_row.item_id,
      reservation_row.item_name,
      'salida',
      reservation_row.qty,
      coalesce(p_note, ''),
      p_created_by,
      p_assignee_id
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

create or replace function public.release_inventory_sale_stock(
  target_org_id uuid,
  p_shipment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  reservation_row public.inventory_sale_reservations%rowtype;
  stock_row public.inventory_stock%rowtype;
  released_count integer := 0;
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
      or public.user_has_permission('sales.manage')
    ) then
      raise exception 'Forbidden';
    end if;
  end if;

  for reservation_row in
    select *
    from public.inventory_sale_reservations
    where organization_id = target_org_id
      and shipment_id = p_shipment_id
      and status = 'active'
    order by created_at
    for update
  loop
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

    update public.inventory_stock
    set reserved = reserved - reservation_row.qty
    where id = stock_row.id;

    update public.inventory_sale_reservations
    set
      status = 'released',
      released_at = now()
    where id = reservation_row.id;

    released_count := released_count + 1;
  end loop;

  return jsonb_build_object('released_count', released_count);
end;
$$;
