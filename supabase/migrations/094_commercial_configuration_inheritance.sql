-- Commercial configuration inheritance and agency-customer logistics.
-- Country values stay in the existing pricing catalog. Overrides are temporal
-- facts, and operational rows keep the resolved value used at creation time.

insert into public.permissions (key, name, description) values
  ('commercial.settings.view', 'Ver configuracion comercial', 'Consultar perfiles, herencia y valores efectivos de vendedores y agencias'),
  ('commercial.settings.manage', 'Gestionar configuracion comercial', 'Cambiar perfiles, rutas y excepciones comerciales sin registrar transacciones')
on conflict (key) do update set name = excluded.name, description = excluded.description;

insert into public.role_permissions(role_id, permission_id, granted)
select role.id, permission.id, true
from public.roles role
join public.permissions permission on permission.key in ('commercial.settings.view', 'commercial.settings.manage')
where role.slug = 'administrador'
on conflict (role_id, permission_id) do update set granted = true;

create table if not exists public.country_commercial_service_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  matrix_organization_id uuid not null references public.organizations(id) on delete restrict,
  destination_code text not null,
  service_concept text not null check (service_concept in ('home_delivery', 'home_pickup')),
  amount_cents bigint not null check (amount_cents >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  is_active boolean not null default true,
  calculation_rule jsonb not null default '{"type":"fixed"}'::jsonb,
  created_by_membership_id uuid references public.organization_memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, matrix_organization_id, destination_code, service_concept)
);

create table if not exists public.commercial_entity_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  matrix_organization_id uuid not null references public.organizations(id) on delete restrict,
  entity_type text not null check (entity_type in ('agency', 'seller')),
  entity_id uuid not null,
  country_code text not null default '',
  warehouse_id uuid references public.warehouses(id) on delete restrict,
  zone text not null default '',
  territory text not null default '',
  visit_frequency text not null default '',
  operational_status text not null default 'active' check (operational_status in ('active', 'paused', 'inactive')),
  enabled_services text[] not null default array['international_shipping']::text[],
  can_modify_public_price boolean not null default false,
  max_discount_bps integer not null default 0 check (max_discount_bps between 0 and 10000),
  address jsonb not null default '{}'::jsonb,
  contact jsonb not null default '{}'::jsonb,
  logistics_options jsonb not null default '{}'::jsonb,
  created_by_membership_id uuid references public.organization_memberships(id) on delete restrict,
  updated_by_membership_id uuid references public.organization_memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, matrix_organization_id, entity_type, entity_id)
);

create table if not exists public.commercial_pricing_overrides (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  matrix_organization_id uuid not null references public.organizations(id) on delete restrict,
  audience text not null check (audience in ('agency', 'seller')),
  entity_id uuid,
  destination_code text not null,
  product_code text not null default '',
  price_kind text not null check (price_kind in ('public', 'internal', 'additional_service')),
  service_concept text not null check (service_concept in ('international_shipping', 'home_delivery', 'home_pickup')),
  amount_cents bigint not null check (amount_cents >= 0),
  minimum_amount_cents bigint check (minimum_amount_cents is null or minimum_amount_cents >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  calculation_rule jsonb not null default '{"type":"fixed"}'::jsonb,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  created_by_membership_id uuid not null references public.organization_memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (valid_until is null or valid_until > valid_from),
  check ((service_concept = 'international_shipping' and product_code <> '' and price_kind in ('public', 'internal'))
    or (service_concept in ('home_delivery', 'home_pickup') and price_kind = 'additional_service'))
);

create unique index if not exists commercial_pricing_overrides_active_uidx
  on public.commercial_pricing_overrides (
    tenant_id, matrix_organization_id, audience,
    coalesce(entity_id, '00000000-0000-0000-0000-000000000000'::uuid),
    destination_code, product_code, price_kind, service_concept
  ) where valid_until is null;
create index if not exists commercial_pricing_overrides_lookup_idx
  on public.commercial_pricing_overrides (
    tenant_id, matrix_organization_id, audience, entity_id,
    destination_code, product_code, price_kind, service_concept, valid_from desc
  );

alter table public.agency_service_requests
  add column if not exists request_scope text not null default 'agency_office'
    check (request_scope in ('agency_office', 'agency_customer')),
  add column if not exists agency_customer_id uuid references public.customers(id) on delete restrict;

alter table public.agency_service_request_lines
  add column if not exists service_code text,
  add column if not exists commercial_price_snapshot jsonb not null default '{}'::jsonb;

update public.agency_service_request_lines
set service_code = case service_kind
  when 'empty_box_delivery' then 'agency_office_empty_box_delivery'
  when 'full_box_pickup' then 'agency_office_full_box_pickup'
  when 'home_delivery' then 'customer_home_delivery'
  when 'home_pickup' then 'customer_full_box_pickup'
  else 'customer_home_delivery'
end
where service_code is null;

alter table public.agency_service_request_lines
  alter column service_code set not null,
  drop constraint if exists agency_service_request_lines_service_code_check,
  add constraint agency_service_request_lines_service_code_check check (service_code in (
    'agency_office_empty_box_delivery',
    'agency_office_full_box_pickup',
    'customer_home_delivery',
    'customer_empty_box_delivery',
    'customer_full_box_pickup'
  ));

create table if not exists public.agency_box_custody_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  agency_id uuid not null references public.agencies(id) on delete restrict,
  request_line_id uuid not null references public.agency_service_request_lines(id) on delete restrict,
  visit_line_id uuid references public.agency_visit_lines(id) on delete restrict,
  holder_type text not null check (holder_type in ('agency_office', 'agency_customer', 'driver', 'matrix')),
  holder_id uuid,
  movement_type text not null check (movement_type in ('delivered_empty', 'picked_up_full')),
  quantity integer not null check (quantity > 0),
  evidence jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  unique (request_line_id, visit_line_id, movement_type)
);

