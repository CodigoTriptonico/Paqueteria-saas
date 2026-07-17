-- Avoid using "role" as both a PL/pgSQL record and a SQL alias. PostgreSQL
-- resolves the record before the loop has assigned it, causing new-company
-- creation to fail with: record "role" is not assigned yet.

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
