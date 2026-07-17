-- Demo subscription limit: each captor may keep only a bounded active agency portfolio.
-- The tenant column is the subscription hook for future plans.

alter table public.business_tenants
  add column if not exists max_agencies_per_captor integer not null default 3
  check (max_agencies_per_captor between 0 and 1000);

create or replace function public.enforce_captor_agency_portfolio_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed_agencies integer;
  active_agencies integer;
begin
  if new.ended_at is not null then
    return new;
  end if;

  select tenant.max_agencies_per_captor
    into allowed_agencies
  from public.business_tenants tenant
  where tenant.id = new.tenant_id
  for share;

  if allowed_agencies is null then
    raise exception 'CAPTOR_AGENCY_LIMIT_CONFIG_MISSING';
  end if;

  -- Serialize changes to one captor portfolio so simultaneous assignments
  -- cannot both pass the count before either row is committed.
  perform pg_advisory_xact_lock(
    hashtextextended(new.tenant_id::text || ':' || new.captor_membership_id::text, 0)
  );

  select count(*)
    into active_agencies
  from public.agency_captor_assignments assignment
  join public.agencies agency
    on agency.id = assignment.agency_id
   and agency.tenant_id = assignment.tenant_id
  where assignment.tenant_id = new.tenant_id
    and assignment.captor_membership_id = new.captor_membership_id
    and assignment.ended_at is null
    and agency.archived_at is null
    and assignment.id is distinct from new.id;

  if active_agencies >= allowed_agencies then
    raise exception 'CAPTOR_AGENCY_LIMIT_REACHED'
      using errcode = 'check_violation',
        detail = format(
          'El captador ya tiene %s de %s agencias activas permitidas en este plan.',
          active_agencies,
          allowed_agencies
        );
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_captor_agency_portfolio_limit on public.agency_captor_assignments;
create trigger enforce_captor_agency_portfolio_limit
  before insert or update of tenant_id, captor_membership_id, ended_at
  on public.agency_captor_assignments
  for each row
  execute function public.enforce_captor_agency_portfolio_limit();

-- Captors may open agencies in their own portfolio. The database limit above
-- is still enforced no matter which future creation surface is used.
insert into public.role_permissions (role_id, permission_id, granted)
select role.id, permission.id, true
from public.roles role
join public.organizations organization on organization.id = role.organization_id
join public.permissions permission on permission.key = 'agency.create'
where role.slug = 'captador_agencias'
  and organization.organization_type = 'matrix'
on conflict (role_id, permission_id) do update set granted = true;

revoke all on function public.enforce_captor_agency_portfolio_limit() from public;
