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
  entity_organization_value uuid;
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
    select agency.matrix_organization_id, agency.organization_id
      into matrix_value, entity_organization_value
    from public.agencies agency
    where agency.id = target_entity_id and agency.tenant_id = tenant_value and agency.archived_at is null;
  else
    select profile.organization_id, profile.organization_id
      into matrix_value, entity_organization_value
    from public.profiles profile
    join public.organizations organization on organization.id = profile.organization_id
    where profile.id = target_entity_id and organization.tenant_id = tenant_value
      and organization.organization_type = 'matrix' and profile.archived_at is null;
  end if;
  if matrix_value is null then raise exception 'COMMERCIAL_ENTITY_NOT_FOUND'; end if;

  if not (
    (target_audience = 'agency' and entity_organization_value = public.current_business_organization_id())
    or (target_audience = 'seller' and target_entity_id = auth.uid())
    or public.current_membership_has_permission('commercial.settings.view', tenant_value, matrix_value)
    or public.current_membership_has_permission('commercial.settings.manage', tenant_value, matrix_value)
  ) then raise exception 'FORBIDDEN'; end if;

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

comment on function public.resolve_commercial_price(text,uuid,text,text,text,text,timestamptz) is
  'Resuelve entidad > grupo > país. Solo la propia entidad o un gestor comercial autorizado puede consultar el valor.';
