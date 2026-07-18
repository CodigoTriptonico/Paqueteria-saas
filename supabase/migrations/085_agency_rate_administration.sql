-- Matrix-owned internal rates for each agency. These rates are the amounts the
-- agency owes the matrix when it sells a configured box, never the retail price
-- that the agency charges its customer.

create or replace function public.load_agency_internal_rate_admin(target_agency_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tenant_id_value uuid := public.current_tenant_id();
  matrix_organization_id_value uuid := public.current_business_organization_id();
  agency_row public.agencies;
  active_version public.internal_rate_versions;
  catalog_json jsonb;
  rates_json jsonb;
  balance_cents bigint := 0;
begin
  if tenant_id_value is null or matrix_organization_id_value is null
    or not public.current_membership_has_permission('agency.pricing.manage', tenant_id_value, matrix_organization_id_value) then
    raise exception 'FORBIDDEN';
  end if;

  select * into agency_row
  from public.agencies agency
  where agency.id = target_agency_id
    and agency.tenant_id = tenant_id_value
    and agency.matrix_organization_id = matrix_organization_id_value
    and agency.archived_at is null;
  if agency_row.id is null then raise exception 'AGENCY_NOT_FOUND'; end if;

  select * into active_version
  from public.internal_rate_versions version
  where version.tenant_id = tenant_id_value
    and version.matrix_organization_id = matrix_organization_id_value
    and version.agency_organization_id = agency_row.organization_id
    and version.status = 'active'
    and version.valid_from <= now()
    and (version.valid_until is null or version.valid_until > now())
  order by version.valid_from desc, version.version desc
  limit 1;

  select coalesce(sum(balance.outstanding_cents), 0)::bigint into balance_cents
  from public.agency_charge_balances balance
  where balance.tenant_id = tenant_id_value
    and balance.matrix_organization_id = matrix_organization_id_value
    and balance.agency_organization_id = agency_row.organization_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'destinationCode', row.destination_code,
    'destinationName', row.destination_name,
    'productCode', row.product_code,
    'productName', row.product_name,
    'amountCents', coalesce(rate.amount_cents, 0)
  ) order by row.country_order, row.destination_name, row.product_name), '[]'::jsonb)
  into catalog_json
  from (
    select country.code as destination_code,
      country.name as destination_name,
      coalesce(nullif(box.catalog_key, ''), box.size) as product_code,
      box.size as product_name,
      country.sort_order as country_order
    from public.pricing_countries country
    join public.pricing_country_boxes box on box.country_id = country.id
    where country.organization_id = matrix_organization_id_value
  ) row
  left join public.internal_rate_lines rate
    on rate.rate_version_id = active_version.id
    and rate.destination_code = row.destination_code
    and rate.product_code = row.product_code
    and rate.concept = 'international_shipping';

  select coalesce(jsonb_agg(jsonb_build_object(
    'destinationCode', rate.destination_code,
    'productCode', rate.product_code,
    'amountCents', rate.amount_cents
  ) order by rate.destination_code, rate.product_code), '[]'::jsonb)
  into rates_json
  from public.internal_rate_lines rate
  where rate.rate_version_id = active_version.id
    and rate.concept = 'international_shipping';

  return jsonb_build_object(
    'agency', jsonb_build_object(
      'id', agency_row.id,
      'organizationId', agency_row.organization_id,
      'code', agency_row.code,
      'status', agency_row.status,
      'balanceCents', balance_cents,
      'name', (select organization.name from public.organizations organization where organization.id = agency_row.organization_id)
    ),
    'version', case when active_version.id is null then null else jsonb_build_object(
      'id', active_version.id,
      'version', active_version.version,
      'validFrom', active_version.valid_from
    ) end,
    'catalog', catalog_json,
    'rates', rates_json
  );
end;
$$;

