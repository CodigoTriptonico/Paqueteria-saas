-- Boxario business tenancy and agency hierarchy.
--
-- Boxario remains the platform (organizations.kind = 'platform', no tenant).
-- Every client business belongs to one tenant and is either its matrix or an
-- agency. Existing distribution_* tables remain available during migration.

-- ---------------------------------------------------------------------------
-- Tenant and organization scope
-- ---------------------------------------------------------------------------

create table if not exists public.business_tenants (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  status text not null default 'active'
    check (status in ('active', 'suspended', 'inactive', 'closed')),
  matrix_organization_id uuid,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'closed') = (archived_at is not null))
);

create unique index if not exists business_tenants_code_unique
  on public.business_tenants (lower(btrim(code)));

alter table public.organizations
  add column if not exists tenant_id uuid references public.business_tenants(id) on delete restrict,
  add column if not exists organization_type text
    check (organization_type is null or organization_type in ('matrix', 'agency')),
  add column if not exists organization_code text,
  add column if not exists organization_status text not null default 'active'
    check (organization_status in ('active', 'suspended', 'inactive', 'closed')),
  add column if not exists matrix_organization_id uuid references public.organizations(id) on delete restrict,
  add column if not exists archived_at timestamptz;

alter table public.profiles
  add column if not exists archived_at timestamptz;

-- A distributor organization cannot silently belong to two matrices. Such a
-- row would make the tenant assignment ambiguous and must be repaired first.
do $$
begin
  if exists (
    select 1
    from public.distribution_partners partner
    group by partner.distributor_organization_id
    having count(distinct partner.parent_organization_id) > 1
  ) then
    raise exception 'Una organizacion distribuidora pertenece a mas de una matriz';
  end if;

  if exists (
    select 1
    from public.distribution_partners child_partner
    join public.distribution_partners parent_partner
      on parent_partner.distributor_organization_id = child_partner.parent_organization_id
  ) then
    raise exception 'La matriz de una agencia no puede ser otra agencia';
  end if;
end;
$$;

-- Deterministic backfill: the tenant UUID equals its existing matrix UUID.
-- This is stable across restored databases and avoids name-based matching.
insert into public.business_tenants (
  id, code, name, status, matrix_organization_id, archived_at, created_at, updated_at
)
select
  organization.id,
  upper(coalesce(nullif(btrim(organization.slug), ''), 'TENANT-' || left(organization.id::text, 8))),
  organization.name,
  case when organization.is_active then 'active' else 'inactive' end,
  organization.id,
  null,
  organization.created_at,
  now()
from public.organizations organization
where organization.kind = 'client'
  and not exists (
    select 1
    from public.distribution_partners partner
    where partner.distributor_organization_id = organization.id
  )
on conflict (id) do update set
  name = excluded.name,
  matrix_organization_id = excluded.matrix_organization_id,
  updated_at = now();

update public.organizations organization
set
  tenant_id = organization.id,
  organization_type = 'matrix',
  organization_code = upper(coalesce(nullif(btrim(organization.slug), ''), 'M-' || left(organization.id::text, 8))),
  organization_status = case when organization.is_active then 'active' else 'inactive' end,
  matrix_organization_id = organization.id
where organization.kind = 'client'
  and not exists (
    select 1
    from public.distribution_partners partner
    where partner.distributor_organization_id = organization.id
  );

update public.organizations agency_organization
set
  tenant_id = matrix_organization.tenant_id,
  organization_type = 'agency',
  organization_code = upper(coalesce(nullif(btrim(agency_organization.slug), ''), 'A-' || left(agency_organization.id::text, 8))),
  organization_status = case when partner.is_active and agency_organization.is_active then 'active' else 'inactive' end,
  matrix_organization_id = partner.parent_organization_id
from public.distribution_partners partner
join public.organizations matrix_organization
  on matrix_organization.id = partner.parent_organization_id
where agency_organization.id = partner.distributor_organization_id;

-- Platform organizations stay explicitly outside business tenants.
update public.organizations
set
  tenant_id = null,
  organization_type = null,
  organization_code = null,
  matrix_organization_id = null,
  organization_status = case when is_active then 'active' else 'inactive' end
where kind = 'platform';

create unique index if not exists organizations_tenant_id_id_unique
  on public.organizations (tenant_id, id);
create unique index if not exists organizations_tenant_code_unique
  on public.organizations (tenant_id, lower(btrim(organization_code)))
  where tenant_id is not null and organization_code is not null;
