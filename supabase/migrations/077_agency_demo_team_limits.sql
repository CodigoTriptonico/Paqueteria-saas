-- Demo agency team: one responsible administrator and two sales seats.
-- These fields are per agency so future subscriptions can raise them safely.

alter table public.agencies
  add column if not exists max_administrators integer not null default 1
    check (max_administrators between 1 and 100),
  add column if not exists max_sellers integer not null default 2
    check (max_sellers between 0 and 1000);

create or replace function public.enforce_agency_demo_team_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_organization public.organizations;
  previous_organization public.organizations;
  target_role public.roles;
  previous_role public.roles;
  allowed_members integer;
  active_members integer;
begin
  if tg_op = 'UPDATE' then
    select * into previous_organization from public.organizations where id = old.organization_id;
    select * into previous_role from public.roles where id = old.role_id;

    if previous_organization.organization_type = 'agency'
       and old.is_active
       and old.archived_at is null
       and previous_role.slug = 'administrador_agencia'
       and (
         new.organization_id is distinct from old.organization_id
         or new.role_id is distinct from old.role_id
         or not new.is_active
         or new.archived_at is not null
       ) then
      select count(*)
        into active_members
      from public.profiles profile
      join public.roles role on role.id = profile.role_id
      where profile.organization_id = old.organization_id
        and profile.is_active
        and profile.archived_at is null
        and role.slug = 'administrador_agencia'
        and profile.id is distinct from old.id;

      if active_members = 0 then
        raise exception 'AGENCY_ADMIN_REQUIRED';
      end if;
    end if;
  end if;

  select * into target_organization from public.organizations where id = new.organization_id;
  if target_organization.organization_type is distinct from 'agency'
     or not new.is_active
     or new.archived_at is not null then
    return new;
  end if;

  select * into target_role
  from public.roles
  where id = new.role_id and organization_id = new.organization_id;

  if target_role.id is null then
    raise exception 'ROLE_ORGANIZATION_MISMATCH';
  end if;

  if target_role.slug not in ('administrador_agencia', 'vendedor_agencia') then
    raise exception 'AGENCY_ROLE_NOT_ALLOWED';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(new.organization_id::text || ':' || target_role.slug, 0)
  );

  select case target_role.slug
    when 'administrador_agencia' then agency.max_administrators
    else agency.max_sellers
  end
    into allowed_members
  from public.agencies agency
  where agency.organization_id = new.organization_id
    and agency.archived_at is null
  for share;

  if allowed_members is null then
    raise exception 'AGENCY_TEAM_LIMIT_CONFIG_MISSING';
  end if;

  select count(*)
    into active_members
  from public.profiles profile
  join public.roles role on role.id = profile.role_id
  where profile.organization_id = new.organization_id
    and profile.is_active
    and profile.archived_at is null
    and role.slug = target_role.slug
    and profile.id is distinct from new.id;

  if active_members >= allowed_members then
    if target_role.slug = 'administrador_agencia' then
      raise exception 'AGENCY_ADMIN_LIMIT_REACHED' using errcode = 'check_violation';
    end if;

    raise exception 'AGENCY_SELLER_LIMIT_REACHED' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_agency_demo_team_limit on public.profiles;
create trigger enforce_agency_demo_team_limit
  before insert or update of organization_id, role_id, is_active, archived_at
  on public.profiles
  for each row
  execute function public.enforce_agency_demo_team_limit();

