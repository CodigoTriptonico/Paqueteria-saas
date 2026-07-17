-- Boxario business integration: role templates, membership lifecycle,
-- platform-safe archival and one server-derived reporting contract.

-- ---------------------------------------------------------------------------
-- Role templates
-- ---------------------------------------------------------------------------

insert into public.roles (organization_id, slug, name, is_system)
select organization.id, template.slug, template.name, true
from public.organizations organization
cross join (values
  ('supervisor_agencias', 'Supervisor de agencias'),
  ('captador_agencias', 'Captador de agencias'),
  ('finanzas', 'Finanzas'),
  ('logistica', 'Logística'),
  ('bodega', 'Bodega'),
  ('auditor', 'Auditor')
) as template(slug, name)
where organization.organization_type = 'matrix'
on conflict (organization_id, slug) do update set name = excluded.name;

insert into public.roles (organization_id, slug, name, is_system)
select organization.id, template.slug, template.name, true
from public.organizations organization
cross join (values
  ('administrador_agencia', 'Administrador de agencia'),
  ('vendedor_agencia', 'Vendedor de agencia'),
  ('caja_agencia', 'Caja de agencia'),
  ('operador_agencia', 'Operador de agencia'),
  ('auditor', 'Auditor')
) as template(slug, name)
where organization.organization_type = 'agency'
on conflict (organization_id, slug) do update set name = excluded.name;

with template_permissions(role_slug, permission_key) as (
  values
    ('supervisor_agencias', 'agency.view'),
    ('supervisor_agencias', 'agency.captor.assign'),
    ('supervisor_agencias', 'agency.supervisor.assign'),
    ('supervisor_agencias', 'agency.support'),
    ('supervisor_agencias', 'agency.requests.view'),
    ('captador_agencias', 'agency.view'),
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
    ('auditor', 'audit.immutable.view'),
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
    ('vendedor_agencia', 'agency.customer_finance.view'),
    ('caja_agencia', 'agency.view'),
    ('caja_agencia', 'agency.sales.view'),
    ('caja_agencia', 'agency.account.view'),
    ('caja_agencia', 'agency.customer_finance.view'),
    ('caja_agencia', 'agency.customer_finance.collect'),
    ('operador_agencia', 'agency.view'),
    ('operador_agencia', 'agency.requests.view'),
    ('operador_agencia', 'agency.requests.create'),
    ('operador_agencia', 'agency.requests.edit')
)
insert into public.role_permissions (role_id, permission_id, granted)
select role.id, permission.id, true
from public.roles role
join template_permissions template on template.role_slug = role.slug
join public.permissions permission on permission.key = template.permission_key
join public.organizations organization on organization.id = role.organization_id
where organization.tenant_id is not null
on conflict (role_id, permission_id) do update set granted = true;

-- ---------------------------------------------------------------------------
-- Profile -> historical membership synchronization
-- ---------------------------------------------------------------------------

create or replace function public.sync_profile_business_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  organization public.organizations;
  role public.roles;
  membership_scope text;
begin
  if tg_op = 'UPDATE' and (
    old.organization_id is distinct from new.organization_id
    or old.role_id is distinct from new.role_id
    or (old.is_active and not new.is_active)
    or (old.archived_at is null and new.archived_at is not null)
  ) then
    update public.organization_memberships
    set status = 'ended', ended_at = now(), valid_until = coalesce(valid_until, now()), updated_at = now()
    where user_id = new.id and status = 'active' and ended_at is null;
  end if;

  select * into organization from public.organizations where id = new.organization_id;
  if organization.tenant_id is null or not new.is_active or new.archived_at is not null then
    return new;
  end if;

  select * into role from public.roles where id = new.role_id and organization_id = new.organization_id;
  if role.id is null then
    raise exception 'ROLE_ORGANIZATION_MISMATCH';
  end if;

  if exists (
    select 1 from public.organization_memberships membership
    where membership.user_id = new.id
      and membership.organization_id = new.organization_id
      and membership.role_id = new.role_id
      and membership.status = 'active'
      and membership.ended_at is null
  ) then
    return new;
  end if;

  membership_scope := case
    when role.slug in ('administrador', 'finanzas', 'logistica', 'auditor')
      and organization.organization_type = 'matrix' then 'tenant'
    when role.slug = 'supervisor_agencias' then 'team'
    when role.slug in ('captador_distribuidores', 'captador_agencias') then 'portfolio'
    when role.slug = 'conductor' then 'assigned_resource'
    else 'organization'
  end;

  insert into public.organization_memberships (
    tenant_id, organization_id, user_id, role_id, role_slug_snapshot,
    role_name_snapshot, access_scope, status, valid_from
  ) values (
    organization.tenant_id, new.organization_id, new.id, new.role_id, role.slug,
    role.name, membership_scope, 'active', now()
  );
  return new;
