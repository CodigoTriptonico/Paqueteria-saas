-- Security foundation: restrictive defaults, closed internal RPCs, RLS coverage,
-- and immutable profile authorization fields.

-- New objects must be private until a migration grants the minimum privilege.
alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

do $$
begin
  begin
    execute 'alter default privileges for role supabase_admin in schema public revoke all on tables from public, anon, authenticated';
    execute 'alter default privileges for role supabase_admin in schema public revoke all on sequences from public, anon, authenticated';
    execute 'alter default privileges for role supabase_admin in schema public revoke execute on functions from public, anon, authenticated';
  exception
    when insufficient_privilege then
      raise notice 'supabase_admin default privileges require the managed Supabase superuser';
  end;
end;
$$;

-- Boxario has no anonymous PostgREST database surface. Public tracking is a
-- server route that uses a scoped service operation.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from public, anon;

-- Bootstrap and platform administration are server-only.
revoke execute on function public.grant_platform_admin(uuid)
  from public, anon, authenticated;
revoke execute on function public.bootstrap_organization(text, uuid, text, text)
  from public, anon, authenticated;
revoke execute on function public.bootstrap_organization(text, uuid, text, text, text)
  from public, anon, authenticated;
revoke execute on function public.bootstrap_organization(text, uuid, text, text, text, text, text)
  from public, anon, authenticated;
revoke execute on function public.initialize_business_matrix_organization(uuid)
  from public, anon, authenticated;
