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
begin
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

  if not found then
    raise exception 'Invoice no encontrado';
  end if;

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

grant execute on function public.collect_shipment_invoice_payment(
  uuid,
  uuid,
  numeric,
  numeric,
  text,
  text,
  text,
  timestamptz,
  jsonb,
  numeric,
  text,
  text,
  text,
  uuid
) to authenticated;

grant execute on function public.collect_shipment_invoice_payment(
  uuid,
  uuid,
  numeric,
  numeric,
  text,
  text,
  text,
  timestamptz,
  jsonb,
  numeric,
  text,
  text,
  text,
  uuid
) to service_role;
