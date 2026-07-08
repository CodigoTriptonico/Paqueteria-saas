-- Invoice counter: restrict to caller org
create or replace function public.next_organization_invoice_number(target_org_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  next_value bigint;
  caller_org uuid;
begin
  caller_org := public.current_organization_id();

  if caller_org is null then
    raise exception 'Forbidden';
  end if;

  if target_org_id is distinct from caller_org then
    raise exception 'Forbidden';
  end if;

  insert into public.organization_invoice_counters (organization_id, last_number)
  values (target_org_id, 1)
  on conflict (organization_id) do update
    set last_number = public.organization_invoice_counters.last_number + 1,
        updated_at = now()
  returning last_number into next_value;

  return next_value;
end;
$$;

-- Invoice collection: validate payment amounts server-side
create or replace function public.collect_shipment_invoice_payment(
  target_shipment_id uuid,
  target_organization_id uuid,
  next_paid numeric,
  next_profit numeric,
  next_sale_kind text,
  next_invoice_status text,
  next_accounting_status text,
  next_finalized_at timestamptz,
  next_logistics_plan jsonb,
  payment_amount numeric,
  payment_method text,
  payment_kind text,
  payment_note text,
  payment_created_by uuid
)
returns void
language plpgsql
set search_path = public
as $$
declare
  current_paid numeric;
  current_org uuid;
begin
  if payment_amount is null or payment_amount <= 0 then
    raise exception 'Monto de pago invalido';
  end if;

  select paid, organization_id
  into current_paid, current_org
  from public.shipments
  where id = target_shipment_id
  for update;

  if not found then
    raise exception 'Invoice no encontrado';
  end if;

  if current_org is distinct from target_organization_id then
    raise exception 'Forbidden';
  end if;

  if next_paid is distinct from current_paid + payment_amount then
    raise exception 'Monto de pago inconsistente';
  end if;

  update public.shipments
  set
    paid = next_paid,
    profit = next_profit,
    sale_kind = next_sale_kind,
    invoice_status = next_invoice_status,
    accounting_status = next_accounting_status,
    finalized_at = next_finalized_at,
    logistics_plan = next_logistics_plan
  where id = target_shipment_id
    and organization_id = target_organization_id;

  insert into public.shipment_payments (
    organization_id,
    shipment_id,
    amount,
    method,
    kind,
    note,
    created_by
  )
  values (
    target_organization_id,
    target_shipment_id,
    payment_amount,
    payment_method,
    payment_kind,
    coalesce(payment_note, ''),
    payment_created_by
  );
end;
$$;

-- profile_warehouses: both profile and warehouse must belong to caller org
drop policy if exists profile_warehouses_write on public.profile_warehouses;
create policy profile_warehouses_write on public.profile_warehouses for all
  using (
    public.user_has_permission('users.manage')
    and exists (
      select 1
      from public.profiles p
      where p.id = profile_id
        and p.organization_id = public.current_organization_id()
    )
    and exists (
      select 1
      from public.warehouses w
      where w.id = warehouse_id
        and w.organization_id = public.current_organization_id()
    )
  )
  with check (
    public.user_has_permission('users.manage')
    and exists (
      select 1
      from public.profiles p
      where p.id = profile_id
        and p.organization_id = public.current_organization_id()
    )
    and exists (
      select 1
      from public.warehouses w
      where w.id = warehouse_id
        and w.organization_id = public.current_organization_id()
    )
  );

-- logistics_route_stops: conductors only see stops on their assigned routes
drop policy if exists logistics_route_stops_select on public.logistics_route_stops;
create policy logistics_route_stops_select on public.logistics_route_stops for select
  using (
    organization_id = public.current_organization_id()
    and public.user_has_permission('routes.view')
    and (
      public.current_role_slug() <> 'conductor'
      or exists (
        select 1
        from public.logistics_routes r
        where r.id = route_id
          and r.assigned_to = auth.uid()
      )
    )
  );

-- Private storage buckets (serve via signed URLs from app)
update storage.buckets
set public = false
where id in ('logistics-vehicle-photos', 'logistics-task-evidence');

-- Shipment list filter index
create index if not exists idx_shipments_org_status
  on public.shipments (organization_id, status);
