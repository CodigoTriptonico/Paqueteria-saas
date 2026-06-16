-- Inventory assignments, stock buckets, extended movements

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------

insert into public.permissions (key, name, description) values
  ('inventory.assign', 'Asignar inventario', 'Asignar items a empleados'),
  ('inventory.return', 'Devolver inventario', 'Cerrar asignaciones y devolver stock')
on conflict (key) do nothing;

-- Grant to vendedor on existing orgs
insert into public.role_permissions (role_id, permission_id, granted)
select r.id, p.id, true
from public.roles r
cross join public.permissions p
where r.slug = 'vendedor'
  and p.key in ('inventory.assign', 'inventory.return')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Stock buckets
-- ---------------------------------------------------------------------------

alter table public.inventory_stock
  add column if not exists assigned numeric not null default 0 check (assigned >= 0),
  add column if not exists unavailable numeric not null default 0 check (unavailable >= 0);

-- ---------------------------------------------------------------------------
-- Assignments
-- ---------------------------------------------------------------------------

create table if not exists public.inventory_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  warehouse_id uuid not null references public.warehouses (id) on delete cascade,
  item_id uuid not null references public.inventory_items (id) on delete cascade,
  item_name text not null,
  assignee_id uuid not null references public.profiles (id),
  qty_assigned numeric not null check (qty_assigned > 0),
  qty_returned numeric not null default 0 check (qty_returned >= 0),
  qty_consumed numeric not null default 0 check (qty_consumed >= 0),
  qty_damaged numeric not null default 0 check (qty_damaged >= 0),
  qty_lost numeric not null default 0 check (qty_lost >= 0),
  status text not null default 'open' check (status in ('open', 'closed')),
  outcome text check (
    outcome is null
    or outcome in ('returned_intact', 'consumed', 'damaged', 'lost', 'partial')
  ),
  note text not null default '',
  assigned_by uuid references public.profiles (id),
  closed_by uuid references public.profiles (id),
  assigned_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists idx_inventory_assignments_org_status
  on public.inventory_assignments (organization_id, status);
create index if not exists idx_inventory_assignments_assignee_status
  on public.inventory_assignments (assignee_id, status);
create index if not exists idx_inventory_assignments_wh_item_status
  on public.inventory_assignments (warehouse_id, item_id, status);

-- ---------------------------------------------------------------------------
-- Extended movements
-- ---------------------------------------------------------------------------

alter table public.inventory_movements
  add column if not exists assignment_id uuid references public.inventory_assignments (id),
  add column if not exists assignee_id uuid references public.profiles (id);

alter table public.inventory_movements
  drop constraint if exists inventory_movements_type_check;

alter table public.inventory_movements
  add constraint inventory_movements_type_check check (
    type in (
      'entrada', 'salida', 'ajuste',
      'asignacion', 'devolucion', 'consumo', 'dano', 'perdida'
    )
  );

create index if not exists idx_inventory_movements_assignee
  on public.inventory_movements (assignee_id, created_at desc);
create index if not exists idx_inventory_movements_item
  on public.inventory_movements (item_id, created_at desc);
create index if not exists idx_inventory_movements_created_by
  on public.inventory_movements (created_by, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS: assignments
-- ---------------------------------------------------------------------------

alter table public.inventory_assignments enable row level security;

create policy inv_assign_select on public.inventory_assignments for select
  using (
    organization_id = public.current_organization_id()
    and public.user_has_permission('inventory.view')
    and public.user_can_access_warehouse(warehouse_id)
  );

create policy inv_assign_insert on public.inventory_assignments for insert
  with check (
    organization_id = public.current_organization_id()
    and public.user_can_access_warehouse(warehouse_id)
    and public.user_has_permission('inventory.assign')
  );

create policy inv_assign_update on public.inventory_assignments for update
  using (
    organization_id = public.current_organization_id()
    and public.user_can_access_warehouse(warehouse_id)
    and public.user_has_permission('inventory.return')
  );

-- Extend stock / movement policies for assign + return
drop policy if exists inv_stock_write on public.inventory_stock;
create policy inv_stock_write on public.inventory_stock for all
  using (
    organization_id = public.current_organization_id()
    and public.user_can_access_warehouse(warehouse_id)
    and (
      public.user_has_permission('inventory.adjust')
      or public.user_has_permission('inventory.reserve')
      or public.user_has_permission('inventory.assign')
      or public.user_has_permission('inventory.return')
    )
  );

drop policy if exists inv_mov_insert on public.inventory_movements;
create policy inv_mov_insert on public.inventory_movements for insert
  with check (
    organization_id = public.current_organization_id()
    and public.user_can_access_warehouse(warehouse_id)
    and (
      public.user_has_permission('inventory.adjust')
      or public.user_has_permission('inventory.reserve')
      or public.user_has_permission('inventory.assign')
      or public.user_has_permission('inventory.return')
    )
  );

-- ---------------------------------------------------------------------------
-- Transactional RPC: assign
-- ---------------------------------------------------------------------------

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

  select id into assignee_row
  from public.profiles
  where id = p_assignee_id
    and organization_id = org_id
    and is_active = true;

  if assignee_row.id is null then
    raise exception 'Empleado no encontrado';
  end if;

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
    type, qty, note, created_by, assignment_id, assignee_id
  ) values (
    org_id, p_warehouse_id, p_item_id, item_row.name,
    'asignacion', p_qty, coalesce(p_note, ''), auth.uid(),
    new_assignment_id, p_assignee_id
  )
  returning id into new_movement_id;

  return jsonb_build_object(
    'assignment_id', new_assignment_id,
    'movement_id', new_movement_id
  );
