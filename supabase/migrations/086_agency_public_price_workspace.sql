-- Agency retail-price workspace. The matrix internal rate stays visible to the
-- agency so it can price responsibly, but only the agency's own public list is
-- writable here. A sale snapshots both values through create_agency_sale.

-- Active versions remain immutable except for their one-way retirement. Without
-- this transition, versioned rate replacement would be impossible after first use.
create or replace function public.finance_guard_rate_history()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_status text;
begin
  if tg_table_name = 'internal_rate_versions' or tg_table_name = 'agency_price_list_versions' then
    if old.status = 'active' and new.status = 'retired' and new.valid_until is not null then
      return new;
    end if;
    if old.status <> 'draft' then raise exception 'ACTIVE_RATE_VERSION_IS_IMMUTABLE'; end if;
    return new;
  end if;
  if tg_table_name = 'internal_rate_lines' then
    select status into parent_status from public.internal_rate_versions where id = old.rate_version_id;
  else
    select status into parent_status from public.agency_price_list_versions where id = old.price_list_version_id;
  end if;
  if parent_status <> 'draft' then raise exception 'ACTIVE_RATE_LINE_IS_IMMUTABLE'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.load_agency_public_price_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tenant_id_value uuid := public.current_tenant_id();
  agency_organization_id_value uuid := public.current_business_organization_id();
  agency_row public.agencies;
  internal_version public.internal_rate_versions;
  public_version public.agency_price_list_versions;
  catalog_json jsonb;
begin
  if tenant_id_value is null or agency_organization_id_value is null
    or not public.current_membership_has_permission('agency.pricing.view', tenant_id_value, agency_organization_id_value) then
    raise exception 'FORBIDDEN';
  end if;

  select * into agency_row
  from public.agencies agency
  where agency.tenant_id = tenant_id_value
    and agency.organization_id = agency_organization_id_value
    and agency.archived_at is null;
  if agency_row.id is null then raise exception 'ACTIVE_AGENCY_REQUIRED'; end if;

  select * into internal_version
  from public.internal_rate_versions version
  where version.tenant_id = tenant_id_value
    and version.matrix_organization_id = agency_row.matrix_organization_id
    and version.agency_organization_id = agency_organization_id_value
    and version.status = 'active'
    and version.valid_from <= now()
    and (version.valid_until is null or version.valid_until > now())
  order by version.valid_from desc, version.version desc
  limit 1;

  select * into public_version
  from public.agency_price_list_versions version
  where version.tenant_id = tenant_id_value
    and version.agency_organization_id = agency_organization_id_value
    and version.status = 'active'
    and version.valid_from <= now()
    and (version.valid_until is null or version.valid_until > now())
  order by version.valid_from desc, version.version desc
  limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
    'destinationCode', row.destination_code,
    'destinationName', row.destination_name,
    'productCode', row.product_code,
    'productName', row.product_name,
    'matrixRateCents', coalesce(internal_line.amount_cents, 0),
    'publicPriceCents', coalesce(public_line.amount_cents, 0)
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
    where country.organization_id = agency_row.matrix_organization_id
  ) row
  left join public.internal_rate_lines internal_line
    on internal_line.rate_version_id = internal_version.id
    and internal_line.destination_code = row.destination_code
    and internal_line.product_code = row.product_code
    and internal_line.concept = 'international_shipping'
  left join public.agency_price_list_lines public_line
    on public_line.price_list_version_id = public_version.id
    and public_line.destination_code = row.destination_code
    and public_line.product_code = row.product_code
    and public_line.concept = 'international_shipping';

  return jsonb_build_object(
    'agencyName', (select organization.name from public.organizations organization where organization.id = agency_organization_id_value),
    'canManage', public.current_membership_has_permission('agency.pricing.manage', tenant_id_value, agency_organization_id_value),
    'internalRateVersion', case when internal_version.id is null then null else jsonb_build_object('id', internal_version.id, 'version', internal_version.version, 'validFrom', internal_version.valid_from) end,
    'publicPriceVersion', case when public_version.id is null then null else jsonb_build_object('id', public_version.id, 'version', public_version.version, 'validFrom', public_version.valid_from) end,
    'catalog', catalog_json
  );
end;
$$;

