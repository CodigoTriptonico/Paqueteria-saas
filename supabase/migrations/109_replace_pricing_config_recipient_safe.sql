-- replace_pricing_config must not delete pricing_countries referenced by customer_recipients.

create or replace function public.replace_pricing_config(
  target_org_id uuid,
  payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  country_elem jsonb;
  box_elem jsonb;
  promo_elem jsonb;
  distributor_elem jsonb;
  country_name text;
  country_id uuid;
  distributor_name text;
  distributor_id uuid;
  distributor_country_boxes jsonb;
  distributor_box jsonb;
  country_id_map jsonb := '{}'::jsonb;
  distributor_id_map jsonb := '{}'::jsonb;
  route_cfg jsonb;
  idx int := 0;
  existing_country record;
  keep_country boolean;
begin
  if target_org_id is null then
    raise exception 'Organizacion invalida';
  end if;

  if target_org_id is distinct from public.current_organization_id()
     and auth.role() <> 'service_role' then
    raise exception 'Forbidden';
  end if;

  if auth.role() <> 'service_role' then
    if not public.user_has_permission('settings.manage') then
      raise exception 'Forbidden';
    end if;
  end if;

  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'Payload invalido';
  end if;

  if not exists (select 1 from public.organizations where id = target_org_id) then
    raise exception 'Organizacion no encontrada';
  end if;

  -- Validate countries
  if jsonb_typeof(coalesce(payload->'countries', '[]'::jsonb)) <> 'array' then
    raise exception 'Paises invalidos';
  end if;

  for country_elem in select value from jsonb_array_elements(coalesce(payload->'countries', '[]'::jsonb))
  loop
    country_name := btrim(coalesce(country_elem->>'name', ''));
    if country_name = '' or btrim(coalesce(country_elem->>'code', '')) = '' then
      raise exception 'Pais invalido';
    end if;

    if jsonb_typeof(coalesce(country_elem->'boxes', '[]'::jsonb)) <> 'array' then
      raise exception 'Cajas invalidas';
    end if;

    for box_elem in select value from jsonb_array_elements(coalesce(country_elem->'boxes', '[]'::jsonb))
    loop
      if btrim(coalesce(box_elem->>'size', '')) = '' then
        raise exception 'Tamano de caja invalido';
      end if;
      if public.pricing_parse_money_amount(box_elem->>'price') is null
         or public.pricing_parse_money_amount(box_elem->>'price') < 0 then
        raise exception 'Precio invalido';
      end if;
      if box_elem ? 'cost'
         and public.pricing_parse_money_amount(box_elem->>'cost') is not null
         and public.pricing_parse_money_amount(box_elem->>'cost') < 0 then
        raise exception 'Costo invalido';
      end if;
    end loop;
  end loop;

  -- Validate promotions (optional array)
  if jsonb_typeof(coalesce(payload->'promotions', '[]'::jsonb)) <> 'array' then
    raise exception 'Promociones invalidas';
  end if;

  for promo_elem in select value from jsonb_array_elements(coalesce(payload->'promotions', '[]'::jsonb))
  loop
    if btrim(coalesce(promo_elem->>'countryName', '')) = ''
       or btrim(coalesce(promo_elem->>'catalogKey', '')) = ''
       or btrim(coalesce(promo_elem->>'name', '')) = '' then
      raise exception 'Promocion invalida';
    end if;
  end loop;

  -- Validate distributors
  if jsonb_typeof(coalesce(payload->'distributors', '[]'::jsonb)) <> 'array' then
    raise exception 'Distribuidores invalidos';
  end if;

  for distributor_elem in select value from jsonb_array_elements(coalesce(payload->'distributors', '[]'::jsonb))
  loop
    if btrim(coalesce(distributor_elem->>'name', '')) = '' then
      raise exception 'Distribuidor invalido';
    end if;
  end loop;

  route_cfg := coalesce(payload->'routeConfig', '{}'::jsonb);

  -- Block removing countries still linked to recipients.
  for existing_country in
    select country.id, country.code, country.name
    from public.pricing_countries country
    where country.organization_id = target_org_id
  loop
    keep_country := false;

    for country_elem in select value from jsonb_array_elements(coalesce(payload->'countries', '[]'::jsonb))
    loop
      if upper(btrim(coalesce(country_elem->>'code', ''))) = upper(btrim(existing_country.code))
         or lower(btrim(coalesce(country_elem->>'name', ''))) = lower(btrim(existing_country.name)) then
        keep_country := true;
        exit;
      end if;
    end loop;

    if not keep_country and exists (
      select 1
      from public.customer_recipients recipient
      where recipient.organization_id = target_org_id
        and recipient.country_id = existing_country.id
    ) then
      raise exception 'PRICING_COUNTRY_IN_USE: %', existing_country.name;
    end if;
  end loop;

  -- All validation passed: replace child rows atomically and upsert countries in place.
  delete from public.distributor_country_boxes where organization_id = target_org_id;
  delete from public.pricing_promotions where organization_id = target_org_id;
  delete from public.pricing_country_boxes where organization_id = target_org_id;
  delete from public.distributors where organization_id = target_org_id;

  idx := 0;
  for country_elem in select value from jsonb_array_elements(coalesce(payload->'countries', '[]'::jsonb))
  loop
    country_id := null;

    select existing.id
    into country_id
    from public.pricing_countries existing
    where existing.organization_id = target_org_id
      and (
        upper(existing.code) = upper(btrim(country_elem->>'code'))
        or lower(btrim(existing.name)) = lower(btrim(country_elem->>'name'))
      )
    order by case when upper(existing.code) = upper(btrim(country_elem->>'code')) then 0 else 1 end
    limit 1;

    if country_id is not null then
      update public.pricing_countries
      set
        code = btrim(country_elem->>'code'),
        name = btrim(country_elem->>'name'),
        delivery_time = coalesce(country_elem->>'deliveryTime', ''),
        sort_order = coalesce((country_elem->>'sortOrder')::int, idx)
      where id = country_id;

      update public.customer_recipients recipient
      set country = btrim(country_elem->>'name')
      where recipient.organization_id = target_org_id
        and recipient.country_id = country_id
        and lower(btrim(recipient.country)) <> lower(btrim(country_elem->>'name'));
    else
      insert into public.pricing_countries (
        organization_id,
        code,
        name,
        delivery_time,
        sort_order
      ) values (
        target_org_id,
        btrim(country_elem->>'code'),
        btrim(country_elem->>'name'),
        coalesce(country_elem->>'deliveryTime', ''),
        coalesce((country_elem->>'sortOrder')::int, idx)
      )
      returning id into country_id;
    end if;

    country_id_map := country_id_map || jsonb_build_object(btrim(country_elem->>'name'), country_id::text);
    idx := idx + 1;

    for box_elem in select value from jsonb_array_elements(coalesce(country_elem->'boxes', '[]'::jsonb))
    loop
      insert into public.pricing_country_boxes (
        organization_id,
        country_id,
        size,
        price,
        cost,
        catalog_key
      ) values (
        target_org_id,
        country_id,
        btrim(box_elem->>'size'),
        coalesce(box_elem->>'price', '$0'),
        coalesce(box_elem->>'cost', '$0'),
        nullif(btrim(coalesce(box_elem->>'catalogKey', '')), '')
      );
    end loop;
  end loop;

  delete from public.pricing_countries country
  where country.organization_id = target_org_id
    and country.id not in (
      select (map_entry.value)::uuid
      from jsonb_each_text(country_id_map) map_entry
    )
    and not exists (
      select 1
      from public.customer_recipients recipient
      where recipient.organization_id = target_org_id
        and recipient.country_id = country.id
    );

  idx := 0;
  for promo_elem in select value from jsonb_array_elements(coalesce(payload->'promotions', '[]'::jsonb))
  loop
    country_id := (country_id_map->>btrim(promo_elem->>'countryName'))::uuid;

    if country_id is null then
      raise exception 'Pais de promocion no encontrado';
    end if;

    insert into public.pricing_promotions (
      organization_id,
      country_id,
      catalog_key,
      name,
      is_active,
      promotion_type,
      bundle_quantity,
      bundle_price,
      paid_quantity,
      discounted_quantity,
      discount_percent,
      sort_order,
      rule_json
    ) values (
      target_org_id,
      country_id,
      btrim(promo_elem->>'catalogKey'),
      btrim(promo_elem->>'name'),
      coalesce((promo_elem->>'active')::boolean, true),
      coalesce(nullif(btrim(promo_elem->>'promotionType'), ''), 'combo'),
      greatest(coalesce((promo_elem->>'bundleQuantity')::int, 2), 1),
      coalesce(promo_elem->>'bundlePrice', '$0'),
      greatest(coalesce((promo_elem->>'paidQuantity')::int, 2), 1),
      greatest(coalesce((promo_elem->>'discountedQuantity')::int, 1), 1),
      least(greatest(coalesce((promo_elem->>'discountPercent')::numeric, 100), 0), 100),
      coalesce((promo_elem->>'sortOrder')::int, idx),
      promo_elem->'ruleJson'
    );

    idx := idx + 1;
  end loop;

  for distributor_elem in select value from jsonb_array_elements(coalesce(payload->'distributors', '[]'::jsonb))
  loop
    insert into public.distributors (
      organization_id,
      name,
      contact,
      phone,
      is_active
    ) values (
      target_org_id,
      btrim(distributor_elem->>'name'),
      coalesce(distributor_elem->>'contact', ''),
      coalesce(distributor_elem->>'phone', ''),
      coalesce((distributor_elem->>'active')::boolean, true)
    )
    returning id into distributor_id;

    distributor_id_map := distributor_id_map || jsonb_build_object(
      btrim(distributor_elem->>'name'),
      distributor_id::text
    );
  end loop;

  if jsonb_typeof(coalesce(payload->'distributorPrices', '{}'::jsonb)) = 'object' then
    for distributor_name, country_elem in
      select key, value from jsonb_each(coalesce(payload->'distributorPrices', '{}'::jsonb))
    loop
      distributor_id := (distributor_id_map->>distributor_name)::uuid;
      if distributor_id is null then
        continue;
      end if;

      if jsonb_typeof(country_elem) <> 'object' then
        continue;
      end if;

      for country_name, distributor_country_boxes in
        select key, value from jsonb_each(country_elem)
      loop
        country_id := (country_id_map->>country_name)::uuid;
        if country_id is null or jsonb_typeof(distributor_country_boxes) <> 'array' then
          continue;
        end if;

        for distributor_box in select value from jsonb_array_elements(distributor_country_boxes)
        loop
          if btrim(coalesce(distributor_box->>'size', '')) = '' then
            continue;
          end if;
          if public.pricing_parse_money_amount(distributor_box->>'price') is null
             or public.pricing_parse_money_amount(distributor_box->>'price') < 0 then
            raise exception 'Precio de distribuidor invalido';
          end if;

          insert into public.distributor_country_boxes (
            organization_id,
            distributor_id,
            country_id,
            size,
            price
          ) values (
            target_org_id,
            distributor_id,
            country_id,
            btrim(distributor_box->>'size'),
            coalesce(distributor_box->>'price', '$0')
          );
        end loop;
      end loop;
    end loop;
  end if;

  insert into public.organization_route_settings (
    organization_id,
    delivery_days,
    pickup_days,
    delivery_ranges,
    pickup_ranges,
    pending_allowed,
    route_lead_time,
    linked_route_schedules,
    empty_box_delivery_fee,
    full_box_pickup_fee,
    minimum_deposit,
    logistics_fee_mode,
    updated_at
  ) values (
    target_org_id,
    coalesce(
      (select array_agg(value) from jsonb_array_elements_text(coalesce(route_cfg->'deliveryDays', '[]'::jsonb))),
      '{}'::text[]
    ),
    coalesce(
      (select array_agg(value) from jsonb_array_elements_text(coalesce(route_cfg->'pickupDays', '[]'::jsonb))),
      '{}'::text[]
    ),
    coalesce(
      (select array_agg(value) from jsonb_array_elements_text(coalesce(route_cfg->'deliveryRanges', '[]'::jsonb))),
      '{}'::text[]
    ),
    coalesce(
      (select array_agg(value) from jsonb_array_elements_text(coalesce(route_cfg->'pickupRanges', '[]'::jsonb))),
      '{}'::text[]
    ),
    coalesce((route_cfg->>'pendingAllowed')::boolean, true),
    coalesce(route_cfg->>'routeLeadTime', ''),
    coalesce((route_cfg->>'linkedRouteSchedules')::boolean, false),
    coalesce(route_cfg->>'emptyBoxDeliveryFee', '$0'),
    coalesce(route_cfg->>'fullBoxPickupFee', '$0'),
    coalesce(route_cfg->>'minimumDeposit', '$20'),
    coalesce(nullif(route_cfg->>'logisticsFeeMode', ''), 'per_trip'),
    now()
  )
  on conflict (organization_id) do update set
    delivery_days = excluded.delivery_days,
    pickup_days = excluded.pickup_days,
    delivery_ranges = excluded.delivery_ranges,
    pickup_ranges = excluded.pickup_ranges,
    pending_allowed = excluded.pending_allowed,
    route_lead_time = excluded.route_lead_time,
    linked_route_schedules = excluded.linked_route_schedules,
    empty_box_delivery_fee = excluded.empty_box_delivery_fee,
    full_box_pickup_fee = excluded.full_box_pickup_fee,
    minimum_deposit = excluded.minimum_deposit,
    logistics_fee_mode = excluded.logistics_fee_mode,
    updated_at = now();
end;
$$;

grant execute on function public.replace_pricing_config(uuid, jsonb) to authenticated, service_role;
