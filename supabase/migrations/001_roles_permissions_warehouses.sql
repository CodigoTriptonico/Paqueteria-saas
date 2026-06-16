-- Multi-tenant RBAC + warehouses + inventory (Boxario)

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  settings jsonb not null default '{"multi_warehouse_enabled": false}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  slug text not null,
  name text not null,
  is_system boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  granted boolean not null default true,
  primary key (role_id, permission_id)
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  full_name text,
  role_id uuid not null references public.roles (id),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  code text,
  is_active boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.profile_warehouses (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  warehouse_id uuid not null references public.warehouses (id) on delete cascade,
  primary key (profile_id, warehouse_id)
);

create table public.inventory_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  tree_data jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  category_id uuid not null references public.inventory_categories (id) on delete cascade,
  name text not null,
  kind text not null,
  subcategory text,
  size text,
  location text,
  unit text,
  created_at timestamptz not null default now()
);

create table public.inventory_stock (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  warehouse_id uuid not null references public.warehouses (id) on delete cascade,
  item_id uuid not null references public.inventory_items (id) on delete cascade,
  stock numeric not null default 0 check (stock >= 0),
  reserved numeric not null default 0 check (reserved >= 0),
  min_stock numeric not null default 2 check (min_stock >= 0),
  unique (warehouse_id, item_id)
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  warehouse_id uuid not null references public.warehouses (id),
  item_id uuid not null references public.inventory_items (id),
  item_name text not null,
  type text not null check (type in ('entrada', 'salida', 'ajuste')),
  qty numeric not null,
  note text not null default '',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index idx_profiles_org on public.profiles (organization_id);
create index idx_roles_org on public.roles (organization_id);
create index idx_warehouses_org on public.warehouses (organization_id);
create index idx_inventory_categories_org on public.inventory_categories (organization_id);
create index idx_inventory_items_org on public.inventory_items (organization_id);
create index idx_inventory_stock_wh on public.inventory_stock (warehouse_id);
create index idx_inventory_movements_wh on public.inventory_movements (warehouse_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Seed global permissions
-- ---------------------------------------------------------------------------

insert into public.permissions (key, name, description) values
  ('all', 'Todo', 'Acceso completo'),
  ('users.manage', 'Usuarios', 'Crear e invitar usuarios'),
  ('permissions.manage', 'Permisos', 'Editar permisos por rol'),
  ('warehouses.manage', 'Bodegas', 'Crear y administrar bodegas'),
  ('settings.manage', 'Configuracion', 'Ajustes de empresa'),
  ('sales.manage', 'Ventas', 'Registrar ventas'),
  ('customers.manage', 'Clientes', 'Gestionar clientes'),
  ('inventory.view', 'Ver inventario', 'Consultar inventario'),
  ('inventory.reserve', 'Reservar stock', 'Reservar o descontar stock'),
  ('inventory.adjust', 'Ajustar inventario', 'Entradas y ajustes'),
  ('routes.view', 'Ver rutas', 'Ver envios asignados'),
  ('routes.update_status', 'Estado envio', 'Cambiar estado de envios')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Helpers (security definer)
-- ---------------------------------------------------------------------------

create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

create or replace function public.current_role_slug()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select r.slug
  from public.profiles p
  join public.roles r on r.id = p.role_id
  where p.id = auth.uid();
$$;

create or replace function public.user_has_permission(perm_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  role_slug text;
begin
  if auth.uid() is null then
    return false;
  end if;

  select r.slug into role_slug
  from public.profiles p
  join public.roles r on r.id = p.role_id
  where p.id = auth.uid() and p.is_active = true;

  if role_slug is null then
    return false;
  end if;

  if role_slug = 'administrador' then
    return true;
  end if;

  return exists (
    select 1
    from public.profiles p
    join public.role_permissions rp on rp.role_id = p.role_id and rp.granted = true
    join public.permissions pm on pm.id = rp.permission_id
    where p.id = auth.uid() and pm.key = perm_key
  );
end;
$$;

create or replace function public.user_can_access_warehouse(wh_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  org_id uuid;
  assigned_count int;
begin
  if auth.uid() is null then
    return false;
  end if;

  select organization_id into org_id from public.profiles where id = auth.uid();

  if not exists (
    select 1 from public.warehouses w
    where w.id = wh_id and w.organization_id = org_id and w.is_active = true
  ) then
    return false;
  end if;

  if public.current_role_slug() = 'administrador' then
    return true;
  end if;

  select count(*) into assigned_count
  from public.profile_warehouses pw
  where pw.profile_id = auth.uid();

  if assigned_count = 0 then
    return true;
  end if;

  return exists (
    select 1 from public.profile_warehouses pw
    where pw.profile_id = auth.uid() and pw.warehouse_id = wh_id
  );
end;
$$;

-- Bootstrap organization with default roles + warehouse
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
      'sales.manage', 'customers.manage', 'inventory.view', 'inventory.reserve'
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

grant execute on function public.bootstrap_organization(text, uuid, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.permissions enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.profiles enable row level security;
alter table public.warehouses enable row level security;
alter table public.profile_warehouses enable row level security;
alter table public.inventory_categories enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_stock enable row level security;
alter table public.inventory_movements enable row level security;

-- organizations
create policy org_select on public.organizations for select
  using (id = public.current_organization_id());

create policy org_update on public.organizations for update
  using (id = public.current_organization_id() and public.user_has_permission('settings.manage'));

-- permissions (read-only for authenticated)
create policy permissions_select on public.permissions for select
  to authenticated using (true);

-- roles
create policy roles_select on public.roles for select
  using (organization_id = public.current_organization_id());

create policy roles_update on public.roles for update
  using (organization_id = public.current_organization_id() and public.user_has_permission('permissions.manage'));

-- role_permissions
create policy role_permissions_select on public.role_permissions for select
  using (
    exists (
      select 1 from public.roles r
      where r.id = role_id and r.organization_id = public.current_organization_id()
    )
  );

create policy role_permissions_write on public.role_permissions for all
  using (
    exists (
      select 1 from public.roles r
      where r.id = role_id and r.organization_id = public.current_organization_id()
    )
    and public.user_has_permission('permissions.manage')
  );

-- profiles
create policy profiles_select on public.profiles for select
  using (organization_id = public.current_organization_id());

create policy profiles_update on public.profiles for update
  using (
    organization_id = public.current_organization_id()
    and (public.user_has_permission('users.manage') or id = auth.uid())
  );

create policy profiles_insert on public.profiles for insert
  with check (
    organization_id = public.current_organization_id()
    and public.user_has_permission('users.manage')
  );

-- warehouses
create policy warehouses_select on public.warehouses for select
  using (
    organization_id = public.current_organization_id()
    and (public.user_can_access_warehouse(id) or public.user_has_permission('warehouses.manage'))
  );

create policy warehouses_insert on public.warehouses for insert
  with check (
    organization_id = public.current_organization_id()
    and public.user_has_permission('warehouses.manage')
  );

create policy warehouses_update on public.warehouses for update
  using (
    organization_id = public.current_organization_id()
    and public.user_has_permission('warehouses.manage')
  );

-- profile_warehouses
create policy profile_warehouses_select on public.profile_warehouses for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.organization_id = public.current_organization_id()
    )
  );

create policy profile_warehouses_write on public.profile_warehouses for all
  using (public.user_has_permission('users.manage'));

-- inventory_categories
create policy inv_cat_select on public.inventory_categories for select
  using (organization_id = public.current_organization_id() and public.user_has_permission('inventory.view'));

create policy inv_cat_write on public.inventory_categories for all
  using (
    organization_id = public.current_organization_id()
    and (public.user_has_permission('settings.manage') or public.user_has_permission('warehouses.manage'))
  );

-- inventory_items
create policy inv_items_select on public.inventory_items for select
  using (organization_id = public.current_organization_id() and public.user_has_permission('inventory.view'));

create policy inv_items_write on public.inventory_items for all
  using (
    organization_id = public.current_organization_id()
    and (public.user_has_permission('settings.manage') or public.user_has_permission('inventory.adjust'))
  );

-- inventory_stock
create policy inv_stock_select on public.inventory_stock for select
  using (
    organization_id = public.current_organization_id()
    and public.user_has_permission('inventory.view')
    and public.user_can_access_warehouse(warehouse_id)
  );

create policy inv_stock_write on public.inventory_stock for all
  using (
    organization_id = public.current_organization_id()
    and public.user_can_access_warehouse(warehouse_id)
    and (
      public.user_has_permission('inventory.adjust')
      or public.user_has_permission('inventory.reserve')
    )
  );

-- inventory_movements
create policy inv_mov_select on public.inventory_movements for select
  using (
    organization_id = public.current_organization_id()
    and public.user_has_permission('inventory.view')
    and public.user_can_access_warehouse(warehouse_id)
  );

create policy inv_mov_insert on public.inventory_movements for insert
  with check (
    organization_id = public.current_organization_id()
    and public.user_can_access_warehouse(warehouse_id)
    and (
      public.user_has_permission('inventory.adjust')
      or public.user_has_permission('inventory.reserve')
    )
  );