end;
$$;

drop trigger if exists sync_profile_business_membership_trigger on public.profiles;
create trigger sync_profile_business_membership_trigger
  after insert or update of organization_id, role_id, is_active, archived_at
  on public.profiles
  for each row execute function public.sync_profile_business_membership();

-- A sale line owns the commercial price; this bridge records only the
-- quantity-based box source after 072 exists. One shipment has one box source.
create or replace function public.sync_agency_sale_box_source()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sale public.sales;
  agency public.agencies;
  source_id uuid;
  inventory_item_id_value uuid := nullif(new.rate_snapshot->>'inventoryItemId', '')::uuid;
  product_key_value text := btrim(coalesce(new.rate_snapshot->>'productKey', new.rate_snapshot->>'productCode', ''));
  box_size_value text := btrim(coalesce(new.rate_snapshot->>'boxSize', ''));
begin
  if new.concept <> 'international_shipping' or new.box_source is null then return new; end if;
  select * into sale from public.sales where id = new.sale_id;
  if sale.sale_kind <> 'agency_retail' or sale.shipment_id is null then return new; end if;
  select * into agency from public.agencies
  where tenant_id = new.tenant_id and organization_id = new.organization_id;
  if agency.id is null then raise exception 'AGENCY_SCOPE_MISMATCH'; end if;
  if exists (select 1 from public.agency_shipment_box_sources where shipment_id = sale.shipment_id) then
    raise exception 'SHIPMENT_BOX_SOURCE_ALREADY_RECORDED';
  end if;
  if new.box_source = 'matrix_purchased' and (
    inventory_item_id_value is null or product_key_value = '' or box_size_value = ''
  ) then raise exception 'MATRIX_BOX_DETAILS_REQUIRED'; end if;

  insert into public.agency_shipment_box_sources (
    tenant_id, organization_id, agency_id, shipment_id, source,
    inventory_item_id, product_key, box_size, quantity, allocation_status,
    created_by_membership_id
  ) values (
    new.tenant_id, new.organization_id, agency.id, sale.shipment_id, new.box_source,
    inventory_item_id_value, product_key_value, box_size_value, new.quantity,
    case when new.box_source = 'own_box' then 'not_applicable' else 'pending' end,
    sale.seller_membership_id
  ) returning id into source_id;

  perform public.agency_allocate_boxes_fifo(source_id);
  return new;
end;
$$;

drop trigger if exists sync_agency_sale_box_source_trigger on public.sale_lines;
create trigger sync_agency_sale_box_source_trigger
  after insert on public.sale_lines
  for each row execute function public.sync_agency_sale_box_source();

-- ---------------------------------------------------------------------------
-- Compatibility archival, never hard deletion
-- ---------------------------------------------------------------------------

