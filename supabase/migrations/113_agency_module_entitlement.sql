-- Agencias is an optional Boxario module. Existing matrices without an
-- explicit contract setting remain disabled.

update public.organizations
set settings = jsonb_set(
  coalesce(settings, '{}'::jsonb),
  '{agencies_enabled}',
  'false'::jsonb,
  true
)
where organization_type = 'matrix'
  and not (coalesce(settings, '{}'::jsonb) ? 'agencies_enabled');

create or replace function public.tenant_has_agency_module(
  target_tenant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(matrix.settings ->> 'agencies_enabled', 'false') = 'true'
  from public.business_tenants tenant
  join public.organizations matrix
    on matrix.id = tenant.matrix_organization_id
   and matrix.tenant_id = tenant.id
  where tenant.id = target_tenant_id
    and tenant.status = 'active'
    and matrix.organization_status = 'active';
$$;

create or replace function public.current_membership_has_permission(
  permission_key text,
  target_tenant_id uuid,
  target_organization_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  membership public.organization_memberships;
  role_slug text;
  has_role_permission boolean;
begin
  if public.is_platform_admin() then
    return true;
  end if;

  if permission_key like 'agency.%'
     and not coalesce(public.tenant_has_agency_module(target_tenant_id), false) then
    return false;
  end if;

  if not public.tenant_organization_access(target_tenant_id, target_organization_id) then
    return false;
  end if;

  select current_membership.* into membership
  from public.organization_memberships current_membership
  where current_membership.id = public.current_membership_id();

  if membership.id is null then
    return false;
  end if;

  select role.slug into role_slug
  from public.roles role
  where role.id = membership.role_id;

  has_role_permission := role_slug = 'administrador' or exists (
    select 1
    from public.role_permissions role_permission
    join public.permissions permission on permission.id = role_permission.permission_id
    where role_permission.role_id = membership.role_id
      and role_permission.granted = true
      and permission.key = permission_key
  );

  if has_role_permission then
    return true;
  end if;

  return exists (
    select 1
    from public.agency_support_delegations delegation
    join public.agencies agency on agency.id = delegation.agency_id
    where delegation.tenant_id = target_tenant_id
      and delegation.delegate_membership_id = membership.id
      and delegation.revoked_at is null
      and delegation.valid_from <= now()
      and (delegation.valid_until is null or delegation.valid_until > now())
      and agency.organization_id = target_organization_id
      and permission_key = any(delegation.permissions)
  );
end;
$$;

grant execute on function public.tenant_has_agency_module(uuid) to authenticated, service_role;
grant execute on function public.current_membership_has_permission(text, uuid, uuid) to authenticated, service_role;

comment on function public.tenant_has_agency_module(uuid) is
  'Contrato del modulo Agencias. Ausente o false significa acceso bloqueado.';
