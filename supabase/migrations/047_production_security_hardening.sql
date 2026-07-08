-- Production security hardening: atomic inventory, atomic pricing, rate limits, indexes

-- ---------------------------------------------------------------------------
-- inventory_movements.qty must be positive
-- ---------------------------------------------------------------------------

do $$
declare
  bad_count int;
begin
  select count(*) into bad_count
  from public.inventory_movements
  where qty is null or qty <= 0;

  if bad_count > 0 then
    raise exception
      'Migracion abortada: % movimientos con qty invalida. Corrija o respalde antes de aplicar.',
      bad_count;
  end if;
end $$;

alter table public.inventory_movements
  drop constraint if exists inventory_movements_qty_positive;

alter table public.inventory_movements
  add constraint inventory_movements_qty_positive check (qty > 0);

-- ---------------------------------------------------------------------------
-- security_rate_limits
-- ---------------------------------------------------------------------------

create table if not exists public.security_rate_limits (
  bucket text not null,
  key text not null,
  window_start timestamptz not null,
  attempt_count int not null default 1 check (attempt_count >= 0),
  primary key (bucket, key, window_start)
);

create index if not exists idx_security_rate_limits_bucket_key_window
  on public.security_rate_limits (bucket, key, window_start desc);

alter table public.security_rate_limits enable row level security;

drop policy if exists security_rate_limits_deny on public.security_rate_limits;
create policy security_rate_limits_deny on public.security_rate_limits
  for all using (false);

create or replace function public.consume_rate_limit(
  p_bucket text,
  p_key text,
  p_window_seconds int,
  p_max_attempts int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  window_start timestamptz;
  current_count int;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Forbidden';
  end if;

  if p_bucket is null or btrim(p_bucket) = ''
     or p_key is null or btrim(p_key) = ''
     or p_window_seconds is null or p_window_seconds <= 0
     or p_max_attempts is null or p_max_attempts <= 0 then
    raise exception 'Parametros de rate limit invalidos';
  end if;

  window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.security_rate_limits (bucket, key, window_start, attempt_count)
  values (p_bucket, p_key, window_start, 1)
  on conflict (bucket, key, window_start)
  do update set attempt_count = public.security_rate_limits.attempt_count + 1
  returning attempt_count into current_count;

  return current_count <= p_max_attempts;
end;
$$;

revoke execute on function public.consume_rate_limit(text, text, int, int) from public, authenticated;
grant execute on function public.consume_rate_limit(text, text, int, int) to service_role;

-- ---------------------------------------------------------------------------
-- Atomic inventory movement
-- ---------------------------------------------------------------------------

create or replace function public.record_inventory_movement_atomic(
  target_org_id uuid,
  p_warehouse_id uuid,
  p_item_id uuid,
  p_item_name text,
  p_type text,
  p_qty numeric,
  p_note text,
  p_created_by uuid,
  p_assignee_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  warehouse_org uuid;
  item_org uuid;
  stock_row public.inventory_stock%rowtype;
  next_stock numeric;
  new_movement_id uuid;
begin
  if target_org_id is null then
    raise exception 'Organizacion invalida';
  end if;

  if target_org_id is distinct from public.current_organization_id()
     and auth.role() <> 'service_role' then
    raise exception 'Forbidden';
  end if;

  if auth.role() <> 'service_role' then
    if p_type in ('entrada', 'ajuste', 'devolucion') then
      if not public.user_has_permission('inventory.adjust') then
        raise exception 'Forbidden';
      end if;
    elsif p_type = 'salida' then
      if not (
        public.user_has_permission('inventory.reserve')
        or public.user_has_permission('inventory.adjust')
      ) then
        raise exception 'Forbidden';
      end if;
    end if;
  end if;

  if p_qty is null or p_qty <= 0 then
    raise exception 'Cantidad invalida';
  end if;

  if p_type not in ('entrada', 'salida', 'ajuste', 'devolucion') then
    raise exception 'Tipo de movimiento invalido';
  end if;

  select organization_id into warehouse_org
  from public.warehouses
  where id = p_warehouse_id;

  if warehouse_org is null or warehouse_org is distinct from target_org_id then
    raise exception 'Bodega no encontrada';
  end if;

  select organization_id into item_org
  from public.inventory_items
  where id = p_item_id;

  if item_org is null or item_org is distinct from target_org_id then
    raise exception 'Item no encontrado';
  end if;

  select *
  into stock_row
  from public.inventory_stock
  where warehouse_id = p_warehouse_id
    and item_id = p_item_id
    and organization_id = target_org_id
  for update;

  if stock_row.id is null then
    raise exception 'Stock no encontrado';
  end if;

  next_stock := stock_row.stock;

  if p_type in ('entrada', 'devolucion') then
    next_stock := next_stock + p_qty;
  elsif p_type = 'salida' then
    if next_stock < p_qty then
      raise exception 'Stock insuficiente';
    end if;
    next_stock := next_stock - p_qty;
  else
    next_stock := p_qty;
  end if;

  if next_stock < 0 then
    raise exception 'Stock insuficiente';
  end if;

  update public.inventory_stock
  set stock = next_stock
  where id = stock_row.id;

  insert into public.inventory_movements (
    organization_id,
    warehouse_id,
    item_id,
    item_name,
    type,
    qty,
    note,
    created_by,
    assignee_id
  ) values (
    target_org_id,
    p_warehouse_id,
    p_item_id,
    coalesce(nullif(btrim(p_item_name), ''), 'Item'),
    p_type,
    p_qty,
    coalesce(p_note, ''),
    p_created_by,
    p_assignee_id
  )
  returning id into new_movement_id;

  return jsonb_build_object(
    'movement_id', new_movement_id,
    'stock', next_stock
  );
end;
$$;

grant execute on function public.record_inventory_movement_atomic(
  uuid, uuid, uuid, text, text, numeric, text, uuid, uuid
) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Atomic pricing replace
-- ---------------------------------------------------------------------------

create or replace function public.pricing_parse_money_amount(p_value text)
returns numeric
language plpgsql
immutable
as $$
declare
  cleaned text;
begin
  if p_value is null then
    return null;
  end if;

  cleaned := regexp_replace(btrim(p_value), '[^0-9.\-]', '', 'g');

  if cleaned = '' or cleaned = '-' or cleaned = '.' then
    return null;
  end if;

  return cleaned::numeric;
exception
  when others then
    return null;
end;
$$;

create or replace function public.replace_pricing_config(
  target_org_id uuid,
  payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
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

  -- All validation passed: replace atomically
  delete from public.distributor_country_boxes where organization_id = target_org_id;
  delete from public.pricing_promotions where organization_id = target_org_id;
  delete from public.pricing_country_boxes where organization_id = target_org_id;
  delete from public.distributors where organization_id = target_org_id;
  delete from public.pricing_countries where organization_id = target_org_id;

  idx := 0;
  for country_elem in select value from jsonb_array_elements(coalesce(payload->'countries', '[]'::jsonb))
  loop
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

-- ---------------------------------------------------------------------------
-- Shipment list index
-- ---------------------------------------------------------------------------

create index if not exists idx_shipments_org_created_at
  on public.shipments (organization_id, created_at desc);