create or replace function public.archive_business_organization(
  target_organization_id uuid,
  archive_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  organization public.organizations;
  affected_profiles integer := 0;
  affected_organizations integer := 0;
begin
  if not public.is_platform_admin() then raise exception 'FORBIDDEN'; end if;
  if btrim(coalesce(archive_reason, '')) = '' then raise exception 'ARCHIVE_REASON_REQUIRED'; end if;

  select * into organization from public.organizations where id = target_organization_id for update;
  if organization.id is null or organization.kind <> 'client' then raise exception 'BUSINESS_ORGANIZATION_NOT_FOUND'; end if;

  if organization.organization_type = 'matrix' then
    update public.business_tenants
    set status = 'closed', archived_at = coalesce(archived_at, now()), updated_at = now()
    where id = organization.tenant_id;

    with previous as (
      select id, tenant_id, status, status_version
      from public.agencies
      where tenant_id = organization.tenant_id and status <> 'closed'
      for update
    ), closed as (
      update public.agencies agency
      set status = 'closed', status_version = agency.status_version + 1,
          archived_at = coalesce(agency.archived_at, now()), updated_at = now()
      from previous
      where agency.id = previous.id
      returning agency.id, agency.tenant_id, previous.status as previous_status, agency.status_version
    )
    insert into public.agency_status_history (
      tenant_id, agency_id, previous_status, status, version, actor_membership_id, reason
    )
    select tenant_id, id, previous_status, 'closed', status_version,
      public.current_membership_id(), btrim(archive_reason)
    from closed;

    update public.organizations
    set is_active = false, organization_status = 'closed', archived_at = coalesce(archived_at, now())
    where tenant_id = organization.tenant_id;
    get diagnostics affected_organizations = row_count;

    update public.profiles profile
    set is_active = false, archived_at = coalesce(profile.archived_at, now())
    from public.organizations scoped_organization
    where scoped_organization.id = profile.organization_id
      and scoped_organization.tenant_id = organization.tenant_id;
    get diagnostics affected_profiles = row_count;
  elsif organization.organization_type = 'agency' then
    with previous as (
      select id, tenant_id, status, status_version
      from public.agencies
      where organization_id = organization.id and status <> 'closed'
      for update
    ), closed as (
      update public.agencies agency
      set status = 'closed', status_version = agency.status_version + 1,
          archived_at = coalesce(agency.archived_at, now()), updated_at = now()
      from previous
      where agency.id = previous.id
      returning agency.id, agency.tenant_id, previous.status as previous_status, agency.status_version
    )
    insert into public.agency_status_history (
      tenant_id, agency_id, previous_status, status, version, actor_membership_id, reason
    )
    select tenant_id, id, previous_status, 'closed', status_version,
      public.current_membership_id(), btrim(archive_reason)
    from closed;

    update public.organizations
    set is_active = false, organization_status = 'closed', archived_at = coalesce(archived_at, now())
    where id = organization.id;
    affected_organizations := 1;

    update public.profiles
    set is_active = false, archived_at = coalesce(archived_at, now())
    where organization_id = organization.id;
    get diagnostics affected_profiles = row_count;
  else
    raise exception 'PLATFORM_ORGANIZATION_CANNOT_BE_ARCHIVED_HERE';
  end if;

  insert into public.immutable_audit_events (
    tenant_id, organization_id, actor_user_id, actor_membership_id,
    action, entity_type, entity_id, before_state, after_state, reason
  ) values (
    organization.tenant_id, organization.id, auth.uid(), public.current_membership_id(),
    'business_organization.archived', 'organization', organization.id,
    jsonb_build_object('isActive', true), jsonb_build_object('isActive', false), btrim(archive_reason)
  );

  return jsonb_build_object(
    'organizationId', organization.id,
    'archivedOrganizations', affected_organizations,
    'endedProfiles', affected_profiles
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Reporting contract. Tenant and scope are derived from the authenticated user.
-- Platform admins may request only the server-selected acting organization.
-- ---------------------------------------------------------------------------

create or replace function public.load_business_workspace(target_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  organization public.organizations;
  tenant public.business_tenants;
  membership public.organization_memberships;
  agencies_json jsonb;
  requests_json jsonb;
  holds_json jsonb;
  metrics_json jsonb;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into organization from public.organizations where id = target_organization_id;
  if organization.id is null or organization.tenant_id is null then raise exception 'BUSINESS_CONTEXT_REQUIRED'; end if;
  select * into tenant from public.business_tenants where id = organization.tenant_id;
  select * into membership from public.organization_memberships where id = public.current_membership_id();

  if not public.is_platform_admin() and (
    membership.id is null
    or membership.tenant_id is distinct from organization.tenant_id
    or not public.tenant_organization_access(organization.tenant_id, organization.id)
  ) then raise exception 'FORBIDDEN'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', row.id,
    'code', row.code,
    'name', row.name,
    'status', row.status,
    'statusVersion', row.status_version,
    'captorName', row.captor_name,
    'openRequests', row.open_requests,
    'chargeBalanceCents', row.charge_balance_cents
  ) order by row.name), '[]'::jsonb)
  into agencies_json
  from (
    select agency.id, agency.code, agency.status, agency.status_version,
      agency_organization.name,
      captor_profile.full_name as captor_name,
      (select count(*)::integer from public.agency_service_requests request
       where request.agency_id = agency.id and request.status not in ('completed', 'rejected', 'cancelled')) as open_requests,
      (select coalesce(sum(balance.outstanding_cents), 0)::bigint from public.agency_charge_balances balance
       where balance.agency_organization_id = agency.organization_id) as charge_balance_cents
    from public.agencies agency
    join public.organizations agency_organization on agency_organization.id = agency.organization_id
    left join lateral (
      select assignment.captor_membership_id
      from public.agency_captor_assignments assignment
      where assignment.agency_id = agency.id and assignment.ended_at is null
      order by assignment.started_at desc limit 1
    ) captor_assignment on true
    left join public.organization_memberships captor_membership on captor_membership.id = captor_assignment.captor_membership_id
    left join public.profiles captor_profile on captor_profile.id = captor_membership.user_id
    where agency.tenant_id = organization.tenant_id
      and (organization.organization_type = 'matrix' or agency.organization_id = organization.id)
      and (
        public.is_platform_admin()
        or public.tenant_organization_access(agency.tenant_id, agency.organization_id)
      )
  ) row;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', row.id,
    'requestNumber', row.code,
    'agencyName', row.agency_name,
    'status', row.status,
    'requestedAt', row.requested_at,
    'scheduledFor', row.scheduled_for,
    'lineCount', row.line_count
  ) order by row.requested_at desc), '[]'::jsonb)
  into requests_json
  from (
    select request.id, request.code, agency_organization.name as agency_name, request.status,
      request.created_at as requested_at,
      (select min(visit.scheduled_for) from public.agency_visits visit where visit.agency_id = request.agency_id and visit.status <> 'cancelled') as scheduled_for,
      (select count(*)::integer from public.agency_service_request_lines line where line.request_id = request.id) as line_count
    from public.agency_service_requests request
    join public.agencies agency on agency.id = request.agency_id
    join public.organizations agency_organization on agency_organization.id = agency.organization_id
    where request.tenant_id = organization.tenant_id
      and request.status not in ('completed', 'rejected', 'cancelled')
      and (organization.organization_type = 'matrix' or request.organization_id = organization.id)
      and (public.is_platform_admin() or public.tenant_organization_access(request.tenant_id, request.organization_id))
    order by request.created_at desc
    limit 100
  ) row;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', row.id,
    'reference', row.reference,
    'status', row.status,
    'balanceCents', row.balance_cents,
    'createdAt', row.created_at
  ) order by row.created_at desc), '[]'::jsonb)
  into holds_json
  from (
    select hold.id, coalesce(shipment.code, package.code, hold.id::text) as reference,
      hold.status, charge.outstanding_cents as balance_cents, hold.created_at
    from public.current_financial_holds hold
    join public.agency_charge_balances charge on charge.id = hold.agency_charge_id
    left join public.shipments shipment on shipment.id = hold.shipment_id
    left join public.shipment_packages package on package.id = hold.package_id
    where hold.tenant_id = organization.tenant_id
      and hold.status = 'active'
      and charge.outstanding_cents > 0
      and (organization.organization_type = 'matrix' or hold.agency_organization_id = organization.id)
      and (public.is_platform_admin() or public.tenant_organization_access(hold.tenant_id, hold.agency_organization_id))
    order by hold.created_at desc
    limit 100
  ) row;

  select jsonb_build_object(
    'agencyReceivableCents', (
      select coalesce(sum(balance.outstanding_cents), 0)::bigint
      from public.agency_charge_balances balance
      where balance.tenant_id = organization.tenant_id
        and (organization.organization_type = 'matrix' or balance.agency_organization_id = organization.id)
        and (public.is_platform_admin() or public.tenant_organization_access(balance.tenant_id, balance.agency_organization_id))
    ),
    'customerReceivableCents', (
      select coalesce(sum(balance.outstanding_cents), 0)::bigint
      from public.customer_invoice_balances balance
      where balance.tenant_id = organization.tenant_id and balance.organization_id = organization.id
    ),
    'unappliedAgencyPaymentsCents', (
      select coalesce(sum(balance.unapplied_cents), 0)::bigint
      from public.agency_payment_balances balance
      where balance.tenant_id = organization.tenant_id
        and (organization.organization_type = 'matrix' or balance.agency_organization_id = organization.id)
        and (public.is_platform_admin() or public.tenant_organization_access(balance.tenant_id, balance.agency_organization_id))
    ),
    'driverCashInTransitCents', (
      select coalesce(sum(greatest(custody.amount_cents - coalesce(settled.amount_cents, 0), 0)), 0)::bigint
      from public.driver_cash_custody_events custody
      left join (
        select custody_event_id, sum(amount_cents)::bigint as amount_cents
        from public.driver_settlement_lines group by custody_event_id
      ) settled on settled.custody_event_id = custody.id
      where custody.tenant_id = organization.tenant_id
        and (organization.organization_type = 'matrix' or custody.beneficiary_organization_id = organization.id)
    ),
    'activeHolds', (
      select count(*)::integer
      from public.current_financial_holds hold
      join public.agency_charge_balances charge on charge.id = hold.agency_charge_id
      where hold.tenant_id = organization.tenant_id
        and hold.status = 'active'
        and charge.outstanding_cents > 0
        and (organization.organization_type = 'matrix' or hold.agency_organization_id = organization.id)
        and (public.is_platform_admin() or public.tenant_organization_access(hold.tenant_id, hold.agency_organization_id))
    ),
    'unbalancedJournalEntries', (
      select count(*)::integer from (
        select entry.id
        from public.journal_entries entry
        join public.journal_lines line on line.journal_entry_id = entry.id
        where entry.tenant_id = organization.tenant_id
        group by entry.id
        having sum(line.debit_cents) <> sum(line.credit_cents)
      ) unbalanced
    ),
    'openRequests', (
      select count(*)::integer
      from public.agency_service_requests request
      where request.tenant_id = organization.tenant_id
        and request.status not in ('completed', 'rejected', 'cancelled')
        and (organization.organization_type = 'matrix' or request.organization_id = organization.id)
        and (public.is_platform_admin() or public.tenant_organization_access(request.tenant_id, request.organization_id))
    ),
    'availableMatrixBoxes', (
      select coalesce(sum(movement.quantity_delta), 0)::bigint
      from public.agency_box_movements movement
      where movement.tenant_id = organization.tenant_id
        and (organization.organization_type = 'matrix' or movement.organization_id = organization.id)
        and (public.is_platform_admin() or public.tenant_organization_access(movement.tenant_id, movement.organization_id))
    )
  ) into metrics_json;

  return jsonb_build_object(
    'context', jsonb_build_object(
      'tenantId', tenant.id,
      'tenantName', tenant.name,
      'organizationId', organization.id,
      'organizationName', organization.name,
      'organizationCode', organization.organization_code,
      'organizationType', organization.organization_type
    ),
    'agencies', agencies_json,
    'requests', requests_json,
    'holds', holds_json,
    'metrics', metrics_json
  );
end;
$$;

grant execute on function public.archive_business_organization(uuid, text) to authenticated;
grant execute on function public.load_business_workspace(uuid) to authenticated;

comment on function public.load_business_workspace(uuid) is
  'Snapshot compacto para UI. El tenant se deriva de la organización validada contra la sesión.';
