-- New client organizations are matrices by default. Keep the legacy
-- bootstrap untouched because distribution partners still use it as an
-- intermediate organization before they are attached to a parent matrix.

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
  role record;
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

  insert into public.roles (organization_id, slug, name, is_system)
  values
    (organization.id, 'supervisor_agencias', 'Supervisor de agencias', true),
    (organization.id, 'captador_agencias', 'Captador de agencias', true),
    (organization.id, 'finanzas', 'Finanzas', true),
    (organization.id, 'logistica', 'Logística', true),
    (organization.id, 'bodega', 'Bodega', true),
    (organization.id, 'auditor', 'Auditor', true)
  on conflict (organization_id, slug) do update set name = excluded.name, is_system = true;

  with template_permissions(role_slug, permission_key) as (
    values
      ('supervisor_agencias', 'agency.view'),
      ('supervisor_agencias', 'agency.captor.assign'),
      ('supervisor_agencias', 'agency.supervisor.assign'),
      ('supervisor_agencias', 'agency.support'),
      ('supervisor_agencias', 'agency.requests.view'),
      ('captador_agencias', 'agency.view'),
      ('captador_agencias', 'agency.create'),
      ('captador_agencias', 'agency.support'),
      ('captador_agencias', 'agency.requests.view'),
      ('finanzas', 'agency.view'),
      ('finanzas', 'agency.account.view'),
      ('finanzas', 'agency.account.charge'),
      ('finanzas', 'agency.account.payment'),
      ('finanzas', 'agency.account.apply'),
      ('finanzas', 'accounting.view'),
      ('finanzas', 'accounting.post'),
      ('finanzas', 'accounting.reconcile'),
      ('finanzas', 'accounting.reverse'),
      ('finanzas', 'financial_hold.view'),
      ('finanzas', 'financial_hold.release'),
      ('finanzas', 'financial_hold.release_manual'),
      ('logistica', 'agency.view'),
      ('logistica', 'agency.requests.view'),
      ('logistica', 'agency.requests.assign'),
      ('logistica', 'agency.visits.confirm'),
      ('logistica', 'routes.view'),
      ('logistica', 'routes.update_status'),
      ('bodega', 'inventory.view'),
      ('bodega', 'warehouses.manage'),
      ('bodega', 'financial_hold.view'),
      ('auditor', 'agency.view'),
      ('auditor', 'agency.account.view'),
      ('auditor', 'accounting.view'),
      ('auditor', 'financial_hold.view'),
      ('auditor', 'audit.immutable.view')
  )
  insert into public.role_permissions (role_id, permission_id, granted)
  select role.id, permission.id, true
  from public.roles role
  join template_permissions template on template.role_slug = role.slug
  join public.permissions permission on permission.key = template.permission_key
  where role.organization_id = organization.id
  on conflict (role_id, permission_id) do update set granted = true;

  for role in
    select profile.id as user_id, profile.role_id, role.slug, role.name
    from public.profiles profile
    join public.roles role on role.id = profile.role_id
    where profile.organization_id = organization.id
      and profile.is_active = true
      and profile.archived_at is null
  loop
    if not exists (
      select 1
      from public.organization_memberships membership
      where membership.user_id = role.user_id
        and membership.status = 'active'
        and membership.ended_at is null
    ) then
      insert into public.organization_memberships (
        tenant_id, organization_id, user_id, role_id, role_slug_snapshot,
        role_name_snapshot, access_scope, status, valid_from
      ) values (
        tenant_id_value,
        organization.id,
        role.user_id,
        role.role_id,
        role.slug,
        role.name,
        case
          when role.slug in ('administrador', 'finanzas', 'logistica', 'auditor') then 'tenant'
          when role.slug = 'supervisor_agencias' then 'team'
          when role.slug in ('captador_distribuidores', 'captador_agencias') then 'portfolio'
          when role.slug = 'conductor' then 'assigned_resource'
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