create or replace function public.save_agency_public_prices(
  price_lines jsonb,
  idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tenant_id_value uuid := public.current_tenant_id();
  agency_organization_id_value uuid := public.current_business_organization_id();
  membership_id_value uuid := public.current_membership_id();
  agency_row public.agencies;
  operation public.idempotency_operations;
  previous_version public.agency_price_list_versions;
  new_version_id uuid;
  next_version integer;
  input_line jsonb;
  provided_prices jsonb := '{}'::jsonb;
  catalog_line record;
  amount_cents_value bigint;
  input_key text;
  lines_saved integer := 0;
  result_value jsonb;
begin
  if tenant_id_value is null or agency_organization_id_value is null or membership_id_value is null then
    raise exception 'UNAUTHENTICATED';
  end if;
  if not public.current_membership_has_permission('agency.pricing.manage', tenant_id_value, agency_organization_id_value) then
    raise exception 'FORBIDDEN';
  end if;
  if nullif(btrim(idempotency_key), '') is null or jsonb_typeof(price_lines) <> 'array' then
    raise exception 'PRICE_LINES_INVALID';
  end if;

  select * into agency_row
  from public.agencies agency
  where agency.tenant_id = tenant_id_value
    and agency.organization_id = agency_organization_id_value
    and agency.archived_at is null
  for update;
  if agency_row.id is null then raise exception 'ACTIVE_AGENCY_REQUIRED'; end if;

  insert into public.idempotency_operations (tenant_id, operation_type, idempotency_key, actor_membership_id, status)
  values (tenant_id_value, 'save_agency_public_prices', btrim(idempotency_key), membership_id_value, 'executing')
  on conflict (tenant_id, operation_type, idempotency_key) do nothing
  returning * into operation;
  if operation.id is null then
    select * into operation from public.idempotency_operations
    where tenant_id = tenant_id_value and operation_type = 'save_agency_public_prices'
      and idempotency_key = btrim(idempotency_key);
    if operation.status = 'completed' then return operation.result || jsonb_build_object('replayed', true); end if;
    raise exception 'OPERATION_IN_PROGRESS';
  end if;

  for input_line in select value from jsonb_array_elements(price_lines) loop
    if coalesce(input_line->>'destinationCode', '') = ''
      or coalesce(input_line->>'productCode', '') = ''
      or coalesce(input_line->>'amountCents', '') !~ '^\d+$' then
      raise exception 'PRICE_LINE_INVALID';
    end if;
    amount_cents_value := (input_line->>'amountCents')::bigint;
    input_key := upper(btrim(input_line->>'destinationCode')) || '::' || btrim(input_line->>'productCode');
    if provided_prices ? input_key then raise exception 'PRICE_LINE_DUPLICATED'; end if;
    provided_prices := provided_prices || jsonb_build_object(input_key, amount_cents_value);
  end loop;

  if exists (
    select 1
    from jsonb_object_keys(provided_prices) key
    where not exists (
      select 1
      from public.pricing_countries country
      join public.pricing_country_boxes box on box.country_id = country.id
      where country.organization_id = agency_row.matrix_organization_id
        and upper(country.code) || '::' || coalesce(nullif(box.catalog_key, ''), box.size) = key
    )
  ) then raise exception 'PRICE_LINE_NOT_IN_MATRIX_CATALOG'; end if;

  select * into previous_version
  from public.agency_price_list_versions version
  where version.tenant_id = tenant_id_value
    and version.agency_organization_id = agency_organization_id_value
    and version.status = 'active'
  order by version.valid_from desc, version.version desc
  limit 1
  for update;

  select coalesce(max(version.version), 0) + 1 into next_version
  from public.agency_price_list_versions version
  where version.tenant_id = tenant_id_value
    and version.agency_organization_id = agency_organization_id_value
    and version.name = 'Precio al público';

  update public.agency_price_list_versions
  set status = 'retired', valid_until = now()
  where tenant_id = tenant_id_value
    and agency_organization_id = agency_organization_id_value
    and status = 'active';

  insert into public.agency_price_list_versions (
    tenant_id, agency_organization_id, name, version, status, valid_from, created_by_membership_id
  ) values (
    tenant_id_value, agency_organization_id_value, 'Precio al público', next_version,
    'active', now(), membership_id_value
  ) returning id into new_version_id;

  for catalog_line in
    select country.code as destination_code, country.name as destination_name,
      coalesce(nullif(box.catalog_key, ''), box.size) as product_code, box.size as product_name
    from public.pricing_countries country
    join public.pricing_country_boxes box on box.country_id = country.id
    where country.organization_id = agency_row.matrix_organization_id
  loop
    amount_cents_value := coalesce((provided_prices ->> (upper(catalog_line.destination_code) || '::' || catalog_line.product_code))::bigint, 0);
    insert into public.agency_price_list_lines (
      tenant_id, price_list_version_id, destination_code, product_code, concept, amount_cents, snapshot
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
    tenant_id_value, agency_organization_id_value, auth.uid(), membership_id_value,
    'agency.public_prices.versioned', 'agency_price_list_version', new_version_id,
    case when previous_version.id is null then '{}'::jsonb else jsonb_build_object('id', previous_version.id, 'version', previous_version.version) end,
    jsonb_build_object('id', new_version_id, 'version', next_version), btrim(idempotency_key),
    jsonb_build_object('agencyId', agency_row.id, 'lineCount', lines_saved)
  );

  result_value := jsonb_build_object(
    'operationId', operation.id, 'replayed', false, 'version', next_version,
    'entities', jsonb_build_object('priceListVersionId', new_version_id, 'linesSaved', lines_saved)
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

grant execute on function public.load_agency_public_price_workspace() to authenticated;
grant execute on function public.save_agency_public_prices(jsonb, text) to authenticated;

comment on function public.save_agency_public_prices(jsonb, text) is
  'Versiona los precios al público de la agencia. La tarifa interna de la matriz solo se consulta.';
