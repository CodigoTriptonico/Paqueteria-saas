-- Teléfono en perfiles para recuperación de contraseña por SMS

create or replace function public.normalize_phone_digits(raw text)
returns text
language sql
immutable
as $$
  select regexp_replace(coalesce(raw, ''), '\D', '', 'g');
$$;

alter table public.profiles
  add column if not exists phone text not null default '',
  add column if not exists phone_digits text not null default '',
  add column if not exists phone_verified_at timestamptz;

create unique index if not exists profiles_phone_digits_uidx
  on public.profiles (phone_digits)
  where phone_digits <> '';

create or replace function public.bootstrap_organization(
  org_name text,
  owner_id uuid,
  owner_email text,
  owner_name text default null,
  org_slug text default null,
  org_kind text default 'client',
  owner_phone text default null
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
  resolved_kind text;
  resolved_phone text;
  resolved_phone_digits text;
begin
  resolved_kind := case
    when lower(trim(coalesce(org_kind, ''))) = 'platform' then 'platform'
    else 'client'
  end;

  resolved_phone := nullif(trim(coalesce(owner_phone, '')), '');
  resolved_phone_digits := public.normalize_phone_digits(resolved_phone);

  slug_base := coalesce(nullif(trim(org_slug), ''), public.slugify_org_name(org_name));
  if slug_base = '' then
    slug_base := 'empresa';
  end if;

  final_slug := slug_base;
  while exists (select 1 from public.organizations o where o.slug = final_slug) loop
    slug_suffix := slug_suffix + 1;
    final_slug := slug_base || '-' || slug_suffix::text;
  end loop;

  insert into public.organizations (name, slug, is_active, kind)
  values (org_name, final_slug, true, resolved_kind)
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

  insert into public.profiles (
    id,
    organization_id,
    email,
    full_name,
    role_id,
    is_active,
    phone,
    phone_digits,
    phone_verified_at
  )
  values (
    owner_id,
    org_id,
    owner_email,
    coalesce(owner_name, owner_email),
    role_admin,
    true,
    coalesce(resolved_phone, ''),
    resolved_phone_digits,
    null
  );

  return org_id;
end;
$$;

grant execute on function public.bootstrap_organization(text, uuid, text, text, text, text, text) to service_role;