revoke execute on function public.initialize_captor_agency_organization(uuid, uuid, uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.grant_platform_admin(uuid) to service_role;
grant execute on function public.bootstrap_organization(text, uuid, text, text) to service_role;
grant execute on function public.bootstrap_organization(text, uuid, text, text, text) to service_role;
grant execute on function public.bootstrap_organization(text, uuid, text, text, text, text, text) to service_role;
grant execute on function public.initialize_business_matrix_organization(uuid) to service_role;
grant execute on function public.initialize_captor_agency_organization(uuid, uuid, uuid, uuid) to service_role;

-- Package invoice lifecycle helpers are trigger/server internals. User-facing
-- commands must validate their own transition and cannot supply actor or time.
revoke execute on function public.record_shipment_package_invoice_event(
  uuid, text, timestamptz, uuid, text
) from public, anon, authenticated;
revoke execute on function public.record_shipment_package_invoice_state(
  uuid, text, timestamptz, uuid, text
) from public, anon, authenticated;
grant execute on function public.record_shipment_package_invoice_event(
  uuid, text, timestamptz, uuid, text
) to service_role;
grant execute on function public.record_shipment_package_invoice_state(
  uuid, text, timestamptz, uuid, text
) to service_role;

-- Every finance_* function is an internal helper or a policy helper. Business
-- RPCs remain explicitly granted to authenticated below.
do $$
declare
  target_function regprocedure;
begin
  for target_function in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'finance\_%' escape '\'
  loop
    execute format(
      'revoke execute on function %s from public, anon, authenticated',
      target_function
    );
    execute format(
      'grant execute on function %s to service_role',
      target_function
    );
  end loop;
end;
$$;

-- This read helper is used by RLS and validates the current membership.
grant execute on function public.finance_agency_account_visible(uuid, uuid, uuid)
  to authenticated;

-- Reassert the intended authenticated business boundary after restrictive ACLs.
grant execute on function public.create_agency_sale(jsonb, text) to authenticated;
grant execute on function public.record_agency_payment(jsonb, text) to authenticated;
grant execute on function public.record_customer_payment(jsonb, text) to authenticated;
grant execute on function public.reconcile_driver_settlement(jsonb, text) to authenticated;
grant execute on function public.reverse_financial_event(jsonb, text) to authenticated;
grant execute on function public.authorize_international_release(jsonb, text) to authenticated;

-- Tables created without RLS are closed to direct clients. Their existing
-- service-role/RPC consumers continue to work.
alter table public.agency_route_proposals enable row level security;
alter table public.driver_settlement_reversals enable row level security;
alter table public.warehouse_intake_counters enable row level security;

revoke all on table public.agency_route_proposals
  from public, anon, authenticated;
revoke all on table public.driver_settlement_reversals
  from public, anon, authenticated;
revoke all on table public.warehouse_intake_counters
  from public, anon, authenticated;

-- Self-service profile updates are row-scoped. Administrative changes are
-- separated and must target a role in the same organization.
drop policy if exists profiles_update on public.profiles;
drop policy if exists profiles_update_self on public.profiles;
drop policy if exists profiles_update_admin on public.profiles;

create policy profiles_update_self
on public.profiles
for update
to authenticated
using (
  id = auth.uid()
  and organization_id = public.current_organization_id()
)
with check (
  id = auth.uid()
  and organization_id = public.current_organization_id()
);

create policy profiles_update_admin
on public.profiles
for update
to authenticated
using (
  id <> auth.uid()
  and organization_id = public.current_organization_id()
  and (
    public.user_has_permission('users.manage')
    or public.user_has_permission('agency.users.manage')
  )
)
with check (
  id <> auth.uid()
  and organization_id = public.current_organization_id()
  and (
    public.user_has_permission('users.manage')
    or public.user_has_permission('agency.users.manage')
  )
  and exists (
    select 1
    from public.roles target_role
    where target_role.id = profiles.role_id
      and target_role.organization_id = profiles.organization_id
  )
);

create or replace function public.guard_profile_authorization_fields()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  caller_role text := coalesce(auth.role(), current_user);
  can_manage boolean := false;
begin
  if caller_role in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;

  if caller_id is null then
    raise exception 'PROFILE_UPDATE_FORBIDDEN';
  end if;

  if new.created_at is distinct from old.created_at then
    raise exception 'PROFILE_CREATED_AT_IMMUTABLE';
  end if;

  if new.organization_id is distinct from old.organization_id then
    raise exception 'PROFILE_ORGANIZATION_IMMUTABLE';
  end if;

  if caller_id = old.id then
    if new.role_id is distinct from old.role_id
      or new.is_active is distinct from old.is_active
      or new.email is distinct from old.email
    then
      raise exception 'PROFILE_SELF_AUTHORIZATION_FIELDS_FORBIDDEN';
    end if;
    return new;
  end if;

  can_manage :=
    public.user_has_permission('users.manage')
    or public.user_has_permission('agency.users.manage');
  if not can_manage or old.organization_id <> public.current_organization_id() then
    raise exception 'PROFILE_ADMIN_UPDATE_FORBIDDEN';
  end if;

  if not exists (
    select 1
    from public.roles target_role
    where target_role.id = new.role_id
      and target_role.organization_id = old.organization_id
  ) then
    raise exception 'PROFILE_ROLE_SCOPE_MISMATCH';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_profile_authorization_fields()
  from public, anon, authenticated;
grant execute on function public.guard_profile_authorization_fields()
  to service_role;

drop trigger if exists profiles_authorization_fields_guard on public.profiles;
create trigger profiles_authorization_fields_guard
before update on public.profiles
for each row execute function public.guard_profile_authorization_fields();

-- A request line always inherits the exact tenant and organization of its
-- parent. Qualifying the child columns avoids the former tautological policy.
create or replace function public.guard_agency_request_line_scope()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  parent_tenant_id uuid;
  parent_organization_id uuid;
  parent_status text;
begin
  select request.tenant_id, request.organization_id, request.status
    into parent_tenant_id, parent_organization_id, parent_status
  from public.agency_service_requests request
  where request.id = new.request_id;

  if parent_tenant_id is null then
    raise exception 'AGENCY_REQUEST_NOT_FOUND';
  end if;
  if new.tenant_id is distinct from parent_tenant_id
    or new.organization_id is distinct from parent_organization_id
  then
    raise exception 'AGENCY_REQUEST_LINE_SCOPE_MISMATCH';
  end if;
  if parent_status <> 'draft' then
    raise exception 'AGENCY_REQUEST_NOT_DRAFT';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_agency_request_line_scope()
  from public, anon, authenticated;
grant execute on function public.guard_agency_request_line_scope()
  to service_role;

drop trigger if exists agency_request_line_scope_guard
  on public.agency_service_request_lines;
create trigger agency_request_line_scope_guard
before insert or update of request_id, tenant_id, organization_id
on public.agency_service_request_lines
for each row execute function public.guard_agency_request_line_scope();

drop policy if exists agency_service_request_lines_insert
  on public.agency_service_request_lines;
create policy agency_service_request_lines_insert
on public.agency_service_request_lines
for insert
to authenticated
with check (
  agency_service_request_lines.tenant_id = public.current_tenant_id()
  and public.current_membership_has_permission(
    'agency.requests.create',
    agency_service_request_lines.tenant_id,
    agency_service_request_lines.organization_id
  )
  and exists (
    select 1
    from public.agency_service_requests parent_request
    where parent_request.id = agency_service_request_lines.request_id
      and parent_request.tenant_id = agency_service_request_lines.tenant_id
      and parent_request.organization_id = agency_service_request_lines.organization_id
      and parent_request.status = 'draft'
  )
);

drop policy if exists agency_service_request_lines_update
  on public.agency_service_request_lines;
create policy agency_service_request_lines_update
on public.agency_service_request_lines
for update
to authenticated
using (
  agency_service_request_lines.tenant_id = public.current_tenant_id()
  and public.current_membership_has_permission(
    'agency.requests.create',
    agency_service_request_lines.tenant_id,
    agency_service_request_lines.organization_id
  )
  and exists (
    select 1
    from public.agency_service_requests parent_request
    where parent_request.id = agency_service_request_lines.request_id
      and parent_request.tenant_id = agency_service_request_lines.tenant_id
      and parent_request.organization_id = agency_service_request_lines.organization_id
      and parent_request.status = 'draft'
  )
)
with check (
  agency_service_request_lines.tenant_id = public.current_tenant_id()
  and public.current_membership_has_permission(
    'agency.requests.create',
    agency_service_request_lines.tenant_id,
    agency_service_request_lines.organization_id
  )
  and exists (
    select 1
    from public.agency_service_requests parent_request
    where parent_request.id = agency_service_request_lines.request_id
      and parent_request.tenant_id = agency_service_request_lines.tenant_id
      and parent_request.organization_id = agency_service_request_lines.organization_id
      and parent_request.status = 'draft'
  )
);