create or replace function public.initialize_captor_agency_organization(
  target_organization_id uuid,
  target_matrix_organization_id uuid,
  target_captor_user_id uuid,
  target_owner_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  organization public.organizations;
  matrix_organization public.organizations;
  captor_membership public.organization_memberships;
  administrator_role_id uuid;
  agency_id_value uuid;
begin
  select * into organization
  from public.organizations
  where id = target_organization_id
  for update;

  if organization.id is null or organization.kind <> 'client' or organization.tenant_id is not null then
    raise exception 'NEW_CLIENT_ORGANIZATION_REQUIRED';
  end if;

  select * into matrix_organization
  from public.organizations
  where id = target_matrix_organization_id
  for update;

  if matrix_organization.id is null
     or matrix_organization.organization_type <> 'matrix'
     or matrix_organization.tenant_id is null
     or matrix_organization.organization_status <> 'active' then
    raise exception 'ACTIVE_MATRIX_ORGANIZATION_REQUIRED';
  end if;

  select * into captor_membership
  from public.organization_memberships membership
  where membership.user_id = target_captor_user_id
    and membership.organization_id = matrix_organization.id
    and membership.tenant_id = matrix_organization.tenant_id
    and membership.role_slug_snapshot = 'captador_agencias'
    and membership.status = 'active'
    and membership.ended_at is null
  for share;

  if captor_membership.id is null then
    raise exception 'ACTIVE_AGENCY_CAPTOR_REQUIRED';
  end if;

  update public.organizations
  set
    tenant_id = matrix_organization.tenant_id,
    organization_type = 'agency',
    organization_code = upper(coalesce(nullif(btrim(slug), ''), 'A-' || left(id::text, 8))),
    organization_status = 'active',
    matrix_organization_id = matrix_organization.id,
    is_active = true,
    settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object(
      'max_users', 2,
      'max_warehouses', 1,
      'multi_warehouse_enabled', false
    )
  where id = organization.id;

  insert into public.roles (organization_id, slug, name, is_system)
  values
    (organization.id, 'administrador_agencia', 'Administrador de agencia', true),
    (organization.id, 'vendedor_agencia', 'Vendedor de agencia', true)
  on conflict (organization_id, slug) do update set name = excluded.name;

  select id into administrator_role_id
  from public.roles
  where organization_id = organization.id and slug = 'administrador_agencia';

  insert into public.agencies (
    tenant_id, matrix_organization_id, organization_id, code, status,
    max_administrators, max_sellers
  )
  select
    matrix_organization.tenant_id,
    matrix_organization.id,
    organization.id,
    upper(coalesce(nullif(btrim(organization.slug), ''), 'A-' || left(organization.id::text, 8))),
    'active',
    1,
    2
  returning id into agency_id_value;

  update public.profiles
  set role_id = administrator_role_id, is_active = true
  where id = target_owner_user_id
    and organization_id = organization.id;

  if not found then
    raise exception 'AGENCY_OWNER_PROFILE_REQUIRED';
  end if;

  delete from public.roles
  where organization_id = organization.id
    and slug not in ('administrador_agencia', 'vendedor_agencia');

  with template_permissions(role_slug, permission_key) as (
    values
      ('administrador_agencia', 'agency.view'),
      ('administrador_agencia', 'agency.users.view'),
      ('administrador_agencia', 'agency.users.manage'),
      ('administrador_agencia', 'agency.pricing.view'),
      ('administrador_agencia', 'agency.pricing.manage'),
      ('administrador_agencia', 'agency.sales.view'),
      ('administrador_agencia', 'agency.sales.create'),
      ('administrador_agencia', 'agency.customers.manage'),
      ('administrador_agencia', 'agency.requests.view'),
      ('administrador_agencia', 'agency.requests.create'),
      ('administrador_agencia', 'agency.requests.edit'),
      ('administrador_agencia', 'agency.account.view'),
      ('administrador_agencia', 'agency.customer_finance.view'),
      ('administrador_agencia', 'agency.customer_finance.collect'),
      ('vendedor_agencia', 'agency.view'),
      ('vendedor_agencia', 'agency.pricing.view'),
      ('vendedor_agencia', 'agency.sales.view'),
      ('vendedor_agencia', 'agency.sales.create'),
      ('vendedor_agencia', 'agency.customers.manage'),
      ('vendedor_agencia', 'agency.requests.view'),
      ('vendedor_agencia', 'agency.customer_finance.view')
  )
  insert into public.role_permissions (role_id, permission_id, granted)
  select role.id, permission.id, true
  from public.roles role
  join template_permissions template on template.role_slug = role.slug
  join public.permissions permission on permission.key = template.permission_key
  where role.organization_id = organization.id
  on conflict (role_id, permission_id) do update set granted = true;

  insert into public.agency_captor_assignments (
    tenant_id, agency_id, captor_membership_id, assigned_by_membership_id, reason
  ) values (
    matrix_organization.tenant_id,
    agency_id_value,
    captor_membership.id,
    captor_membership.id,
    'Captada al crear agencia'
  );

  return agency_id_value;
end;
$$;

grant execute on function public.initialize_captor_agency_organization(uuid, uuid, uuid, uuid) to service_role;
revoke all on function public.enforce_agency_demo_team_limit() from public;
