-- Keep the conductor's collection decision auditable, including an explicit no-cash result.
alter table public.shipment_logistics_task_attempts
  add column if not exists payment_expected_amount numeric,
  add column if not exists payment_outcome text not null default 'not_applicable'
    check (payment_outcome in ('collected', 'not_collected', 'not_applicable'));

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
  next_total numeric;
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

  next_total := nullif(regexp_replace(coalesce(next_logistics_plan #>> '{billing,quotedTotal}', ''), '[^0-9.-]', '', 'g'), '')::numeric;
  if next_total is not null and next_total < next_paid then
    raise exception 'Total de invoice inconsistente';
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
