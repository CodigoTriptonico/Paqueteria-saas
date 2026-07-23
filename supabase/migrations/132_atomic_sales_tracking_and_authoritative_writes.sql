-- Atomic legacy sale command, expiring bearer tracking tokens, and authoritative
-- write boundaries for shipment money, payments, and inventory quantities.

create table if not exists public.shipment_sale_operations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  idempotency_key text not null,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  shipment_id uuid references public.shipments(id) on delete restrict,
  result jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (organization_id, idempotency_key)
);

alter table public.shipment_sale_operations enable row level security;
revoke all on table public.shipment_sale_operations from public, anon, authenticated;

create table if not exists public.security_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  tenant_id uuid references public.business_tenants(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  previous_state jsonb,
  next_state jsonb,
  reason text not null default '',
  operation_key text,
  context jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists idx_security_audit_events_scope_time
  on public.security_audit_events(organization_id, occurred_at desc);
create index if not exists idx_security_audit_events_entity
  on public.security_audit_events(entity_type, entity_id, occurred_at desc);

alter table public.security_audit_events enable row level security;
revoke all on table public.security_audit_events from public, anon, authenticated;
grant select on table public.security_audit_events to service_role;

alter table public.shipments
  add column if not exists public_tracking_token_hash text,
  add column if not exists public_tracking_expires_at timestamptz,
  add column if not exists public_tracking_revoked_at timestamptz;

create unique index if not exists idx_shipments_public_tracking_token_hash
  on public.shipments(public_tracking_token_hash)
  where public_tracking_token_hash is not null;

create or replace function public.create_shipment_sale_atomic(
  p_command jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_org_id uuid := nullif(p_command->>'organizationId', '')::uuid;
  v_actor_id uuid := nullif(p_command->>'actorId', '')::uuid;
  v_customer_id uuid := nullif(p_command->>'customerId', '')::uuid;
  v_recipient_id uuid := nullif(p_command->>'recipientId', '')::uuid;
  v_shipment_id uuid;
  v_tenant_id uuid;
  v_operation public.shipment_sale_operations%rowtype;
  v_line jsonb;
  v_task jsonb;
  v_package jsonb;
  v_stock public.inventory_stock%rowtype;
  v_tracking_token text := nullif(p_command->>'trackingToken', '');
  v_tracking_expires_at timestamptz :=
    coalesce(nullif(p_command->>'trackingExpiresAt', '')::timestamptz, now() + interval '365 days');
  v_inventory_mode text := coalesce(p_command#>>'{inventory,mode}', '');
  v_paid_cents bigint := coalesce((p_command->>'paidCents')::bigint, 0);
  v_cost_cents bigint := coalesce((p_command->>'costCents')::bigint, 0);
  v_total_cents bigint := coalesce((p_command->>'totalCents')::bigint, 0);
  v_invoice_status text := p_command->>'invoiceStatus';
  v_logistics_plan jsonb := coalesce(p_command->'logisticsPlan', '{}'::jsonb);
  v_now timestamptz := clock_timestamp();
  v_result jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'SALE_COMMAND_SERVICE_ONLY';
  end if;
  if v_org_id is null or v_actor_id is null then
    raise exception 'SALE_COMMAND_SCOPE_REQUIRED';
  end if;
  if nullif(btrim(p_idempotency_key), '') is null or length(p_idempotency_key) > 160 then
    raise exception 'SALE_COMMAND_IDEMPOTENCY_REQUIRED';
  end if;
  if v_tracking_token is null or length(v_tracking_token) < 32 then
    raise exception 'SALE_COMMAND_TRACKING_TOKEN_INVALID';
  end if;
  if v_tracking_expires_at <= v_now or v_tracking_expires_at > v_now + interval '400 days' then
    raise exception 'SALE_COMMAND_TRACKING_EXPIRY_INVALID';
  end if;
  if v_paid_cents < 0 or v_cost_cents < 0 or v_total_cents < 0
     or v_paid_cents > v_total_cents then
    raise exception 'SALE_COMMAND_AMOUNT_INVALID';
  end if;
  if v_invoice_status not in ('open', 'paid') then
    raise exception 'SALE_COMMAND_INVOICE_STATUS_INVALID';
  end if;
  if (v_invoice_status = 'paid') is distinct from (v_total_cents > 0 and v_paid_cents >= v_total_cents) then
    raise exception 'SALE_COMMAND_INVOICE_STATE_MISMATCH';
  end if;

  select organization.tenant_id
    into v_tenant_id
  from public.organizations organization
  where organization.id = v_org_id
    and coalesce(organization.organization_status, 'active') = 'active';
  if not found then
    raise exception 'SALE_COMMAND_ORGANIZATION_INVALID';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    join public.role_permissions role_permission
      on role_permission.role_id = profile.role_id
     and role_permission.granted = true
    join public.permissions permission
      on permission.id = role_permission.permission_id
    where profile.id = v_actor_id
      and profile.organization_id = v_org_id
      and profile.is_active = true
      and permission.key in ('all', 'sales.manage')
  ) then
    raise exception 'SALE_COMMAND_ACTOR_FORBIDDEN';
  end if;

  if v_customer_id is not null and not exists (
    select 1 from public.customers customer
    where customer.id = v_customer_id and customer.organization_id = v_org_id
  ) then
    raise exception 'SALE_COMMAND_CUSTOMER_SCOPE_MISMATCH';
  end if;
  if v_recipient_id is not null and not exists (
    select 1 from public.customer_recipients recipient
    where recipient.id = v_recipient_id and recipient.organization_id = v_org_id
  ) then
    raise exception 'SALE_COMMAND_RECIPIENT_SCOPE_MISMATCH';
  end if;

  insert into public.shipment_sale_operations(
    organization_id, idempotency_key, actor_id
  ) values (
    v_org_id, btrim(p_idempotency_key), v_actor_id
  )
  on conflict (organization_id, idempotency_key) do nothing;

  select *
    into v_operation
  from public.shipment_sale_operations
  where organization_id = v_org_id
    and idempotency_key = btrim(p_idempotency_key)
  for update;

  if v_operation.actor_id <> v_actor_id then
    raise exception 'SALE_COMMAND_IDEMPOTENCY_ACTOR_MISMATCH';
  end if;
  if v_operation.result is not null then
    return v_operation.result || jsonb_build_object('replayed', true);
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_org_id::text || ':' || (p_command->>'invoiceNumber'), 0));
  if exists (
    select 1 from public.shipments shipment
    where shipment.organization_id = v_org_id
      and shipment.code = p_command->>'invoiceNumber'
  ) then
    raise exception 'SALE_COMMAND_INVOICE_ALREADY_EXISTS';
  end if;

  if v_inventory_mode in ('reserve', 'deduct') then
    for v_line in
      select value from jsonb_array_elements(coalesce(p_command#>'{inventory,lines}', '[]'::jsonb))
    loop
      if coalesce((v_line->>'qty')::numeric, 0) <= 0 then
        raise exception 'SALE_COMMAND_INVENTORY_QUANTITY_INVALID';
      end if;
      select *
        into v_stock
      from public.inventory_stock stock
      where stock.organization_id = v_org_id
        and stock.warehouse_id = (v_line->>'warehouseId')::uuid
        and stock.item_id = (v_line->>'itemId')::uuid
      for update;
      if v_stock.id is null then
        raise exception 'SALE_COMMAND_INVENTORY_SCOPE_MISMATCH';
      end if;
      if v_inventory_mode = 'reserve'
         and v_stock.stock - v_stock.reserved < (v_line->>'qty')::numeric then
        raise exception 'SALE_COMMAND_INVENTORY_INSUFFICIENT';
      end if;
      if v_inventory_mode = 'deduct'
         and v_stock.stock < (v_line->>'qty')::numeric then
        raise exception 'SALE_COMMAND_INVENTORY_INSUFFICIENT';
      end if;
    end loop;
  end if;

  if v_inventory_mode = 'reserve' then
    v_logistics_plan := jsonb_set(
      jsonb_set(v_logistics_plan, '{emptyBox,stockReserved}', 'true'::jsonb, true),
      '{emptyBox,stockReservedAt}', to_jsonb(v_now), true
    );
  elsif v_inventory_mode = 'deduct' then
    v_logistics_plan := jsonb_set(
      v_logistics_plan, '{emptyBox,stockDeductedAt}', to_jsonb(v_now), true
    );
  end if;

  insert into public.shipments(
    organization_id, code, customer_name, country, carrier, paid, profit, status,
    created_by, sales_owner_id, customer_id, recipient_id, recipient_snapshot,
    sale_kind, delivery_notes, logistics_plan, invoice_status, accounting_status,
    finalized_at, empty_box_delivered_at, public_tracking_token_hash,
    public_tracking_expires_at
  ) values (
    v_org_id,
    btrim(p_command->>'invoiceNumber'),
    btrim(p_command->>'customerName'),
    btrim(p_command->>'country'),
    coalesce(nullif(btrim(p_command->>'carrier'), ''), 'Sin carrier'),
    v_paid_cents::numeric / 100,
    case when v_invoice_status = 'paid'
      then greatest(v_paid_cents - v_cost_cents, 0)::numeric / 100 else 0 end,
    p_command->>'status',
    v_actor_id,
    v_actor_id,
    v_customer_id,
    v_recipient_id,
    coalesce(p_command->'recipientSnapshot', '{}'::jsonb),
    p_command->>'saleKind',
    coalesce(p_command->>'deliveryNotes', ''),
    v_logistics_plan,
    v_invoice_status,
    case when v_invoice_status = 'paid' then 'exportable' else 'not_exportable' end,
    case when v_invoice_status = 'paid' then v_now else null end,
    case when v_inventory_mode = 'deduct' then v_now else null end,
    encode(extensions.digest(v_tracking_token::text, 'sha256'::text), 'hex'),
    v_tracking_expires_at
  )
  returning id into v_shipment_id;

  for v_package in
    select value from jsonb_array_elements(coalesce(p_command->'packages', '[]'::jsonb))
  loop
    insert into public.shipment_packages(
      organization_id, shipment_id, code, country, invoice_code,
      invoice_created_by, invoice_paid_by
    ) values (
      v_org_id, v_shipment_id, v_package->>'code', p_command->>'country',
      v_package->>'invoiceCode', v_actor_id,
      case when v_invoice_status = 'paid' then v_actor_id else null end
    );
  end loop;

  if v_paid_cents > 0 then
    insert into public.shipment_payments(
      organization_id, shipment_id, amount, method, kind, note, created_by
    ) values (
      v_org_id, v_shipment_id, v_paid_cents::numeric / 100,
      p_command->>'paymentMethod',
      case when v_invoice_status = 'paid' then 'full' else 'deposit' end,
      coalesce(p_command->>'paymentNote', ''), v_actor_id
    );
  end if;

  for v_task in
    select value from jsonb_array_elements(coalesce(p_command->'logisticsTasks', '[]'::jsonb))
  loop
    if nullif(v_task->>'warehouseId', '') is not null and not exists (
      select 1 from public.warehouses warehouse
      where warehouse.id = (v_task->>'warehouseId')::uuid
        and warehouse.organization_id = v_org_id
        and warehouse.is_active = true
    ) then
      raise exception 'SALE_COMMAND_WAREHOUSE_SCOPE_MISMATCH';
    end if;
    insert into public.shipment_logistics_tasks(
      organization_id, shipment_id, task_type, status, scheduled_at,
      requested_schedule_at, schedule_confirmation_status, schedule_kind,
      window_start_at, window_end_at, warehouse_id, notes
    ) values (
      v_org_id, v_shipment_id, v_task->>'taskType', v_task->>'status',
      nullif(v_task->>'scheduledAt', '')::timestamptz,
      nullif(v_task->>'requestedScheduleAt', '')::timestamptz,
      coalesce(v_task->>'scheduleConfirmationStatus', 'confirmed'),
      nullif(v_task->>'scheduleKind', ''),
      nullif(v_task->>'windowStartAt', '')::timestamptz,
      nullif(v_task->>'windowEndAt', '')::timestamptz,
      nullif(v_task->>'warehouseId', '')::uuid,
      coalesce(v_task->>'notes', '')
    );
  end loop;

  if v_inventory_mode in ('reserve', 'deduct') then
    for v_line in
      select value from jsonb_array_elements(coalesce(p_command#>'{inventory,lines}', '[]'::jsonb))
    loop
      if v_inventory_mode = 'reserve' then
        update public.inventory_stock
        set reserved = reserved + (v_line->>'qty')::numeric
        where organization_id = v_org_id
          and warehouse_id = (v_line->>'warehouseId')::uuid
          and item_id = (v_line->>'itemId')::uuid;
        insert into public.inventory_sale_reservations(
          organization_id, shipment_id, warehouse_id, item_id, item_name,
          qty, status, created_by
        ) values (
          v_org_id, v_shipment_id, (v_line->>'warehouseId')::uuid,
          (v_line->>'itemId')::uuid, v_line->>'itemName',
          (v_line->>'qty')::numeric, 'active', v_actor_id
        );
      else
        update public.inventory_stock
        set stock = stock - (v_line->>'qty')::numeric
        where organization_id = v_org_id
          and warehouse_id = (v_line->>'warehouseId')::uuid
          and item_id = (v_line->>'itemId')::uuid;
        insert into public.inventory_movements(
          organization_id, warehouse_id, item_id, item_name, type, qty, note,
          created_by, assignee_id, reason_code, reference_type, reference_id,
          movement_key
        ) values (
          v_org_id, (v_line->>'warehouseId')::uuid, (v_line->>'itemId')::uuid,
          v_line->>'itemName', 'salida', (v_line->>'qty')::numeric,
          'Caja vacia entregada en mostrador ' || (p_command->>'invoiceNumber'),
          v_actor_id, v_actor_id, 'sale_counter_handoff', 'shipment', v_shipment_id,
          'sale:' || v_shipment_id::text || ':' || (v_line->>'itemId')
        );
      end if;
    end loop;
  end if;

  insert into public.activity_history(
    organization_id, actor_id, actor_name, action, entity_type, entity_id,
    title, description, metadata
  ) values (
    v_org_id, v_actor_id, coalesce(p_command->>'actorName', ''),
    case when v_invoice_status = 'open' then 'sale.open_invoice_created'
      when p_command->>'saleKind' = 'empty_box_deposit' then 'sale.empty_box_deposit'
      else 'sale.created' end,
    'shipment', v_shipment_id, 'Venta registrada: ' || (p_command->>'invoiceNumber'),
    coalesce(p_command->>'deliveryNotes', ''),
    jsonb_build_object(
      'paidCents', v_paid_cents, 'costCents', v_cost_cents,
      'totalCents', v_total_cents, 'invoiceStatus', v_invoice_status,
      'saleKind', p_command->>'saleKind', 'operationKey', p_idempotency_key
    )
  );

  insert into public.security_audit_events(
    actor_id, tenant_id, organization_id, entity_type, entity_id, action,
    next_state, reason, operation_key, context
  ) values (
    v_actor_id, v_tenant_id, v_org_id, 'shipment', v_shipment_id,
    'shipment.sale.created',
    jsonb_build_object(
      'invoiceStatus', v_invoice_status, 'paidCents', v_paid_cents,
      'totalCents', v_total_cents, 'inventoryMode', nullif(v_inventory_mode, '')
    ),
    coalesce(p_command->>'paymentNote', ''), p_idempotency_key,
    jsonb_build_object('source', 'create_shipment_sale_atomic')
  );

  v_result := jsonb_build_object(
    'shipmentId', v_shipment_id,
    'trackingToken', v_tracking_token,
    'trackingExpiresAt', v_tracking_expires_at,
    'replayed', false
  );
  update public.shipment_sale_operations
  set shipment_id = v_shipment_id, result = v_result, completed_at = now()
  where id = v_operation.id;
  return v_result;
end;
$$;

revoke execute on function public.create_shipment_sale_atomic(jsonb, text)
  from public, anon, authenticated;
grant execute on function public.create_shipment_sale_atomic(jsonb, text)
  to service_role;

create or replace function public.guard_authoritative_shipment_writes()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if auth.role() <> 'authenticated' then
    return coalesce(new, old);
  end if;
  if tg_op in ('INSERT', 'DELETE') then
    raise exception 'SHIPMENT_COMMAND_REQUIRED';
  end if;
  if new.paid is distinct from old.paid
    or new.profit is distinct from old.profit
    or new.invoice_status is distinct from old.invoice_status
    or new.accounting_status is distinct from old.accounting_status
    or new.finalized_at is distinct from old.finalized_at
    or new.logistics_plan is distinct from old.logistics_plan
    or new.public_tracking_token_hash is distinct from old.public_tracking_token_hash
    or new.public_tracking_expires_at is distinct from old.public_tracking_expires_at
    or new.public_tracking_revoked_at is distinct from old.public_tracking_revoked_at
  then
    raise exception 'SHIPMENT_AUTHORITATIVE_COLUMNS_COMMAND_REQUIRED';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_authoritative_shipment_writes()
  from public, anon, authenticated;
drop trigger if exists shipments_authoritative_write_guard on public.shipments;
create trigger shipments_authoritative_write_guard
before insert or update or delete on public.shipments
for each row execute function public.guard_authoritative_shipment_writes();

create or replace function public.guard_inventory_stock_direct_write()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if auth.role() <> 'authenticated' then
    return coalesce(new, old);
  end if;
  if tg_op = 'INSERT' then
    if coalesce(new.stock, 0) <> 0 or coalesce(new.reserved, 0) <> 0
       or coalesce(new.assigned, 0) <> 0 or coalesce(new.unavailable, 0) <> 0 then
      raise exception 'INVENTORY_MOVEMENT_COMMAND_REQUIRED';
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    if coalesce(old.stock, 0) <> 0 or coalesce(old.reserved, 0) <> 0
       or coalesce(old.assigned, 0) <> 0 or coalesce(old.unavailable, 0) <> 0 then
      raise exception 'INVENTORY_STOCK_WITH_BALANCE_IMMUTABLE';
    end if;
    return old;
  end if;
  if new.stock is distinct from old.stock
    or new.reserved is distinct from old.reserved
    or new.assigned is distinct from old.assigned
    or new.unavailable is distinct from old.unavailable
    or new.avg_cost is distinct from old.avg_cost
  then
    raise exception 'INVENTORY_MOVEMENT_COMMAND_REQUIRED';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_inventory_stock_direct_write()
  from public, anon, authenticated;
drop trigger if exists inventory_stock_direct_write_guard on public.inventory_stock;
create trigger inventory_stock_direct_write_guard
before insert or update or delete on public.inventory_stock
for each row execute function public.guard_inventory_stock_direct_write();

drop policy if exists shipment_payments_write on public.shipment_payments;
revoke insert, update, delete on table public.shipment_payments from authenticated;

-- Immutable audit and idempotency ledgers are command-only.
create or replace function public.reject_immutable_security_row_change()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'IMMUTABLE_SECURITY_LEDGER';
end;
$$;

revoke execute on function public.reject_immutable_security_row_change()
  from public, anon, authenticated;
drop trigger if exists security_audit_events_immutable on public.security_audit_events;
create trigger security_audit_events_immutable
before update or delete on public.security_audit_events
for each row execute function public.reject_immutable_security_row_change();
drop trigger if exists shipment_sale_operations_immutable on public.shipment_sale_operations;
create trigger shipment_sale_operations_immutable
before delete on public.shipment_sale_operations
for each row execute function public.reject_immutable_security_row_change();