create index if not exists organizations_tenant_type_status_idx
  on public.organizations (tenant_id, organization_type, organization_status)
  where tenant_id is not null;

alter table public.organizations
  drop constraint if exists organizations_matrix_same_tenant_fkey;
alter table public.organizations
  add constraint organizations_matrix_same_tenant_fkey
  foreign key (tenant_id, matrix_organization_id)
  references public.organizations (tenant_id, id)
  on delete restrict
  deferrable initially deferred
  not valid;
alter table public.organizations
  validate constraint organizations_matrix_same_tenant_fkey;

alter table public.organizations
  drop constraint if exists organizations_business_scope_complete_check;
alter table public.organizations
  add constraint organizations_business_scope_complete_check check (
    (
      tenant_id is null
      and organization_type is null
      and matrix_organization_id is null
    )
    or (
      tenant_id is not null
      and organization_type is not null
      and organization_code is not null
      and matrix_organization_id is not null
      and (
        (organization_type = 'matrix' and matrix_organization_id = id)
        or (organization_type = 'agency' and matrix_organization_id <> id)
      )
    )
    and (tenant_id is null or kind = 'client')
  ) not valid;
alter table public.organizations
  validate constraint organizations_business_scope_complete_check;

alter table public.business_tenants
  drop constraint if exists business_tenants_matrix_organization_fkey;
alter table public.business_tenants
  add constraint business_tenants_matrix_organization_fkey
  foreign key (matrix_organization_id)
  references public.organizations(id)
  on delete restrict
  deferrable initially deferred
  not valid;
alter table public.business_tenants
  validate constraint business_tenants_matrix_organization_fkey;

create unique index if not exists business_tenants_id_matrix_unique
  on public.business_tenants(id, matrix_organization_id);

alter table public.business_tenants
  drop constraint if exists business_tenants_matrix_scope_fkey;
alter table public.business_tenants
  add constraint business_tenants_matrix_scope_fkey
  foreign key (id, matrix_organization_id)
  references public.organizations(tenant_id, id)
  on delete restrict
  deferrable initially deferred
  not valid;
alter table public.business_tenants
  validate constraint business_tenants_matrix_scope_fkey;

alter table public.organizations
  drop constraint if exists organizations_canonical_matrix_fkey;
alter table public.organizations
  add constraint organizations_canonical_matrix_fkey
  foreign key (tenant_id, matrix_organization_id)
  references public.business_tenants(id, matrix_organization_id)
  on delete restrict
  deferrable initially deferred
  not valid;
alter table public.organizations
  validate constraint organizations_canonical_matrix_fkey;

-- ---------------------------------------------------------------------------
-- One active business membership per identity
-- ---------------------------------------------------------------------------

create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  organization_id uuid not null,
  user_id uuid not null references auth.users(id) on delete restrict,
  role_id uuid references public.roles(id) on delete restrict,
  role_slug_snapshot text not null,
  role_name_snapshot text not null,
  access_scope text not null default 'organization'
    check (access_scope in ('tenant', 'organization', 'team', 'portfolio', 'assigned_resource')),
  status text not null default 'active'
    check (status in ('invited', 'active', 'suspended', 'ended')),
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, organization_id)
    references public.organizations(tenant_id, id) on delete restrict,
  check (valid_until is null or valid_until > valid_from),
  check (
    (status = 'ended' and ended_at is not null)
    or (status <> 'ended' and ended_at is null)
  )
);

create unique index if not exists organization_memberships_one_active_per_user
  on public.organization_memberships(user_id)
  where status = 'active' and ended_at is null;
create unique index if not exists organization_memberships_tenant_id_id_unique
  on public.organization_memberships(tenant_id, id);
create index if not exists organization_memberships_org_status_idx
  on public.organization_memberships(tenant_id, organization_id, status);

insert into public.organization_memberships (
  tenant_id,
  organization_id,
  user_id,
  role_id,
  role_slug_snapshot,
  role_name_snapshot,
  access_scope,
  status,
  valid_from,
  created_at,
  updated_at
)
select
  organization.tenant_id,
  profile.organization_id,
  profile.id,
  role.id,
  role.slug,
  role.name,
  case
    when role.slug = 'administrador' and organization.organization_type = 'matrix' then 'tenant'
    when role.slug = 'captador_distribuidores' then 'portfolio'
    when role.slug = 'conductor' then 'assigned_resource'
    else 'organization'
  end,
  case when profile.is_active and profile.archived_at is null then 'active' else 'suspended' end,
  profile.created_at,
  profile.created_at,
  now()