alter table public.country_commercial_service_settings enable row level security;
alter table public.commercial_entity_profiles enable row level security;
alter table public.commercial_pricing_overrides enable row level security;
alter table public.agency_box_custody_events enable row level security;

drop policy if exists country_commercial_services_read on public.country_commercial_service_settings;
create policy country_commercial_services_read on public.country_commercial_service_settings for select to authenticated
using (tenant_id = public.current_tenant_id() and (
  public.current_membership_has_permission('commercial.settings.view', tenant_id, matrix_organization_id)
  or public.current_membership_has_permission('commercial.settings.manage', tenant_id, matrix_organization_id)
  or exists (select 1 from public.agencies agency where agency.tenant_id = country_commercial_service_settings.tenant_id and agency.matrix_organization_id = country_commercial_service_settings.matrix_organization_id and agency.organization_id = public.current_business_organization_id())
));

drop policy if exists commercial_entity_profiles_read on public.commercial_entity_profiles;
create policy commercial_entity_profiles_read on public.commercial_entity_profiles for select to authenticated
using (tenant_id = public.current_tenant_id() and (
  public.current_membership_has_permission('commercial.settings.view', tenant_id, matrix_organization_id)
  or public.current_membership_has_permission('commercial.settings.manage', tenant_id, matrix_organization_id)
  or (entity_type = 'seller' and entity_id = auth.uid())
  or exists (select 1 from public.agencies agency where agency.id = commercial_entity_profiles.entity_id and agency.organization_id = public.current_business_organization_id())
));

drop policy if exists commercial_pricing_overrides_read on public.commercial_pricing_overrides;
create policy commercial_pricing_overrides_read on public.commercial_pricing_overrides for select to authenticated
using (tenant_id = public.current_tenant_id() and (
  public.current_membership_has_permission('commercial.settings.view', tenant_id, matrix_organization_id)
  or public.current_membership_has_permission('commercial.settings.manage', tenant_id, matrix_organization_id)
  or entity_id is null
  or entity_id = auth.uid()
  or exists (select 1 from public.agencies agency where agency.id = commercial_pricing_overrides.entity_id and agency.organization_id = public.current_business_organization_id())
));

drop policy if exists agency_box_custody_events_read on public.agency_box_custody_events;
create policy agency_box_custody_events_read on public.agency_box_custody_events for select to authenticated
using (tenant_id = public.current_tenant_id() and exists (
  select 1 from public.agencies agency
  where agency.id = agency_box_custody_events.agency_id
    and (agency.organization_id = public.current_business_organization_id()
      or agency.matrix_organization_id = public.current_business_organization_id())
));

