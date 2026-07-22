-- Base roles: administrador, vendedor, conductor, logistica.
-- Optional roles (bodega, finanzas, auditor, captadores, etc.) are added from the app catalog.

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
  role_logistics uuid;
  wh_id uuid;
  perm record;
  final_slug text;
  slug_base text;
  slug_suffix int := 0;
  resolved_kind text;
  resolved_phone text;
  resolved_phone_digits text;
begin
  resolved_kind := case when lower(trim(coalesce(org_kind, ''))) = 'platform' then 'platform' else 'client' end;
  resolved_phone := nullif(trim(coalesce(owner_phone, '')), '');
  resolved_phone_digits := public.normalize_phone_digits(resolved_phone);
  slug_base := coalesce(nullif(trim(org_slug), ''), public.slugify_org_name(org_name));
  if slug_base = '' then slug_base := 'empresa'; end if;
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
  insert into public.roles (organization_id, slug, name, is_system) values
    (org_id, 'logistica', 'Logística', true) returning id into role_logistics;

  for perm in select id, key from public.permissions loop
    insert into public.role_permissions (role_id, permission_id, granted)
    select role_admin, perm.id, true;
    insert into public.role_permissions (role_id, permission_id, granted)
    select role_vendor, perm.id, perm.key in (
      'sales.manage', 'customers.manage', 'inventory.view', 'inventory.reserve'
    );
    insert into public.role_permissions (role_id, permission_id, granted)
    select role_driver, perm.id, perm.key in ('routes.view', 'routes.update_status');
    insert into public.role_permissions (role_id, permission_id, granted)
    select role_logistics, perm.id, perm.key in ('routes.view', 'routes.update_status');
  end loop;

  insert into public.warehouses (organization_id, name, code, is_default, is_active)
  values (org_id, 'Bodega principal', 'MAIN', true, true) returning id into wh_id;

  insert into public.profiles (
    id, organization_id, email, full_name, role_id, is_active, phone, phone_digits, phone_verified_at
  ) values (
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

create or replace function public.initialize_business_matrix_organization(
  target_organization_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  organization public.organizations;
  member_role record;
  tenant_id_value uuid;
begin
  select * into organization
  from public.organizations
  where id = target_organization_id
  for update;

  if organization.id is null or organization.kind <> 'client' then
    raise exception 'CLIENT_ORGANIZATION_REQUIRED';
  end if;

  if organization.tenant_id is not null then
    if organization.organization_type <> 'matrix'
       or organization.tenant_id <> organization.id then
      raise exception 'ORGANIZATION_ALREADY_ATTACHED_TO_TENANT';
    end if;
    return organization.tenant_id;
  end if;

  tenant_id_value := organization.id;

  insert into public.business_tenants (
    id, code, name, status, matrix_organization_id, archived_at
  ) values (
    tenant_id_value,
    upper(coalesce(nullif(btrim(organization.slug), ''), 'TENANT-' || left(organization.id::text, 8))),
    organization.name,
    case when organization.is_active then 'active' else 'inactive' end,
    organization.id,
    null
  ) on conflict (id) do update set
    code = excluded.code,
    name = excluded.name,
    status = excluded.status,
    matrix_organization_id = excluded.matrix_organization_id,
    updated_at = now();

  update public.organizations
  set
    tenant_id = tenant_id_value,
    organization_type = 'matrix',
    organization_code = upper(coalesce(nullif(btrim(slug), ''), 'M-' || left(id::text, 8))),
    organization_status = case when is_active then 'active' else 'inactive' end,
    matrix_organization_id = id
  where id = organization.id;

  -- Solo roles base. Opcionales se agregan desde Configuración → Roles sugeridos.
  insert into public.roles (organization_id, slug, name, is_system)
  values
    (organization.id, 'administrador', 'Administrador', true),
    (organization.id, 'vendedor', 'Vendedor', true),
    (organization.id, 'conductor', 'Conductor', true),
    (organization.id, 'logistica', 'Logística', true)
  on conflict (organization_id, slug) do update
    set name = excluded.name,
        is_system = true;

  with template_permissions(role_slug, permission_key) as (
    values
      ('logistica', 'routes.view'),
      ('logistica', 'routes.update_status')
  )
  insert into public.role_permissions (role_id, permission_id, granted)
  select matrix_role.id, permission.id, true
  from public.roles as matrix_role
  join template_permissions as template on template.role_slug = matrix_role.slug
  join public.permissions as permission on permission.key = template.permission_key
  where matrix_role.organization_id = organization.id
  on conflict (role_id, permission_id) do update set granted = true;

  for member_role in
    select profile.id as user_id, profile.role_id, assigned_role.slug, assigned_role.name
    from public.profiles as profile
    join public.roles as assigned_role on assigned_role.id = profile.role_id
    where profile.organization_id = organization.id
      and profile.is_active = true
      and profile.archived_at is null
  loop
    if not exists (
      select 1
      from public.organization_memberships as membership
      where membership.user_id = member_role.user_id
        and membership.status = 'active'
        and membership.ended_at is null
    ) then
      insert into public.organization_memberships (
        tenant_id, organization_id, user_id, role_id, role_slug_snapshot,
        role_name_snapshot, access_scope, status, valid_from
      ) values (
        tenant_id_value,
        organization.id,
        member_role.user_id,
        member_role.role_id,
        member_role.slug,
        member_role.name,
        case
          when member_role.slug in ('administrador', 'finanzas', 'logistica', 'auditor') then 'tenant'
          when member_role.slug = 'supervisor_agencias' then 'team'
          when member_role.slug in ('captador_distribuidores', 'captador_agencias') then 'portfolio'
          when member_role.slug = 'conductor' then 'assigned_resource'
          else 'organization'
        end,
        'active',
        now()
      );
    end if;
  end loop;

  return tenant_id_value;
end;
$$;

grant execute on function public.initialize_business_matrix_organization(uuid) to service_role;