from public.profiles profile
join public.organizations organization on organization.id = profile.organization_id
join public.roles role on role.id = profile.role_id
where organization.tenant_id is not null
  and not exists (
    select 1
    from public.organization_memberships membership
    where membership.user_id = profile.id
  );

-- ---------------------------------------------------------------------------
-- Agencies and historical responsibility
-- ---------------------------------------------------------------------------

create table if not exists public.agencies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  matrix_organization_id uuid not null,
  organization_id uuid not null unique,
  legacy_distribution_partner_id uuid unique references public.distribution_partners(id) on delete restrict,
  code text not null,
  status text not null default 'prospect' check (status in (
    'prospect',
    'registration_started',
    'documents_pending',
    'approval_pending',
    'activation_pending',
    'active',
    'temporarily_suspended',
    'debt_blocked',
    'inactive',
    'closed',
    'rejected'
  )),
  status_version integer not null default 1 check (status_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  foreign key (tenant_id, matrix_organization_id)
    references public.organizations(tenant_id, id) on delete restrict,
  foreign key (tenant_id, matrix_organization_id)
    references public.business_tenants(id, matrix_organization_id) on delete restrict,
  foreign key (tenant_id, organization_id)
    references public.organizations(tenant_id, id) on delete restrict,
  check (matrix_organization_id <> organization_id),
  check ((status = 'closed') = (archived_at is not null))
);

create unique index if not exists agencies_tenant_code_unique
  on public.agencies(tenant_id, lower(btrim(code)));
create unique index if not exists agencies_tenant_id_id_unique
  on public.agencies(tenant_id, id);
create index if not exists agencies_matrix_status_idx
  on public.agencies(tenant_id, matrix_organization_id, status, created_at desc);

insert into public.agencies (
  id,
  tenant_id,
  matrix_organization_id,
  organization_id,
  legacy_distribution_partner_id,
  code,
  status,
  status_version,
  created_at,
  updated_at
)
select
  partner.id,
  matrix_organization.tenant_id,
  partner.parent_organization_id,
  partner.distributor_organization_id,
  partner.id,
  agency_organization.organization_code,
  case when partner.is_active and agency_organization.is_active then 'active' else 'inactive' end,
  1,
  partner.created_at,
  now()
from public.distribution_partners partner
join public.organizations matrix_organization on matrix_organization.id = partner.parent_organization_id
join public.organizations agency_organization on agency_organization.id = partner.distributor_organization_id
where matrix_organization.tenant_id is not null
on conflict (id) do update set
  tenant_id = excluded.tenant_id,
  matrix_organization_id = excluded.matrix_organization_id,
  organization_id = excluded.organization_id,
  legacy_distribution_partner_id = excluded.legacy_distribution_partner_id,
  code = excluded.code,
  updated_at = now();

create table if not exists public.agency_status_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  agency_id uuid not null,
  previous_status text,
  status text not null,
  version integer not null check (version > 0),
  actor_membership_id uuid,
  reason text not null,
  occurred_at timestamptz not null default now(),
  foreign key (tenant_id, agency_id)
    references public.agencies(tenant_id, id) on delete restrict,
  foreign key (tenant_id, actor_membership_id)
    references public.organization_memberships(tenant_id, id) on delete restrict,
  unique (agency_id, version)
);

insert into public.agency_status_history (
  tenant_id, agency_id, previous_status, status, version, actor_membership_id, reason, occurred_at
)
select
  agency.tenant_id,
  agency.id,
  null,
  agency.status,
  agency.status_version,
  null,
  'Migracion inicial desde distribution_partners',
  agency.created_at
from public.agencies agency
on conflict (agency_id, version) do nothing;

create table if not exists public.agency_captor_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  agency_id uuid not null,
  captor_membership_id uuid not null,
  assigned_by_membership_id uuid,
  reason text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, agency_id)
    references public.agencies(tenant_id, id) on delete restrict,
  foreign key (tenant_id, captor_membership_id)
    references public.organization_memberships(tenant_id, id) on delete restrict,
  foreign key (tenant_id, assigned_by_membership_id)
    references public.organization_memberships(tenant_id, id) on delete restrict,
  check (ended_at is null or ended_at > started_at)
);

create unique index if not exists agency_captor_assignments_one_active
  on public.agency_captor_assignments(agency_id)
  where ended_at is null;
create index if not exists agency_captor_assignments_captor_history_idx
  on public.agency_captor_assignments(tenant_id, captor_membership_id, started_at desc);