create or replace function public.resolve_commercial_price(
  target_audience text,
  target_entity_id uuid,
  target_destination_code text,
  target_product_code text,
  target_price_kind text,
  target_service_concept text,
  effective_at timestamptz default now()
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tenant_value uuid := public.current_tenant_id();
  matrix_value uuid;
  entity_override public.commercial_pricing_overrides;
  group_override public.commercial_pricing_overrides;
  base_amount bigint;
  base_currency text := 'USD';
  result_value jsonb;
begin
  if tenant_value is null or target_audience not in ('agency', 'seller')
    or target_price_kind not in ('public', 'internal', 'additional_service')
    or target_service_concept not in ('international_shipping', 'home_delivery', 'home_pickup') then
    raise exception 'COMMERCIAL_PRICE_REQUEST_INVALID';
  end if;

  if target_audience = 'agency' then
    select agency.matrix_organization_id into matrix_value
    from public.agencies agency
    where agency.id = target_entity_id and agency.tenant_id = tenant_value and agency.archived_at is null;
  else
    select profile.organization_id into matrix_value
    from public.profiles profile
    join public.organizations organization on organization.id = profile.organization_id
    where profile.id = target_entity_id and organization.tenant_id = tenant_value
      and organization.organization_type = 'matrix' and profile.archived_at is null;
  end if;
  if matrix_value is null then raise exception 'COMMERCIAL_ENTITY_NOT_FOUND'; end if;

  select * into entity_override
  from public.commercial_pricing_overrides override_row
  where override_row.tenant_id = tenant_value
    and override_row.matrix_organization_id = matrix_value
    and override_row.audience = target_audience
    and override_row.entity_id = target_entity_id
    and upper(override_row.destination_code) = upper(btrim(target_destination_code))
    and override_row.product_code = btrim(coalesce(target_product_code, ''))
    and override_row.price_kind = target_price_kind
    and override_row.service_concept = target_service_concept
    and override_row.valid_from <= effective_at
    and (override_row.valid_until is null or override_row.valid_until > effective_at)
  order by override_row.valid_from desc limit 1;

  select * into group_override
  from public.commercial_pricing_overrides override_row
  where override_row.tenant_id = tenant_value
    and override_row.matrix_organization_id = matrix_value
    and override_row.audience = target_audience
    and override_row.entity_id is null
    and upper(override_row.destination_code) = upper(btrim(target_destination_code))
    and override_row.product_code = btrim(coalesce(target_product_code, ''))
    and override_row.price_kind = target_price_kind
    and override_row.service_concept = target_service_concept
    and override_row.valid_from <= effective_at
    and (override_row.valid_until is null or override_row.valid_until > effective_at)
  order by override_row.valid_from desc limit 1;

  if target_service_concept = 'international_shipping' then
    select round(public.pricing_parse_money_amount(
      case target_price_kind when 'public' then box.price else coalesce(box.cost, '$0') end
    ) * 100)::bigint into base_amount
    from public.pricing_countries country
    join public.pricing_country_boxes box on box.country_id = country.id
    where country.organization_id = matrix_value
      and upper(country.code) = upper(btrim(target_destination_code))
      and coalesce(nullif(box.catalog_key, ''), box.size) = btrim(target_product_code)
    limit 1;
  else
    select setting.amount_cents, setting.currency into base_amount, base_currency
    from public.country_commercial_service_settings setting
    where setting.tenant_id = tenant_value and setting.matrix_organization_id = matrix_value
      and upper(setting.destination_code) = upper(btrim(target_destination_code))
      and setting.service_concept = target_service_concept and setting.is_active;
  end if;
  if base_amount is null then raise exception 'COUNTRY_COMMERCIAL_BASE_NOT_CONFIGURED'; end if;

  if entity_override.id is not null then
    result_value := jsonb_build_object('amountCents', entity_override.amount_cents, 'currency', entity_override.currency, 'sourceLevel', 'entity', 'sourceId', entity_override.id, 'validFrom', entity_override.valid_from);
  elsif group_override.id is not null then
    result_value := jsonb_build_object('amountCents', group_override.amount_cents, 'currency', group_override.currency, 'sourceLevel', 'group', 'sourceId', group_override.id, 'validFrom', group_override.valid_from);
  else
    result_value := jsonb_build_object('amountCents', base_amount, 'currency', base_currency, 'sourceLevel', 'country', 'sourceId', null, 'validFrom', null);
  end if;
  return result_value || jsonb_build_object(
    'audience', target_audience, 'entityId', target_entity_id,
    'destinationCode', upper(btrim(target_destination_code)),
    'productCode', btrim(coalesce(target_product_code, '')),
    'priceKind', target_price_kind, 'serviceConcept', target_service_concept,
    'resolvedAt', effective_at
  );
end;
$$;

create or replace function public.save_commercial_price_override(
  target_audience text,
  target_entity_id uuid,
  target_destination_code text,
  target_product_code text,
  target_price_kind text,
  target_service_concept text,
  target_amount_cents bigint,
  target_minimum_amount_cents bigint,
  target_currency text,
  target_calculation_rule jsonb,
  idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tenant_value uuid := public.current_tenant_id();
  matrix_value uuid := public.current_business_organization_id();
  membership_value uuid := public.current_membership_id();
  previous_row public.commercial_pricing_overrides;
  new_id uuid;
begin
  if tenant_value is null or matrix_value is null or membership_value is null
    or not public.current_membership_has_permission('commercial.settings.manage', tenant_value, matrix_value) then raise exception 'FORBIDDEN'; end if;
  if target_amount_cents < 0 or coalesce(target_currency, '') !~ '^[A-Z]{3}$' or nullif(btrim(idempotency_key), '') is null then raise exception 'COMMERCIAL_OVERRIDE_INVALID'; end if;
  if target_audience = 'agency' and target_entity_id is not null and not exists (
    select 1 from public.agencies agency where agency.id = target_entity_id and agency.tenant_id = tenant_value and agency.matrix_organization_id = matrix_value and agency.archived_at is null
  ) then raise exception 'COMMERCIAL_ENTITY_NOT_FOUND'; end if;
  if target_audience = 'seller' and target_entity_id is not null and not exists (
    select 1 from public.profiles profile join public.roles role on role.id = profile.role_id
    where profile.id = target_entity_id and profile.organization_id = matrix_value and role.slug = 'vendedor' and profile.archived_at is null
  ) then raise exception 'COMMERCIAL_ENTITY_NOT_FOUND'; end if;

  select * into previous_row from public.commercial_pricing_overrides override_row
  where override_row.tenant_id = tenant_value and override_row.matrix_organization_id = matrix_value
    and override_row.audience = target_audience and override_row.entity_id is not distinct from target_entity_id
    and upper(override_row.destination_code) = upper(btrim(target_destination_code))
    and override_row.product_code = btrim(coalesce(target_product_code, ''))
    and override_row.price_kind = target_price_kind and override_row.service_concept = target_service_concept
    and override_row.valid_until is null for update;
  if previous_row.id is not null then update public.commercial_pricing_overrides set valid_until = now() where id = previous_row.id; end if;

  insert into public.commercial_pricing_overrides(
    tenant_id, matrix_organization_id, audience, entity_id, destination_code, product_code,
    price_kind, service_concept, amount_cents, minimum_amount_cents, currency,
    calculation_rule, created_by_membership_id
  ) values (
    tenant_value, matrix_value, target_audience, target_entity_id, upper(btrim(target_destination_code)),
    btrim(coalesce(target_product_code, '')), target_price_kind, target_service_concept,
    target_amount_cents, target_minimum_amount_cents, target_currency,
    coalesce(target_calculation_rule, '{"type":"fixed"}'::jsonb), membership_value
  ) returning id into new_id;

  insert into public.immutable_audit_events(
    tenant_id, organization_id, actor_user_id, actor_membership_id, action, entity_type,
    entity_id, before_state, after_state, idempotency_key, metadata
  ) values (
    tenant_value, matrix_value, auth.uid(), membership_value, 'commercial.override.changed',
    'commercial_pricing_override', new_id,
    case when previous_row.id is null then '{}'::jsonb else jsonb_build_object('id', previous_row.id, 'amountCents', previous_row.amount_cents, 'validUntil', now()) end,
    jsonb_build_object('id', new_id, 'amountCents', target_amount_cents), btrim(idempotency_key),
    jsonb_build_object('audience', target_audience, 'level', case when target_entity_id is null then 'group' else 'entity' end,
      'entityId', target_entity_id, 'destinationCode', upper(btrim(target_destination_code)), 'productCode', btrim(coalesce(target_product_code, '')),
      'priceKind', target_price_kind, 'serviceConcept', target_service_concept)
  );
  return jsonb_build_object('overrideId', new_id);
end;
$$;

create or replace function public.restore_commercial_price_inheritance(target_override_id uuid, idempotency_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  tenant_value uuid := public.current_tenant_id(); matrix_value uuid := public.current_business_organization_id();
  membership_value uuid := public.current_membership_id(); previous_row public.commercial_pricing_overrides;
begin
  if not public.current_membership_has_permission('commercial.settings.manage', tenant_value, matrix_value) then raise exception 'FORBIDDEN'; end if;
  select * into previous_row from public.commercial_pricing_overrides where id = target_override_id and tenant_id = tenant_value and matrix_organization_id = matrix_value and valid_until is null for update;
  if previous_row.id is null then raise exception 'COMMERCIAL_OVERRIDE_NOT_FOUND'; end if;
  update public.commercial_pricing_overrides set valid_until = now() where id = previous_row.id;
  insert into public.immutable_audit_events(tenant_id, organization_id, actor_user_id, actor_membership_id, action, entity_type, entity_id, before_state, after_state, idempotency_key, metadata)
  values(tenant_value, matrix_value, auth.uid(), membership_value, 'commercial.override.restored', 'commercial_pricing_override', previous_row.id,
    jsonb_build_object('amountCents', previous_row.amount_cents), jsonb_build_object('inherited', true), btrim(idempotency_key),
    jsonb_build_object('audience', previous_row.audience, 'level', case when previous_row.entity_id is null then 'group' else 'entity' end, 'entityId', previous_row.entity_id));
  return jsonb_build_object('restored', true);
end;
$$;

create or replace function public.save_country_commercial_service(
  target_destination_code text, target_service_concept text, target_amount_cents bigint,
  target_currency text, target_calculation_rule jsonb, idempotency_key text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  tenant_value uuid := public.current_tenant_id(); matrix_value uuid := public.current_business_organization_id();
  membership_value uuid := public.current_membership_id(); previous_row public.country_commercial_service_settings; setting_id uuid;
begin
  if not public.current_membership_has_permission('commercial.settings.manage', tenant_value, matrix_value)
    and not public.current_membership_has_permission('settings.manage', tenant_value, matrix_value) then raise exception 'FORBIDDEN'; end if;
  if target_service_concept not in ('home_delivery', 'home_pickup') or target_amount_cents < 0 or target_currency !~ '^[A-Z]{3}$'
    or not exists(select 1 from public.pricing_countries country where country.organization_id = matrix_value and upper(country.code) = upper(btrim(target_destination_code))) then raise exception 'COUNTRY_SERVICE_INVALID'; end if;
  select * into previous_row from public.country_commercial_service_settings where tenant_id = tenant_value and matrix_organization_id = matrix_value and upper(destination_code) = upper(btrim(target_destination_code)) and service_concept = target_service_concept;
  insert into public.country_commercial_service_settings(tenant_id, matrix_organization_id, destination_code, service_concept, amount_cents, currency, calculation_rule, created_by_membership_id)
  values(tenant_value, matrix_value, upper(btrim(target_destination_code)), target_service_concept, target_amount_cents, target_currency, coalesce(target_calculation_rule, '{"type":"fixed"}'::jsonb), membership_value)
  on conflict(tenant_id, matrix_organization_id, destination_code, service_concept) do update set amount_cents=excluded.amount_cents, currency=excluded.currency, calculation_rule=excluded.calculation_rule, is_active=true, updated_at=now()
  returning id into setting_id;
  insert into public.immutable_audit_events(tenant_id, organization_id, actor_user_id, actor_membership_id, action, entity_type, entity_id, before_state, after_state, idempotency_key, metadata)
  values(tenant_value, matrix_value, auth.uid(), membership_value, 'commercial.country_service.changed', 'country_commercial_service_setting', setting_id,
    case when previous_row.id is null then '{}'::jsonb else jsonb_build_object('amountCents', previous_row.amount_cents) end,
    jsonb_build_object('amountCents', target_amount_cents), btrim(idempotency_key), jsonb_build_object('level', 'country', 'destinationCode', upper(btrim(target_destination_code)), 'serviceConcept', target_service_concept));
  return jsonb_build_object('settingId', setting_id);
end;
$$;

create or replace function public.change_agency_default_route(
  target_agency_id uuid, target_route_template_id uuid, change_reason text, idempotency_key text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  tenant_value uuid := public.current_tenant_id(); matrix_value uuid := public.current_business_organization_id();
  membership_value uuid := public.current_membership_id(); agency_row public.agencies; previous_assignment public.agency_default_route_assignments; new_id uuid;
begin
  if not public.current_membership_has_permission('commercial.settings.manage', tenant_value, matrix_value)
    and not public.current_membership_has_permission('agency.edit', tenant_value, matrix_value) then raise exception 'FORBIDDEN'; end if;
  select * into agency_row from public.agencies where id = target_agency_id and tenant_id = tenant_value and matrix_organization_id = matrix_value and archived_at is null;
  if agency_row.id is null or not exists(select 1 from public.logistics_route_templates where id=target_route_template_id and organization_id=matrix_value) then raise exception 'AGENCY_ROUTE_INVALID'; end if;
  select * into previous_assignment from public.agency_default_route_assignments where agency_id=target_agency_id and ended_at is null for update;
  if previous_assignment.route_template_id = target_route_template_id then return jsonb_build_object('assignmentId', previous_assignment.id, 'unchanged', true); end if;
  update public.agency_default_route_assignments set ended_at=now() where id=previous_assignment.id;
  insert into public.agency_default_route_assignments(tenant_id, organization_id, agency_id, route_template_id, assigned_by_membership_id, reason)
  values(tenant_value, agency_row.organization_id, target_agency_id, target_route_template_id, membership_value, left(btrim(change_reason), 500)) returning id into new_id;
  insert into public.immutable_audit_events(tenant_id, organization_id, actor_user_id, actor_membership_id, action, entity_type, entity_id, before_state, after_state, reason, idempotency_key, metadata)
  values(tenant_value, matrix_value, auth.uid(), membership_value, 'agency.default_route.changed', 'agency', target_agency_id,
    case when previous_assignment.id is null then '{}'::jsonb else jsonb_build_object('assignmentId', previous_assignment.id, 'routeTemplateId', previous_assignment.route_template_id) end,
    jsonb_build_object('assignmentId', new_id, 'routeTemplateId', target_route_template_id), left(btrim(change_reason),500), btrim(idempotency_key), jsonb_build_object('historyPreserved', true));
  return jsonb_build_object('assignmentId', new_id, 'unchanged', false);
end;
$$;

grant execute on function public.resolve_commercial_price(text,uuid,text,text,text,text,timestamptz) to authenticated;
grant execute on function public.save_commercial_price_override(text,uuid,text,text,text,text,bigint,bigint,text,jsonb,text) to authenticated;
grant execute on function public.restore_commercial_price_inheritance(uuid,text) to authenticated;
grant execute on function public.save_country_commercial_service(text,text,bigint,text,jsonb,text) to authenticated;
grant execute on function public.change_agency_default_route(uuid,uuid,text,text) to authenticated;

comment on function public.resolve_commercial_price(text,uuid,text,text,text,text,timestamptz) is
  'Resuelve entidad > grupo > pais. Es la unica fuente autorizada para snapshots operativos y comerciales.';

-- Conservatively initialize the new per-country service base from the current
-- organization-wide values. Zero stays zero; no historical charge is changed.
insert into public.country_commercial_service_settings(
  tenant_id, matrix_organization_id, destination_code, service_concept,
  amount_cents, currency, calculation_rule
)
select organization.tenant_id, country.organization_id, upper(country.code), concept.name,
  round(public.pricing_parse_money_amount(case concept.name
    when 'home_delivery' then coalesce(route.empty_box_delivery_fee, '$0')
    else coalesce(route.full_box_pickup_fee, '$0') end) * 100)::bigint,
  'USD', '{"type":"fixed","migratedFrom":"organization_route_settings"}'::jsonb
from public.pricing_countries country
join public.organizations organization on organization.id = country.organization_id
left join public.organization_route_settings route on route.organization_id = country.organization_id
cross join (values ('home_delivery'), ('home_pickup')) concept(name)
where organization.tenant_id is not null
on conflict(tenant_id, matrix_organization_id, destination_code, service_concept) do nothing;

create or replace function public.create_agency_service_request(lines jsonb, requested_date date, note text, idempotency_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  tenant uuid := public.current_tenant_id();
  membership uuid := public.current_membership_id();
  agency_row public.agencies;
  request_id uuid;
  line jsonb;
  operation public.idempotency_operations;
  service_code_value text;
  service_kind_value text;
  customer_id_value uuid;
  first_customer_id uuid;
  address_value jsonb := '{}'::jsonb;
  request_scope_value text := 'agency_office';
  destination_code_value text;
  profile_country_code text;
  price_value jsonb;
  unit_charge_value bigint;
  product_code_value text;
begin
  if tenant is null or membership is null or jsonb_typeof(lines) <> 'array' or jsonb_array_length(lines) = 0 then raise exception 'SOLICITUD_INVALIDA'; end if;
  select agency.* into agency_row from public.agencies agency
  where agency.tenant_id = tenant and agency.organization_id = public.current_business_organization_id() and agency.archived_at is null;
  if agency_row.id is null or not public.current_membership_has_permission('agency.requests.create', tenant, agency_row.organization_id) then raise exception 'FORBIDDEN'; end if;
  select profile.country_code into profile_country_code from public.commercial_entity_profiles profile
  where profile.tenant_id=tenant and profile.matrix_organization_id=agency_row.matrix_organization_id and profile.entity_type='agency' and profile.entity_id=agency_row.id;

  for line in select value from jsonb_array_elements(lines) loop
    service_code_value := coalesce(line->>'serviceCode', line->>'serviceKind', '');
    if service_code_value in ('customer_home_delivery', 'customer_empty_box_delivery', 'customer_full_box_pickup') then
      request_scope_value := 'agency_customer';
      customer_id_value := nullif(line->>'customerId', '')::uuid;
      if customer_id_value is null or not exists(select 1 from public.customers customer where customer.id=customer_id_value and customer.organization_id=agency_row.organization_id) then raise exception 'AGENCY_CUSTOMER_REQUIRED'; end if;
      if first_customer_id is not null and first_customer_id <> customer_id_value then raise exception 'ONE_CUSTOMER_PER_REQUEST'; end if;
      first_customer_id := customer_id_value;
      if jsonb_typeof(line->'address') <> 'object' or line->'address' = '{}'::jsonb then raise exception 'AGENCY_CUSTOMER_ADDRESS_REQUIRED'; end if;
      address_value := line->'address';
    elsif request_scope_value = 'agency_customer' then
      raise exception 'REQUEST_SCOPE_MIXED';
    end if;
  end loop;

  insert into public.idempotency_operations(tenant_id, operation_type, idempotency_key, actor_membership_id, status)
  values(tenant, 'create_agency_service_request', btrim(idempotency_key), membership, 'executing')
  on conflict(tenant_id, operation_type, idempotency_key) do nothing returning * into operation;
  if operation.id is null then
    select * into operation from public.idempotency_operations where tenant_id=tenant and operation_type='create_agency_service_request' and idempotency_key=btrim(idempotency_key);
    if operation.status='completed' then return operation.result || jsonb_build_object('replayed', true); end if;
    raise exception 'OPERATION_IN_PROGRESS';
  end if;

  insert into public.agency_service_requests(
    tenant_id, organization_id, agency_id, code, status, requested_service_date,
    address_snapshot, notes, created_by_membership_id, request_scope, agency_customer_id
  ) values(
    tenant, agency_row.organization_id, agency_row.id,
    'AG-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
    'submitted', requested_date, address_value, left(coalesce(note,''),1000), membership,
    request_scope_value, first_customer_id
  ) returning id into request_id;

  for line in select value from jsonb_array_elements(lines) loop
    service_code_value := coalesce(line->>'serviceCode', line->>'serviceKind', '');
    if coalesce((line->>'quantity')::integer,0) <= 0 or service_code_value not in (
      'agency_office_empty_box_delivery','agency_office_full_box_pickup','customer_home_delivery','customer_empty_box_delivery','customer_full_box_pickup'
    ) then raise exception 'LINEA_INVALIDA'; end if;
    service_kind_value := case service_code_value
      when 'agency_office_empty_box_delivery' then 'empty_box_delivery'
      when 'agency_office_full_box_pickup' then 'full_box_pickup'
      when 'customer_empty_box_delivery' then 'empty_box_delivery'
      when 'customer_full_box_pickup' then 'home_pickup'
      else 'home_delivery' end;
    customer_id_value := nullif(line->>'customerId','')::uuid;
    destination_code_value := upper(coalesce(nullif(btrim(line->>'destinationCode'),''), nullif(btrim(profile_country_code),''), ''));
    product_code_value := coalesce(nullif(btrim(line->>'productKey'),''), nullif(btrim(line->>'boxSize'),''), '');
    unit_charge_value := 0;
    price_value := jsonb_build_object('amountCents',0,'currency','USD','sourceLevel','not_chargeable','resolvedAt',now());
    if service_code_value in ('customer_home_delivery','customer_empty_box_delivery','customer_full_box_pickup') then
      if destination_code_value = '' then raise exception 'AGENCY_COUNTRY_REQUIRED'; end if;
      price_value := public.resolve_commercial_price(
        'agency', agency_row.id, destination_code_value, '', 'additional_service',
        case when service_code_value='customer_full_box_pickup' then 'home_pickup' else 'home_delivery' end,
        now()
      );
      unit_charge_value := (price_value->>'amountCents')::bigint;
    end if;
    insert into public.agency_service_request_lines(
      tenant_id, organization_id, request_id, service_kind, service_code, requested_quantity,
      inventory_item_id, matrix_warehouse_id, product_key, box_size,
      unit_charge_amount_cents, currency, commercial_price_snapshot, details
    ) values(
      tenant, agency_row.organization_id, request_id, service_kind_value, service_code_value,
      (line->>'quantity')::integer, nullif(line->>'inventoryItemId','')::uuid,
      nullif(line->>'warehouseId','')::uuid, coalesce(line->>'productKey',''), coalesce(line->>'boxSize',''),
      unit_charge_value, coalesce(price_value->>'currency','USD'), price_value,
      coalesce(line->'details','{}'::jsonb) || jsonb_build_object(
        'customerId', customer_id_value, 'address', coalesce(line->'address','{}'::jsonb),
        'destinationCode', destination_code_value, 'serviceCode', service_code_value
      )
    );
  end loop;
  update public.idempotency_operations set status='completed', result=jsonb_build_object('requestId',request_id,'replayed',false), completed_at=now() where id=operation.id;
  return jsonb_build_object('requestId',request_id,'replayed',false);
exception when others then
  if operation.id is not null then update public.idempotency_operations set status='failed', result=jsonb_build_object('error',sqlerrm), completed_at=now() where id=operation.id and status='executing'; end if;
  raise;
end;
$$;

create or replace function public.record_agency_visit_custody()
returns trigger language plpgsql security definer set search_path=public as $$
declare request_line public.agency_service_request_lines; request_row public.agency_service_requests; visit_row public.agency_visits;
begin
  if new.confirmed_at is null or new.confirmed_quantity is null or new.confirmed_quantity <= 0 or old.confirmed_at is not null then return new; end if;
  select * into request_line from public.agency_service_request_lines where id=new.request_line_id;
  select * into request_row from public.agency_service_requests where id=request_line.request_id;
  select * into visit_row from public.agency_visits where id=new.visit_id;
  if request_line.service_code in ('agency_office_empty_box_delivery','customer_empty_box_delivery') then
    insert into public.agency_box_custody_events(tenant_id,agency_id,request_line_id,visit_line_id,holder_type,holder_id,movement_type,quantity,evidence,occurred_at)
    values(new.tenant_id,visit_row.agency_id,request_line.id,new.id,
      case when request_line.service_code='customer_empty_box_delivery' then 'agency_customer' else 'agency_office' end,
      case when request_line.service_code='customer_empty_box_delivery' then request_row.agency_customer_id else visit_row.agency_id end,
      'delivered_empty',new.confirmed_quantity,new.evidence,new.confirmed_at)
    on conflict(request_line_id,visit_line_id,movement_type) do nothing;
  elsif request_line.service_code in ('agency_office_full_box_pickup','customer_full_box_pickup') then
    insert into public.agency_box_custody_events(tenant_id,agency_id,request_line_id,visit_line_id,holder_type,holder_id,movement_type,quantity,evidence,occurred_at)
    values(new.tenant_id,visit_row.agency_id,request_line.id,new.id,'driver',new.responsible_membership_id,'picked_up_full',new.confirmed_quantity,new.evidence,new.confirmed_at)
    on conflict(request_line_id,visit_line_id,movement_type) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists agency_visit_line_custody_event on public.agency_visit_lines;
create trigger agency_visit_line_custody_event after update of confirmed_quantity,confirmed_at on public.agency_visit_lines
for each row execute function public.record_agency_visit_custody();

grant execute on function public.create_agency_service_request(jsonb,date,text,text) to authenticated;

-- Replace the agency sale boundary so it resolves both amounts server-side.
-- A caller may choose its retail amount, but can never choose the matrix rate.
create or replace function public.create_agency_sale(command jsonb, idempotency_key text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  tenant_value uuid := public.current_tenant_id(); agency_org_id uuid := public.current_business_organization_id();
  membership_value uuid := public.current_membership_id(); agency_row public.agencies; operation public.idempotency_operations;
  sale_id_value uuid; invoice_id_value uuid; shipment_id_value uuid := nullif(command->>'shipmentId','')::uuid;
  customer_id_value uuid := nullif(command->>'customerId','')::uuid; customer_name_value text := btrim(coalesce(command->>'customerName',''));
  item jsonb; quantity_value integer; line_number_value integer := 0; line_id_value uuid;
  destination_value text; product_value text; concept_value text; public_resolution jsonb; internal_resolution jsonb;
  public_amount bigint; internal_amount bigint; total_value bigint := 0; internal_total bigint := 0;
  captor_assignment uuid; result_value jsonb; box_source_value text;
begin
  if tenant_value is null or agency_org_id is null or membership_value is null then raise exception 'UNAUTHENTICATED'; end if;
  operation := public.finance_begin_operation(tenant_value,'create_agency_sale',idempotency_key);
  if operation.status='completed' then return jsonb_set(operation.result,'{replayed}','true'::jsonb,true);
  elsif operation.actor_membership_id is distinct from membership_value then raise exception 'IDEMPOTENCY_KEY_IN_USE'; end if;
  if not public.current_membership_has_permission('agency.sales.create',tenant_value,agency_org_id) then raise exception 'FORBIDDEN'; end if;
  select * into agency_row from public.agencies where tenant_id=tenant_value and organization_id=agency_org_id and status='active' and archived_at is null;
  if agency_row.id is null then raise exception 'ACTIVE_AGENCY_REQUIRED'; end if;
  if customer_name_value='' then raise exception 'CUSTOMER_NAME_REQUIRED'; end if;
  if jsonb_typeof(command->'lines')<>'array' or jsonb_array_length(command->'lines')=0 then raise exception 'SALE_LINES_REQUIRED'; end if;
  if customer_id_value is not null and not exists(select 1 from public.customers where id=customer_id_value and organization_id=agency_org_id) then raise exception 'CUSTOMER_SCOPE_MISMATCH'; end if;
  if shipment_id_value is not null and not exists(select 1 from public.shipments where id=shipment_id_value and organization_id=agency_row.matrix_organization_id) then raise exception 'SHIPMENT_SCOPE_MISMATCH'; end if;

  for item in select value from jsonb_array_elements(command->'lines') loop
    quantity_value := coalesce((item->>'quantity')::integer,0);
    destination_value := upper(btrim(coalesce(item->>'destinationCode','')));
    product_value := btrim(coalesce(item->>'productCode',''));
    concept_value := coalesce(nullif(btrim(item->>'concept'),''),'international_shipping');
    if quantity_value<=0 or destination_value='' or (concept_value='international_shipping' and product_value='') then raise exception 'AGENCY_SALE_LINE_INVALID'; end if;
    public_resolution := public.resolve_commercial_price('agency',agency_row.id,destination_value,product_value,
      case when concept_value='international_shipping' then 'public' else 'additional_service' end,concept_value,now());
    internal_resolution := public.resolve_commercial_price('agency',agency_row.id,destination_value,product_value,
      case when concept_value='international_shipping' then 'internal' else 'additional_service' end,concept_value,now());
    public_amount := coalesce(nullif(item->>'publicAmountCents','')::bigint,(public_resolution->>'amountCents')::bigint);
    internal_amount := (internal_resolution->>'amountCents')::bigint;
    if public_amount<0 then raise exception 'PUBLIC_AMOUNT_INVALID'; end if;
    total_value := total_value + public_amount*quantity_value;
    internal_total := internal_total + internal_amount*quantity_value;
  end loop;

  select assignment.id into captor_assignment from public.agency_captor_assignments assignment
  where assignment.agency_id=agency_row.id and assignment.ended_at is null order by assignment.started_at desc limit 1;
  insert into public.sales(tenant_id,selling_organization_id,matrix_organization_id,agency_organization_id,shipment_id,
    legacy_distribution_partner_id,sale_kind,customer_id,customer_name_snapshot,subtotal_cents,total_cents,captor_assignment_id,
    seller_membership_id,attribution_snapshot,idempotency_key)
  values(tenant_value,agency_org_id,agency_row.matrix_organization_id,agency_org_id,shipment_id_value,
    agency_row.legacy_distribution_partner_id,'agency_retail',customer_id_value,customer_name_value,total_value,total_value,
    captor_assignment,membership_value,jsonb_build_object('captorAssignmentId',captor_assignment,'sellerMembershipId',membership_value),idempotency_key)
  returning id into sale_id_value;
  insert into public.customer_invoices(tenant_id,organization_id,sale_id,customer_id,invoice_number,due_at,amount_cents,created_by_membership_id)
  values(tenant_value,agency_org_id,sale_id_value,customer_id_value,public.finance_next_invoice_number(agency_org_id),nullif(command->>'dueAt','')::timestamptz,total_value,membership_value)
  returning id into invoice_id_value;

  for item in select value from jsonb_array_elements(command->'lines') loop
    line_number_value := line_number_value+1; quantity_value := (item->>'quantity')::integer;
    destination_value := upper(btrim(item->>'destinationCode')); product_value := btrim(coalesce(item->>'productCode',''));
    concept_value := coalesce(nullif(btrim(item->>'concept'),''),'international_shipping');
    public_resolution := public.resolve_commercial_price('agency',agency_row.id,destination_value,product_value,
      case when concept_value='international_shipping' then 'public' else 'additional_service' end,concept_value,now());
    internal_resolution := public.resolve_commercial_price('agency',agency_row.id,destination_value,product_value,
      case when concept_value='international_shipping' then 'internal' else 'additional_service' end,concept_value,now());
    public_amount := coalesce(nullif(item->>'publicAmountCents','')::bigint,(public_resolution->>'amountCents')::bigint);
    internal_amount := (internal_resolution->>'amountCents')::bigint;
    if nullif(item->>'publicAmountCents','') is not null then public_resolution := public_resolution || jsonb_build_object('suggestedAmountCents',(public_resolution->>'amountCents')::bigint,'amountCents',public_amount,'sourceLevel','agency_entered'); end if;
    box_source_value := case when concept_value='international_shipping' then coalesce(nullif(item->>'boxSource',''),'matrix_purchased') else null end;
    insert into public.sale_lines(tenant_id,organization_id,sale_id,line_number,concept,description,quantity,unit_amount_cents,box_source,rate_snapshot)
    values(tenant_value,agency_org_id,sale_id_value,line_number_value,concept_value,
      coalesce(nullif(btrim(item->>'description'),''),product_value),quantity_value,public_amount,box_source_value,
      jsonb_build_object('public',public_resolution,'internal',internal_resolution,'destinationCode',destination_value,'productCode',product_value,
        'inventoryItemId',nullif(item->>'inventoryItemId',''),'productKey',coalesce(nullif(item->>'productKey',''),product_value),
        'boxSize',nullif(item->>'boxSize',''),'quantity',quantity_value,'snapshottedAt',now()))
    returning id into line_id_value;
    insert into public.customer_invoice_lines(tenant_id,organization_id,invoice_id,sale_line_id,line_number,description,quantity,unit_amount_cents)
    values(tenant_value,agency_org_id,invoice_id_value,line_id_value,line_number_value,coalesce(nullif(btrim(item->>'description'),''),product_value),quantity_value,public_amount);
    if internal_amount>0 then
      insert into public.agency_charges(tenant_id,matrix_organization_id,agency_organization_id,sale_id,shipment_id,concept,source_operation_type,source_operation_id,amount_cents,created_by_membership_id,idempotency_key,metadata)
      values(tenant_value,agency_row.matrix_organization_id,agency_org_id,sale_id_value,shipment_id_value,concept_value,'sale_line',line_id_value,
        internal_amount*quantity_value,membership_value,idempotency_key||':charge:'||line_number_value,
        jsonb_build_object('quantity',quantity_value,'unitAmountCents',internal_amount,'priceResolution',internal_resolution));
    end if;
  end loop;
  perform public.finance_audit(tenant_value,agency_org_id,'agency_sale.created','sale',sale_id_value,
    jsonb_build_object('invoiceId',invoice_id_value,'customerTotalCents',total_value,'matrixReceivableCents',internal_total,'separated',true),'',idempotency_key);
  result_value := jsonb_build_object('operationId',operation.id,'replayed',false,'version',1,'entities',jsonb_build_object('saleId',sale_id_value,'invoiceId',invoice_id_value));
  return public.finance_complete_operation(operation.id,result_value);
end;
$$;

grant execute on function public.create_agency_sale(jsonb,text) to authenticated;
