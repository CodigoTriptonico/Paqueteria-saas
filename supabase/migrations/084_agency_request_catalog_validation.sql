-- An agency may request only box types belonging to its matrix organization.
-- This keeps the browser selector convenient without trusting its identifiers.

create or replace function public.create_agency_service_request(lines jsonb, requested_date date, note text, idempotency_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  tenant uuid := public.current_tenant_id();
  membership uuid := public.current_membership_id();
  agency_row public.agencies;
  request_id uuid;
  line jsonb;
  operation public.idempotency_operations;
  inventory_item uuid;
  matrix_warehouse uuid;
begin
  if tenant is null or membership is null or jsonb_typeof(lines) <> 'array' or jsonb_array_length(lines) = 0 then raise exception 'SOLICITUD_INVALIDA'; end if;
  select agency.* into agency_row from public.agencies agency where agency.tenant_id = tenant and agency.organization_id = public.current_business_organization_id() and agency.archived_at is null;
  if agency_row.id is null or not public.current_membership_has_permission('agency.requests.create', tenant, agency_row.organization_id) then raise exception 'FORBIDDEN'; end if;
  insert into public.idempotency_operations(tenant_id, operation_type, idempotency_key, actor_membership_id, status)
  values(tenant, 'create_agency_service_request', btrim(idempotency_key), membership, 'executing')
  on conflict(tenant_id, operation_type, idempotency_key) do nothing returning * into operation;
  if operation.id is null then
    select * into operation from public.idempotency_operations where tenant_id = tenant and operation_type = 'create_agency_service_request' and idempotency_key = btrim(idempotency_key);
    if operation.status = 'completed' then return operation.result || jsonb_build_object('replayed', true); end if;
    raise exception 'OPERATION_IN_PROGRESS';
  end if;
  insert into public.agency_service_requests(tenant_id, organization_id, agency_id, code, status, requested_service_date, address_snapshot, notes, created_by_membership_id)
  values(tenant, agency_row.organization_id, agency_row.id, 'AG-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)), 'submitted', requested_date, '{}'::jsonb, left(coalesce(note, ''), 1000), membership)
  returning id into request_id;
  for line in select value from jsonb_array_elements(lines) loop
    if coalesce((line->>'quantity')::integer, 0) <= 0 or coalesce(line->>'serviceKind', '') not in ('empty_box_delivery', 'full_box_pickup') then raise exception 'LINEA_INVALIDA'; end if;
    inventory_item := nullif(line->>'inventoryItemId', '')::uuid;
    matrix_warehouse := nullif(line->>'warehouseId', '')::uuid;
    if inventory_item is null or not exists (select 1 from public.inventory_items item where item.id = inventory_item and item.organization_id = agency_row.matrix_organization_id) then
      raise exception 'CAJA_DE_MATRIZ_INVALIDA';
    end if;
    if coalesce(line->>'serviceKind', '') = 'empty_box_delivery' and (
      matrix_warehouse is null
      or nullif(btrim(coalesce(line->>'productKey', '')), '') is null
      or nullif(btrim(coalesce(line->>'boxSize', '')), '') is null
      or not exists (select 1 from public.warehouses warehouse where warehouse.id = matrix_warehouse and warehouse.organization_id = agency_row.matrix_organization_id)
    ) then raise exception 'CAJA_DE_MATRIZ_INVALIDA'; end if;
    insert into public.agency_service_request_lines(tenant_id, organization_id, request_id, service_kind, requested_quantity, inventory_item_id, matrix_warehouse_id, product_key, box_size, unit_charge_amount_cents, currency, details)
    values(tenant, agency_row.organization_id, request_id, line->>'serviceKind', (line->>'quantity')::integer,
      inventory_item, matrix_warehouse,
      coalesce(line->>'productKey', ''), coalesce(line->>'boxSize', ''), coalesce((line->>'unitChargeAmountCents')::bigint, 0), 'USD', coalesce(line->'details', '{}'::jsonb));
  end loop;
  update public.idempotency_operations set status = 'completed', result = jsonb_build_object('requestId', request_id, 'replayed', false), completed_at = now() where id = operation.id;
  return jsonb_build_object('requestId', request_id, 'replayed', false);
end;
$$;

grant execute on function public.create_agency_service_request(jsonb,date,text,text) to authenticated;