insert into public.agency_captor_assignments (
  tenant_id, agency_id, captor_membership_id, assigned_by_membership_id, reason, started_at, created_at
)
select
  agency.tenant_id,
  agency.id,
  membership.id,
  null,
  'Migracion inicial desde acquisition_owner_id',
  coalesce(partner.created_at, now()),
  coalesce(partner.created_at, now())
from public.agencies agency
join public.distribution_partners partner on partner.id = agency.legacy_distribution_partner_id
join public.organization_memberships membership
  on membership.user_id = partner.acquisition_owner_id
  and membership.tenant_id = agency.tenant_id
  and membership.status = 'active'
where partner.acquisition_owner_id is not null
on conflict (agency_id) where ended_at is null do nothing;

create table if not exists public.captor_supervisor_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  captor_membership_id uuid not null,
  supervisor_membership_id uuid not null,
  assigned_by_membership_id uuid,
  reason text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, captor_membership_id)
    references public.organization_memberships(tenant_id, id) on delete restrict,
  foreign key (tenant_id, supervisor_membership_id)
    references public.organization_memberships(tenant_id, id) on delete restrict,
  foreign key (tenant_id, assigned_by_membership_id)
    references public.organization_memberships(tenant_id, id) on delete restrict,
  check (captor_membership_id <> supervisor_membership_id),
  check (ended_at is null or ended_at > started_at)
);

create unique index if not exists captor_supervisor_assignments_one_active
  on public.captor_supervisor_assignments(captor_membership_id)
  where ended_at is null;
create index if not exists captor_supervisor_assignments_supervisor_history_idx
  on public.captor_supervisor_assignments(tenant_id, supervisor_membership_id, started_at desc);

create table if not exists public.agency_support_delegations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  agency_id uuid not null,
  delegate_membership_id uuid not null,
  granted_by_membership_id uuid not null,
  permissions text[] not null default '{}'::text[],
  reason text not null,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, agency_id)
    references public.agencies(tenant_id, id) on delete restrict,
  foreign key (tenant_id, delegate_membership_id)
    references public.organization_memberships(tenant_id, id) on delete restrict,
  foreign key (tenant_id, granted_by_membership_id)
    references public.organization_memberships(tenant_id, id) on delete restrict,
  check (cardinality(permissions) > 0),
  check (valid_until is null or valid_until > valid_from),
  check (revoked_at is null or revoked_at >= valid_from)
);

create unique index if not exists agency_support_delegations_one_active
  on public.agency_support_delegations(agency_id, delegate_membership_id)
  where revoked_at is null;

-- ---------------------------------------------------------------------------
-- Immutable audit and idempotency registry
-- ---------------------------------------------------------------------------

create table if not exists public.immutable_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.business_tenants(id) on delete restrict,
  organization_id uuid references public.organizations(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete restrict,
  actor_membership_id uuid references public.organization_memberships(id) on delete restrict,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_state jsonb,
  after_state jsonb,
  reason text not null default '',
  request_id text,
  idempotency_key text,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  check (
    (tenant_id is null and organization_id is null and actor_membership_id is null)
    or tenant_id is not null
  )
);

alter table public.immutable_audit_events
  drop constraint if exists immutable_audit_events_tenant_organization_fkey;
alter table public.immutable_audit_events
  add constraint immutable_audit_events_tenant_organization_fkey
  foreign key (tenant_id, organization_id)
  references public.organizations(tenant_id, id)
  on delete restrict;

alter table public.immutable_audit_events
  drop constraint if exists immutable_audit_events_tenant_actor_membership_fkey;
alter table public.immutable_audit_events
  add constraint immutable_audit_events_tenant_actor_membership_fkey
  foreign key (tenant_id, actor_membership_id)
  references public.organization_memberships(tenant_id, id)
  on delete restrict;

create index if not exists immutable_audit_events_tenant_time_idx
  on public.immutable_audit_events(tenant_id, occurred_at desc);
create index if not exists immutable_audit_events_entity_idx
  on public.immutable_audit_events(tenant_id, entity_type, entity_id, occurred_at desc);
create index if not exists immutable_audit_events_request_idx
  on public.immutable_audit_events(request_id)
  where request_id is not null;

create table if not exists public.idempotency_operations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  operation_type text not null,
  idempotency_key text not null,
  actor_membership_id uuid references public.organization_memberships(id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending', 'executing', 'completed', 'failed')),
  result jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (tenant_id, operation_type, idempotency_key),
  check (
    (status in ('pending', 'executing') and completed_at is null and result is null and error_code is null)
    or (status = 'completed' and completed_at is not null and result is not null and error_code is null)
    or (status = 'failed' and completed_at is not null and error_code is not null)
  )
);