end;
$$;

grant execute on function public.assign_inventory_item(uuid, uuid, uuid, numeric, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Transactional RPC: close assignment
-- ---------------------------------------------------------------------------

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
  open_qty numeric;
  total_close numeric;
  mov_type text;
  mov_qty numeric;
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

  -- Movement for returned qty
  if coalesce(p_qty_returned, 0) > 0 then
    insert into public.inventory_movements (
      organization_id, warehouse_id, item_id, item_name,
      type, qty, note, created_by, assignment_id, assignee_id
    ) values (
      org_id, asg.warehouse_id, asg.item_id, asg.item_name,
      'devolucion', p_qty_returned, coalesce(p_note, ''), auth.uid(),
      asg.id, asg.assignee_id
    );
  end if;

  if coalesce(p_qty_consumed, 0) > 0 then
    insert into public.inventory_movements (
      organization_id, warehouse_id, item_id, item_name,
      type, qty, note, created_by, assignment_id, assignee_id
    ) values (
      org_id, asg.warehouse_id, asg.item_id, asg.item_name,
      'consumo', p_qty_consumed, coalesce(p_note, ''), auth.uid(),
      asg.id, asg.assignee_id
    );
  end if;

  if coalesce(p_qty_damaged, 0) > 0 then
    insert into public.inventory_movements (
      organization_id, warehouse_id, item_id, item_name,
      type, qty, note, created_by, assignment_id, assignee_id
    ) values (
      org_id, asg.warehouse_id, asg.item_id, asg.item_name,
      'dano', p_qty_damaged, coalesce(p_note, ''), auth.uid(),
      asg.id, asg.assignee_id
    );
  end if;

  if coalesce(p_qty_lost, 0) > 0 then
    insert into public.inventory_movements (
      organization_id, warehouse_id, item_id, item_name,
      type, qty, note, created_by, assignment_id, assignee_id
    ) values (
      org_id, asg.warehouse_id, asg.item_id, asg.item_name,
      'perdida', p_qty_lost, coalesce(p_note, ''), auth.uid(),
      asg.id, asg.assignee_id
    );
  end if;

  return jsonb_build_object('assignment_id', asg.id, 'outcome', p_outcome);
end;
$$;

grant execute on function public.close_inventory_assignment(uuid, text, numeric, numeric, numeric, numeric, text) to authenticated;

-- Update bootstrap for new orgs
create or replace function public.bootstrap_organization(org_name text, owner_id uuid, owner_email text, owner_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  role_admin uuid;
  role_vendor uuid;
  role_driver uuid;
  wh_id uuid;
  perm record;
begin
  insert into public.organizations (name) values (org_name) returning id into org_id;

  insert into public.roles (organization_id, slug, name, is_system) values
    (org_id, 'administrador', 'Administrador', true) returning id into role_admin;
  insert into public.roles (organization_id, slug, name, is_system) values
    (org_id, 'vendedor', 'Vendedor', true) returning id into role_vendor;
  insert into public.roles (organization_id, slug, name, is_system) values
    (org_id, 'conductor', 'Conductor', true) returning id into role_driver;

  for perm in select id, key from public.permissions loop
    insert into public.role_permissions (role_id, permission_id, granted)
    select role_admin, perm.id, true;

    insert into public.role_permissions (role_id, permission_id, granted)
    select role_vendor, perm.id, perm.key in (
      'sales.manage', 'customers.manage', 'inventory.view', 'inventory.reserve',
      'inventory.assign', 'inventory.return'
    );

    insert into public.role_permissions (role_id, permission_id, granted)
    select role_driver, perm.id, perm.key in ('routes.view', 'routes.update_status');
  end loop;

  insert into public.warehouses (organization_id, name, code, is_default, is_active)
  values (org_id, 'Bodega principal', 'MAIN', true, true)
  returning id into wh_id;

  insert into public.profiles (id, organization_id, email, full_name, role_id)
  values (owner_id, org_id, owner_email, coalesce(owner_name, owner_email), role_admin);

  return org_id;
end;
$$;