create or replace function public.save_agency_internal_rates(
  target_agency_id uuid,
  rate_lines jsonb,
  idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tenant_id_value uuid := public.current_tenant_id();
  matrix_organization_id_value uuid := public.current_business_organization_id();
  membership_id_value uuid := public.current_membership_id();
  agency_row public.agencies;
  operation public.idempotency_operations;
  previous_version public.internal_rate_versions;
  new_version_id uuid;
  next_version integer;
  input_line jsonb;
  provided_rates jsonb := '{}'::jsonb;
  catalog_line record;
  amount_cents_value bigint;
  input_key text;
  lines_saved integer := 0;
  result_value jsonb;
begin
  if tenant_id_value is null or matrix_organization_id_value is null or membership_id_value is null then
    raise exception 'UNAUTHENTICATED';
  end if;
  if not public.current_membership_has_permission('agency.pricing.manage', tenant_id_value, matrix_organization_id_value) then
    raise exception 'FORBIDDEN';
  end if;
  if nullif(btrim(idempotency_key), '') is null or jsonb_typeof(rate_lines) <> 'array' then
    raise exception 'RATE_LINES_INVALID';
  end if;

  select * into agency_row
  from public.agencies agency
  where agency.id = target_agency_id
    and agency.tenant_id = tenant_id_value
    and agency.matrix_organization_id = matrix_organization_id_value
    and agency.archived_at is null
  for update;
  if agency_row.id is null then raise exception 'AGENCY_NOT_FOUND'; end if;

  insert into public.idempotency_operations (tenant_id, operation_type, idempotency_key, actor_membership_id, status)
  values (tenant_id_value, 'save_agency_internal_rates', btrim(idempotency_key), membership_id_value, 'executing')
  on conflict (tenant_id, operation_type, idempotency_key) do nothing
  returning * into operation;
  if operation.id is null then
    select * into operation from public.idempotency_operations
    where tenant_id = tenant_id_value and operation_type = 'save_agency_internal_rates'
      and idempotency_key = btrim(idempotency_key);
    if operation.status = 'completed' then return operation.result || jsonb_build_object('replayed', true); end if;
    raise exception 'OPERATION_IN_PROGRESS';
  end if;

  for input_line in select value from jsonb_array_elements(rate_lines) loop
    if coalesce(input_line->>'destinationCode', '') = ''
      or coalesce(input_line->>'productCode', '') = ''
      or coalesce(input_line->>'amountCents', '') !~ '^\d+$' then
      raise exception 'RATE_LINE_INVALID';
    end if;
    amount_cents_value := (input_line->>'amountCents')::bigint;
    if amount_cents_value < 0 then raise exception 'RATE_LINE_INVALID'; end if;
    input_key := upper(btrim(input_line->>'destinationCode')) || '::' || btrim(input_line->>'productCode');
    if provided_rates ? input_key then raise exception 'RATE_LINE_DUPLICATED'; end if;
    provided_rates := provided_rates || jsonb_build_object(input_key, amount_cents_value);
  end loop;

  if exists (
    select 1
    from jsonb_object_keys(provided_rates) key
    where not exists (
      select 1
      from public.pricing_countries country
      join public.pricing_country_boxes box on box.country_id = country.id
      where country.organization_id = matrix_organization_id_value
        and upper(country.code) || '::' || coalesce(nullif(box.catalog_key, ''), box.size) = key
    )
  ) then raise exception 'RATE_LINE_NOT_IN_MATRIX_CATALOG'; end if;

  select * into previous_version
  from public.internal_rate_versions version
  where version.tenant_id = tenant_id_value
    and version.matrix_organization_id = matrix_organization_id_value
    and version.agency_organization_id = agency_row.organization_id
    and version.status = 'active'
  order by version.valid_from desc, version.version desc
  limit 1
  for update;

  select coalesce(max(version.version), 0) + 1 into next_version
  from public.internal_rate_versions version
  where version.tenant_id = tenant_id_value
    and version.matrix_organization_id = matrix_organization_id_value
    and version.agency_organization_id = agency_row.organization_id
    and version.name = 'Tarifa interna de agencia';

  update public.internal_rate_versions
  set status = 'retired', valid_until = now()
  where tenant_id = tenant_id_value
    and matrix_organization_id = matrix_organization_id_value
    and agency_organization_id = agency_row.organization_id
    and status = 'active';

  insert into public.internal_rate_versions (
    tenant_id, matrix_organization_id, agency_organization_id, name, version,
    status, valid_from, created_by_membership_id
  ) values (
    tenant_id_value, matrix_organization_id_value, agency_row.organization_id, 'Tarifa interna de agencia', next_version,
    'active', now(), membership_id_value
  ) returning id into new_version_id;

  for catalog_line in
    select country.code as destination_code, country.name as destination_name,
      coalesce(nullif(box.catalog_key, ''), box.size) as product_code, box.size as product_name
    from public.pricing_countries country
    join public.pricing_country_boxes box on box.country_id = country.id
    where country.organization_id = matrix_organization_id_value
  loop
    amount_cents_value := coalesce((provided_rates ->> (upper(catalog_line.destination_code) || '::' || catalog_line.product_code))::bigint, 0);
    insert into public.internal_rate_lines (
      tenant_id, rate_version_id, destination_code, product_code, concept, amount_cents, snapshot
    ) values (
      tenant_id_value, new_version_id, catalog_line.destination_code, catalog_line.product_code,
      'international_shipping', amount_cents_value,
      jsonb_build_object('destinationName', catalog_line.destination_name, 'productName', catalog_line.product_name)
    );
    lines_saved := lines_saved + 1;
  end loop;

  insert into public.immutable_audit_events (
    tenant_id, organization_id, actor_user_id, actor_membership_id,
    action, entity_type, entity_id, before_state, after_state, idempotency_key, metadata
  ) values (
    tenant_id_value, matrix_organization_id_value, auth.uid(), membership_id_value,
    'agency.internal_rates.versioned', 'internal_rate_version', new_version_id,
    case when previous_version.id is null then '{}'::jsonb else jsonb_build_object('id', previous_version.id, 'version', previous_version.version) end,
    jsonb_build_object('id', new_version_id, 'version', next_version), btrim(idempotency_key),
    jsonb_build_object('agencyId', agency_row.id, 'lineCount', lines_saved)
  );

  result_value := jsonb_build_object(
    'operationId', operation.id, 'replayed', false, 'version', next_version,
    'entities', jsonb_build_object('rateVersionId', new_version_id, 'linesSaved', lines_saved)
  );
  update public.idempotency_operations
  set status = 'completed', result = result_value, completed_at = now()
  where id = operation.id;
  return result_value;
exception when others then
  if operation.id is not null then
    update public.idempotency_operations
    set status = 'failed', result = jsonb_build_object('error', sqlerrm), completed_at = now()
    where id = operation.id and status = 'executing';
  end if;
  raise;
end;
$$;

grant execute on function public.load_agency_internal_rate_admin(uuid) to authenticated;
grant execute on function public.save_agency_internal_rates(uuid, jsonb, text) to authenticated;

comment on function public.save_agency_internal_rates(uuid, jsonb, text) is
  'Versiona la tarifa interna que una agencia debe a la matriz por cada caja. No modifica cargos ya emitidos.';