alter table public.idempotency_operations
  drop constraint if exists idempotency_operations_tenant_actor_membership_fkey;
alter table public.idempotency_operations
  add constraint idempotency_operations_tenant_actor_membership_fkey
  foreign key (tenant_id, actor_membership_id)
  references public.organization_memberships(tenant_id, id)
  on delete restrict;

create index if not exists idempotency_operations_actor_time_idx
  on public.idempotency_operations(tenant_id, actor_membership_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Granular permission vocabulary
-- ---------------------------------------------------------------------------

insert into public.permissions (key, name, description) values
  ('agency.view', 'Ver agencias', 'Consultar agencias dentro del alcance autorizado'),
  ('agency.create', 'Crear agencias', 'Crear organizaciones de tipo agencia'),
  ('agency.edit', 'Editar agencias', 'Editar datos no financieros de una agencia'),
  ('agency.status.transition', 'Cambiar estado de agencia', 'Ejecutar transiciones auditadas del ciclo de agencia'),
  ('agency.captor.assign', 'Asignar captador', 'Asignar o reasignar el captador responsable'),
  ('agency.supervisor.assign', 'Asignar supervisor', 'Asignar o reasignar el supervisor de un captador'),
  ('agency.support', 'Dar soporte a agencias', 'Atender agencias dentro de la cartera o delegacion'),
  ('agency.users.view', 'Ver empleados de agencia', 'Consultar membresias de la agencia'),
  ('agency.users.manage', 'Gestionar empleados de agencia', 'Invitar, desactivar y cambiar roles de agencia'),
  ('agency.pricing.view', 'Ver precios de agencia', 'Consultar tarifas internas y listas publicas autorizadas'),
  ('agency.pricing.manage', 'Gestionar precios de agencia', 'Versionar tarifas o listas publicas autorizadas'),
  ('agency.sales.view', 'Ver ventas de agencia', 'Consultar ventas minoristas de agencia'),
  ('agency.sales.create', 'Crear ventas de agencia', 'Registrar ventas minoristas de agencia'),
  ('agency.customers.manage', 'Gestionar clientes de agencia', 'Crear y editar clientes de agencia'),
  ('agency.requests.view', 'Ver solicitudes de agencia', 'Consultar solicitudes y visitas'),
  ('agency.requests.create', 'Crear solicitudes de agencia', 'Solicitar cajas, recolecciones y entregas'),
  ('agency.requests.edit', 'Editar solicitudes de agencia', 'Editar solicitudes antes de confirmarlas'),
  ('agency.requests.assign', 'Asignar solicitudes de agencia', 'Programar y asignar solicitudes a rutas'),
  ('agency.visits.confirm', 'Confirmar visitas de agencia', 'Confirmar cantidades y evidencia de una visita'),
  ('agency.account.view', 'Ver cuenta con la matriz', 'Consultar cargos, pagos y saldo agencia a matriz'),
  ('agency.account.charge', 'Crear cargos de agencia', 'Registrar cargos internos por conceptos separados'),
  ('agency.account.payment', 'Registrar pagos de agencia', 'Registrar pagos recibidos de una agencia'),
  ('agency.account.apply', 'Aplicar pagos de agencia', 'Aplicar pagos a cargos internos'),
  ('agency.customer_finance.view', 'Ver cartera de clientes de agencia', 'Consultar facturas y pagos propios de la agencia'),
  ('agency.customer_finance.collect', 'Cobrar clientes de agencia', 'Registrar y aplicar pagos de clientes de agencia'),
  ('accounting.view', 'Ver contabilidad', 'Consultar libro mayor y submayores autorizados'),
  ('accounting.post', 'Registrar asientos', 'Registrar eventos financieros con asiento balanceado'),
  ('accounting.reconcile', 'Conciliar fondos', 'Conciliar pagos y liquidaciones de conductor'),
  ('accounting.reverse', 'Revertir eventos financieros', 'Crear reversos enlazados sin editar historia'),
  ('financial_hold.view', 'Ver retenciones', 'Consultar retenciones financieras vinculadas a operaciones'),
  ('financial_hold.release', 'Liberar retenciones automaticamente', 'Autorizar salida cuando el saldo vinculado es cero'),
  ('financial_hold.release_manual', 'Liberar retenciones manualmente', 'Liberar con motivo, evidencia y auditoria especial'),
  ('audit.immutable.view', 'Ver auditoria inmutable', 'Consultar el registro inmutable dentro del alcance autorizado')
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description;

-- Existing captor roles retain their narrow portfolio responsibilities.
insert into public.role_permissions (role_id, permission_id, granted)
select role.id, permission.id, true
from public.roles role
join public.permissions permission on permission.key in (
  'agency.view',
  'agency.support',
  'agency.requests.view'
)
where role.slug = 'captador_distribuidores'
on conflict (role_id, permission_id) do update set granted = true;

-- Existing agency distributor roles receive only their own organization sales,
-- customer, request, price and account-read capabilities.
insert into public.role_permissions (role_id, permission_id, granted)
select role.id, permission.id, true
from public.roles role
join public.organizations organization on organization.id = role.organization_id
join public.permissions permission on permission.key in (
  'agency.view',
  'agency.pricing.view',
  'agency.pricing.manage',
  'agency.sales.view',
  'agency.sales.create',
  'agency.customers.manage',
  'agency.requests.view',
  'agency.requests.create',
  'agency.requests.edit',
  'agency.account.view',
  'agency.customer_finance.view',
  'agency.customer_finance.collect'
)
where role.slug = 'distribuidor'
  and organization.organization_type = 'agency'
on conflict (role_id, permission_id) do update set granted = true;

-- ---------------------------------------------------------------------------
-- Session-derived scope helpers
-- ---------------------------------------------------------------------------

create or replace function public.current_membership_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select membership.id
  from public.organization_memberships membership
  where membership.user_id = auth.uid()
    and membership.status = 'active'
    and membership.ended_at is null
    and membership.valid_from <= now()
    and (membership.valid_until is null or membership.valid_until > now())
  limit 1;
$$;

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select membership.tenant_id
  from public.organization_memberships membership
  where membership.id = public.current_membership_id();
$$;

create or replace function public.current_business_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select membership.organization_id
  from public.organization_memberships membership
  where membership.id = public.current_membership_id();
$$;

create or replace function public.tenant_organization_access(
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
begin
  if public.is_platform_admin() then
    return true;
  end if;

  select current_membership.* into membership
  from public.organization_memberships current_membership
  where current_membership.id = public.current_membership_id();

  if membership.id is null
     or membership.tenant_id is distinct from target_tenant_id then
    return false;
  end if;

  if membership.access_scope = 'tenant'
     or membership.organization_id = target_organization_id then
    return true;
  end if;

  -- Captor portfolio.
  if exists (
    select 1
    from public.agency_captor_assignments assignment
    join public.agencies agency on agency.id = assignment.agency_id
    where assignment.tenant_id = target_tenant_id
      and assignment.captor_membership_id = membership.id
      and assignment.ended_at is null
      and agency.organization_id = target_organization_id
  ) then
    return true;
  end if;

  -- Supervisor inherits the active portfolios of currently assigned captors.
  if exists (
    select 1
    from public.captor_supervisor_assignments supervision
    join public.agency_captor_assignments assignment
      on assignment.captor_membership_id = supervision.captor_membership_id
     and assignment.tenant_id = supervision.tenant_id
     and assignment.ended_at is null
    join public.agencies agency on agency.id = assignment.agency_id
    where supervision.tenant_id = target_tenant_id
      and supervision.supervisor_membership_id = membership.id
      and supervision.ended_at is null
      and agency.organization_id = target_organization_id
  ) then
    return true;
  end if;

  -- Explicit support is time-bound and never changes organization membership.
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
  );
end;
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

grant execute on function public.current_membership_id() to authenticated, service_role;
grant execute on function public.current_tenant_id() to authenticated, service_role;
grant execute on function public.current_business_organization_id() to authenticated, service_role;
grant execute on function public.tenant_organization_access(uuid, uuid) to authenticated, service_role;
grant execute on function public.current_membership_has_permission(text, uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Tenant + organization RLS
-- ---------------------------------------------------------------------------

alter table public.business_tenants enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.agencies enable row level security;
alter table public.agency_status_history enable row level security;
alter table public.agency_captor_assignments enable row level security;
alter table public.captor_supervisor_assignments enable row level security;
alter table public.agency_support_delegations enable row level security;
alter table public.immutable_audit_events enable row level security;
alter table public.idempotency_operations enable row level security;

drop policy if exists business_tenants_scoped_select on public.business_tenants;
create policy business_tenants_scoped_select on public.business_tenants
  for select to authenticated
  using (public.is_platform_admin() or id = public.current_tenant_id());

drop policy if exists organization_memberships_scoped_select on public.organization_memberships;
create policy organization_memberships_scoped_select on public.organization_memberships
  for select to authenticated
  using (
    public.is_platform_admin()
    or user_id = auth.uid()
    or public.current_membership_has_permission('agency.users.view', tenant_id, organization_id)
  );

drop policy if exists organization_memberships_deny_direct_write on public.organization_memberships;
create policy organization_memberships_deny_direct_write on public.organization_memberships
  for all to authenticated
  using (false)
  with check (false);

drop policy if exists agencies_scoped_select on public.agencies;
create policy agencies_scoped_select on public.agencies
  for select to authenticated
  using (
    public.current_membership_has_permission('agency.view', tenant_id, organization_id)
  );

drop policy if exists agencies_deny_direct_write on public.agencies;
create policy agencies_deny_direct_write on public.agencies
  for all to authenticated
  using (false)
  with check (false);

drop policy if exists agency_status_history_scoped_select on public.agency_status_history;
create policy agency_status_history_scoped_select on public.agency_status_history
  for select to authenticated
  using (
    exists (
      select 1
      from public.agencies agency
      where agency.id = agency_status_history.agency_id
        and agency.tenant_id = agency_status_history.tenant_id
        and public.current_membership_has_permission(
          'agency.view',
          agency_status_history.tenant_id,
          agency.organization_id
        )
    )
  );

drop policy if exists agency_status_history_deny_direct_write on public.agency_status_history;
create policy agency_status_history_deny_direct_write on public.agency_status_history
  for all to authenticated
  using (false)
  with check (false);

drop policy if exists agency_captor_assignments_scoped_select on public.agency_captor_assignments;
create policy agency_captor_assignments_scoped_select on public.agency_captor_assignments
  for select to authenticated
  using (
    exists (
      select 1
      from public.agencies agency
      where agency.id = agency_captor_assignments.agency_id
        and agency.tenant_id = agency_captor_assignments.tenant_id
        and public.current_membership_has_permission(
          'agency.view',
          agency_captor_assignments.tenant_id,
          agency.organization_id
        )
    )
  );

drop policy if exists agency_captor_assignments_deny_direct_write on public.agency_captor_assignments;
create policy agency_captor_assignments_deny_direct_write on public.agency_captor_assignments
  for all to authenticated
  using (false)
  with check (false);

drop policy if exists captor_supervisor_assignments_scoped_select on public.captor_supervisor_assignments;
create policy captor_supervisor_assignments_scoped_select on public.captor_supervisor_assignments
  for select to authenticated
  using (
    public.is_platform_admin()
    or (
      tenant_id = public.current_tenant_id()
      and (
        captor_membership_id = public.current_membership_id()
        or supervisor_membership_id = public.current_membership_id()
        or public.current_membership_has_permission(
          'agency.supervisor.assign',
          tenant_id,
          public.current_business_organization_id()
        )
      )
    )
  );

drop policy if exists captor_supervisor_assignments_deny_direct_write on public.captor_supervisor_assignments;
create policy captor_supervisor_assignments_deny_direct_write on public.captor_supervisor_assignments
  for all to authenticated
  using (false)
  with check (false);

drop policy if exists agency_support_delegations_scoped_select on public.agency_support_delegations;
create policy agency_support_delegations_scoped_select on public.agency_support_delegations
  for select to authenticated
  using (
    delegate_membership_id = public.current_membership_id()
    or exists (
      select 1
      from public.agencies agency
      where agency.id = agency_support_delegations.agency_id
        and agency.tenant_id = agency_support_delegations.tenant_id
        and public.current_membership_has_permission(
          'agency.support',
          agency_support_delegations.tenant_id,
          agency.organization_id
        )
    )
  );

drop policy if exists agency_support_delegations_deny_direct_write on public.agency_support_delegations;
create policy agency_support_delegations_deny_direct_write on public.agency_support_delegations
  for all to authenticated
  using (false)
  with check (false);

drop policy if exists immutable_audit_events_scoped_select on public.immutable_audit_events;
create policy immutable_audit_events_scoped_select on public.immutable_audit_events
  for select to authenticated
  using (
    public.is_platform_admin()
    or (
      tenant_id = public.current_tenant_id()
      and public.current_membership_has_permission(
        'audit.immutable.view',
        tenant_id,
        coalesce(organization_id, public.current_business_organization_id())
      )
    )
  );

drop policy if exists immutable_audit_events_deny_direct_write on public.immutable_audit_events;
create policy immutable_audit_events_deny_direct_write on public.immutable_audit_events
  for all to authenticated
  using (false)
  with check (false);

drop policy if exists idempotency_operations_deny_direct on public.idempotency_operations;
create policy idempotency_operations_deny_direct on public.idempotency_operations
  for all to authenticated
  using (false)
  with check (false);

-- Matrix members with tenant scope can discover their agencies. The original
-- organization policies remain in place for same-organization compatibility.
drop policy if exists organizations_business_scope_select on public.organizations;
create policy organizations_business_scope_select on public.organizations
  for select to authenticated
  using (
    tenant_id is not null
    and (
      id = public.current_business_organization_id()
      or public.current_membership_has_permission('agency.view', tenant_id, id)
    )
  );

-- ---------------------------------------------------------------------------
-- No hard deletion and immutable event history
-- ---------------------------------------------------------------------------

create or replace function public.prevent_business_record_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'HARD_DELETE_FORBIDDEN: desactive o cierre el registro y conserve su historia';
end;
$$;

create or replace function public.prevent_immutable_audit_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'IMMUTABLE_AUDIT_EVENT';
end;
$$;

create or replace function public.prevent_profile_with_membership_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.organization_memberships membership
    where membership.user_id = old.id
  ) then
    raise exception 'HARD_DELETE_FORBIDDEN: desactive la membresia y el perfil';
  end if;
  return old;
end;
$$;

drop trigger if exists prevent_business_tenant_delete on public.business_tenants;
create trigger prevent_business_tenant_delete
  before delete on public.business_tenants
  for each row execute function public.prevent_business_record_delete();

drop trigger if exists prevent_scoped_organization_delete on public.organizations;
create trigger prevent_scoped_organization_delete
  before delete on public.organizations
  for each row
  when (old.tenant_id is not null)
  execute function public.prevent_business_record_delete();

drop trigger if exists prevent_profile_membership_delete on public.profiles;
create trigger prevent_profile_membership_delete
  before delete on public.profiles
  for each row execute function public.prevent_profile_with_membership_delete();

drop trigger if exists prevent_organization_membership_delete on public.organization_memberships;
create trigger prevent_organization_membership_delete
  before delete on public.organization_memberships
  for each row execute function public.prevent_business_record_delete();

drop trigger if exists prevent_agency_delete on public.agencies;
create trigger prevent_agency_delete
  before delete on public.agencies
  for each row execute function public.prevent_business_record_delete();

drop trigger if exists prevent_agency_status_history_change on public.agency_status_history;
create trigger prevent_agency_status_history_change
  before update or delete on public.agency_status_history
  for each row execute function public.prevent_immutable_audit_change();

drop trigger if exists prevent_agency_captor_assignment_delete on public.agency_captor_assignments;
create trigger prevent_agency_captor_assignment_delete
  before delete on public.agency_captor_assignments
  for each row execute function public.prevent_business_record_delete();

drop trigger if exists prevent_captor_supervisor_assignment_delete on public.captor_supervisor_assignments;
create trigger prevent_captor_supervisor_assignment_delete
  before delete on public.captor_supervisor_assignments
  for each row execute function public.prevent_business_record_delete();

drop trigger if exists prevent_agency_support_delegation_delete on public.agency_support_delegations;
create trigger prevent_agency_support_delegation_delete
  before delete on public.agency_support_delegations
  for each row execute function public.prevent_business_record_delete();

drop trigger if exists prevent_immutable_audit_event_change on public.immutable_audit_events;
create trigger prevent_immutable_audit_event_change
  before update or delete on public.immutable_audit_events
  for each row execute function public.prevent_immutable_audit_change();

drop trigger if exists prevent_idempotency_operation_delete on public.idempotency_operations;
create trigger prevent_idempotency_operation_delete
  before delete on public.idempotency_operations
  for each row execute function public.prevent_business_record_delete();

comment on table public.business_tenants is
  'Empresas cliente aisladas de Boxario. Boxario permanece fuera de esta tabla.';
comment on table public.organization_memberships is
  'Membresia empresarial historica. Solo una puede estar activa por identidad.';
comment on table public.agencies is
  'Organizacion agencia dentro del tenant de su matriz; distribution_* es compatibilidad temporal.';
comment on table public.immutable_audit_events is
  'Registro append-only de acciones criticas de plataforma y negocio.';
comment on table public.idempotency_operations is
  'Resultado durable por tenant, tipo de operacion y clave de idempotencia.';
