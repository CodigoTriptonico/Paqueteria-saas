-- Platform (super) admin: gestión cross-tenant de paqueterías

-- ---------------------------------------------------------------------------
-- Organizations: slug + estado activo
-- ---------------------------------------------------------------------------

alter table public.organizations
  add column if not exists slug text,
  add column if not exists is_active boolean not null default true;

create or replace function public.slugify_org_name(input text)
returns text
language sql
immutable
as $$
  select trim(both '-' from lower(regexp_replace(coalesce(input, ''), '[^a-zA-Z0-9]+', '-', 'g')));
$$;

update public.organizations
set slug = public.slugify_org_name(name) || '-' || left(id::text, 8)
where slug is null or slug = '';

alter table public.organizations
  alter column slug set not null;

create unique index if not exists organizations_slug_unique on public.organizations (slug);

-- ---------------------------------------------------------------------------
-- Platform admins
-- ---------------------------------------------------------------------------

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

create policy platform_admins_self_select on public.platform_admins
  for select
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins where user_id = auth.uid()
  );
$$;

grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.slugify_org_name(text) to authenticated;

-- Bootstrap organization (slug + is_active)
create or replace function public.bootstrap_organization(
  org_name text,
  owner_id uuid,
  owner_email text,
  owner_name text default null,
  org_slug text default null
)
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
  final_slug text;
  slug_base text;
  slug_try text;
  slug_suffix int := 0;
begin
  slug_base := coalesce(nullif(trim(org_slug), ''), public.slugify_org_name(org_name));
  if slug_base = '' then
    slug_base := 'empresa';
  end if;

  final_slug := slug_base;
  while exists (select 1 from public.organizations o where o.slug = final_slug) loop
    slug_suffix := slug_suffix + 1;
    final_slug := slug_base || '-' || slug_suffix::text;
  end loop;

  insert into public.organizations (name, slug, is_active)
  values (org_name, final_slug, true)
  returning id into org_id;

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

  insert into public.profiles (id, organization_id, email, full_name, role_id, is_active)
  values (owner_id, org_id, owner_email, coalesce(owner_name, owner_email), role_admin, true);

  return org_id;
end;
$$;

grant execute on function public.bootstrap_organization(text, uuid, text, text, text) to service_role;

-- Promover usuario a platform admin (solo service_role / SQL manual)
create or replace function public.grant_platform_admin(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.platform_admins (user_id)
  values (target_user_id)
  on conflict (user_id) do nothing;
end;
$$;

grant execute on function public.grant_platform_admin(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- RLS: platform admin cross-tenant
-- ---------------------------------------------------------------------------

create policy org_platform_select on public.organizations
  for select
  using (public.is_platform_admin());

create policy org_platform_insert on public.organizations
  for insert
  with check (public.is_platform_admin());

create policy org_platform_update on public.organizations
  for update
  using (public.is_platform_admin());

create policy profiles_platform_select on public.profiles
  for select
  using (public.is_platform_admin());

create policy profiles_platform_insert on public.profiles
  for insert
  with check (public.is_platform_admin());

create policy profiles_platform_update on public.profiles
  for update
  using (public.is_platform_admin());

create policy warehouses_platform_select on public.warehouses
  for select
  using (public.is_platform_admin());

create policy roles_platform_select on public.roles
  for select
  using (public.is_platform_admin());
