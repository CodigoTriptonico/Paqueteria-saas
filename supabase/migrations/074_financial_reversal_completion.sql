-- Complete the financial reversal RPC after 071 was applied. Keeping this as a
-- new migration prevents drift between an already-applied migration and source.

create or replace function public.reverse_financial_event(command jsonb, idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tenant_id_value uuid := public.current_tenant_id();
  matrix_org_id uuid := public.current_business_organization_id();
  membership_id_value uuid := public.current_membership_id();
  target_type_value text := command->>'targetType';
  target_id_value uuid := nullif(command->>'targetId', '')::uuid;
  reason_value text := btrim(coalesce(command->>'reason', ''));
  operation public.idempotency_operations;
  charge_row public.agency_charges;
  payment_row public.agency_payments;
  customer_payment_row public.customer_payments;
  credit_row public.agency_credits;
  adjustment_row public.agency_adjustments;
  settlement_row public.driver_settlements;
  reversal_id_value uuid;
  application public.agency_payment_applications;
  customer_application public.customer_payment_applications;
  result_value jsonb;
begin
  if tenant_id_value is null or matrix_org_id is null then raise exception 'UNAUTHENTICATED'; end if;
  operation := public.finance_begin_operation(tenant_id_value, 'reverse_financial_event', idempotency_key);
  if operation.status = 'completed' then return jsonb_set(operation.result, '{replayed}', 'true'::jsonb, true); end if;
  if operation.actor_membership_id is distinct from membership_id_value then raise exception 'IDEMPOTENCY_KEY_IN_USE'; end if;
  if reason_value = '' then raise exception 'REVERSAL_REASON_REQUIRED'; end if;
  if target_type_value = 'charge' then
    if not public.current_membership_has_permission('accounting.reverse', tenant_id_value, matrix_org_id) then raise exception 'FORBIDDEN'; end if;
    select * into charge_row from public.agency_charges
    where id = target_id_value and tenant_id = tenant_id_value and matrix_organization_id = matrix_org_id for update;
    if charge_row.id is null then raise exception 'CHARGE_NOT_FOUND'; end if;
    if exists (
      select 1 from public.agency_payment_applications application
      where application.charge_id = charge_row.id
        and not exists (select 1 from public.agency_payment_application_reversals reversal where reversal.application_id = application.id)
    ) then raise exception 'REVERSE_APPLICATIONS_FIRST'; end if;
    if exists (
      select 1 from public.agency_credits credit where credit.charge_id = charge_row.id
        and not exists (select 1 from public.agency_financial_reversals reversal where reversal.target_type = 'credit' and reversal.target_id = credit.id)
    ) or exists (
      select 1 from public.agency_adjustments adjustment where adjustment.charge_id = charge_row.id
        and not exists (select 1 from public.agency_financial_reversals reversal where reversal.target_type = 'adjustment' and reversal.target_id = adjustment.id)
    ) then raise exception 'REVERSE_CHILD_EVENTS_FIRST'; end if;
    insert into public.agency_financial_reversals(
      tenant_id, matrix_organization_id, agency_organization_id, target_type, target_id,
      amount_cents, reason, created_by_membership_id, idempotency_key
    ) values (
      tenant_id_value, matrix_org_id, charge_row.agency_organization_id, 'charge', charge_row.id,
      charge_row.amount_cents, reason_value, membership_id_value, idempotency_key
    ) returning id into reversal_id_value;
    perform public.finance_reverse_journal('agency_charge', charge_row.id, reversal_id_value, reason_value, membership_id_value);
    insert into public.financial_hold_events(tenant_id, hold_id, status, reason, actor_membership_id)
    select tenant_id_value, hold.id, 'cancelled', reason_value, membership_id_value
    from public.financial_holds hold
    join public.current_financial_holds current_hold on current_hold.id = hold.id and current_hold.status = 'active'
    where hold.agency_charge_id = charge_row.id;
  elsif target_type_value = 'credit' then
    if not public.current_membership_has_permission('accounting.reverse', tenant_id_value, matrix_org_id) then raise exception 'FORBIDDEN'; end if;
    select * into credit_row from public.agency_credits
    where id = target_id_value and tenant_id = tenant_id_value and matrix_organization_id = matrix_org_id for update;
    if credit_row.id is null then raise exception 'CREDIT_NOT_FOUND'; end if;
    insert into public.agency_financial_reversals(
      tenant_id, matrix_organization_id, agency_organization_id, target_type, target_id,
      amount_cents, reason, created_by_membership_id, idempotency_key
    ) values (
      tenant_id_value, matrix_org_id, credit_row.agency_organization_id, 'credit', credit_row.id,
      credit_row.amount_cents, reason_value, membership_id_value, idempotency_key
    ) returning id into reversal_id_value;
    perform public.finance_reverse_journal('agency_credit', credit_row.id, reversal_id_value, reason_value, membership_id_value);
    perform public.finance_sync_hold_for_charge(credit_row.charge_id, membership_id_value, reason_value);
  elsif target_type_value = 'adjustment' then
    if not public.current_membership_has_permission('accounting.reverse', tenant_id_value, matrix_org_id) then raise exception 'FORBIDDEN'; end if;
    select * into adjustment_row from public.agency_adjustments
    where id = target_id_value and tenant_id = tenant_id_value and matrix_organization_id = matrix_org_id for update;
    if adjustment_row.id is null then raise exception 'ADJUSTMENT_NOT_FOUND'; end if;
    insert into public.agency_financial_reversals(
      tenant_id, matrix_organization_id, agency_organization_id, target_type, target_id,
      amount_cents, reason, created_by_membership_id, idempotency_key
    ) values (
      tenant_id_value, matrix_org_id, adjustment_row.agency_organization_id, 'adjustment', adjustment_row.id,
      abs(adjustment_row.amount_cents), reason_value, membership_id_value, idempotency_key
    ) returning id into reversal_id_value;
    perform public.finance_reverse_journal('agency_adjustment', adjustment_row.id, reversal_id_value, reason_value, membership_id_value);
    perform public.finance_sync_hold_for_charge(adjustment_row.charge_id, membership_id_value, reason_value);
  elsif target_type_value = 'payment' then
    if not public.current_membership_has_permission('accounting.reverse', tenant_id_value, matrix_org_id) then raise exception 'FORBIDDEN'; end if;
    select * into payment_row from public.agency_payments
    where id = target_id_value and tenant_id = tenant_id_value and matrix_organization_id = matrix_org_id for update;
    if payment_row.id is null then raise exception 'PAYMENT_NOT_FOUND'; end if;
    for application in
      select a.* from public.agency_payment_applications a
      where a.payment_id = payment_row.id
        and not exists (select 1 from public.agency_payment_application_reversals r where r.application_id = a.id)
    loop
      insert into public.agency_payment_application_reversals(
        tenant_id, application_id, reason, created_by_membership_id
      ) values (tenant_id_value, application.id, reason_value, membership_id_value);
    end loop;
    insert into public.agency_financial_reversals(
      tenant_id, matrix_organization_id, agency_organization_id, target_type, target_id,
      amount_cents, reason, created_by_membership_id, idempotency_key
    ) values (
      tenant_id_value, matrix_org_id, payment_row.agency_organization_id, 'payment', payment_row.id,
      payment_row.amount_cents, reason_value, membership_id_value, idempotency_key
    ) returning id into reversal_id_value;
    perform public.finance_reverse_journal('agency_payment', payment_row.id, reversal_id_value, reason_value, membership_id_value);
  elsif target_type_value = 'customer_payment' then
    if not public.current_membership_has_permission('agency.customer_finance.collect', tenant_id_value, matrix_org_id) then raise exception 'FORBIDDEN'; end if;
    select * into customer_payment_row from public.customer_payments
    where id = target_id_value and tenant_id = tenant_id_value and organization_id = matrix_org_id for update;
    if customer_payment_row.id is null then raise exception 'CUSTOMER_PAYMENT_NOT_FOUND'; end if;
    for customer_application in
      select a.* from public.customer_payment_applications a
      where a.payment_id = customer_payment_row.id
        and not exists (select 1 from public.customer_payment_application_reversals r where r.application_id = a.id)
    loop
      insert into public.customer_payment_application_reversals(
        tenant_id, organization_id, application_id, reason, created_by_membership_id
      ) values (tenant_id_value, matrix_org_id, customer_application.id, reason_value, membership_id_value);
    end loop;
    insert into public.customer_payment_reversals(
      tenant_id, organization_id, payment_id, reason, created_by_membership_id
    ) values (
      tenant_id_value, matrix_org_id, customer_payment_row.id, reason_value, membership_id_value
    ) returning id into reversal_id_value;
  elsif target_type_value = 'driver_settlement' then
    if not public.current_membership_has_permission('accounting.reverse', tenant_id_value, matrix_org_id) then raise exception 'FORBIDDEN'; end if;
    select * into settlement_row from public.driver_settlements
    where id = target_id_value and tenant_id = tenant_id_value and matrix_organization_id = matrix_org_id for update;
    if settlement_row.id is null then raise exception 'DRIVER_SETTLEMENT_NOT_FOUND'; end if;
    insert into public.driver_settlement_reversals(
      tenant_id, matrix_organization_id, settlement_id, reason,
      reversed_by_membership_id, idempotency_key
    ) values (
      tenant_id_value, matrix_org_id, settlement_row.id, reason_value,
      membership_id_value, idempotency_key
    ) returning id into reversal_id_value;
    perform public.finance_reverse_journal('driver_settlement', settlement_row.id, reversal_id_value, reason_value, membership_id_value);
  else
    raise exception 'UNSUPPORTED_REVERSAL_TARGET';
  end if;
  perform public.finance_audit(
    tenant_id_value, matrix_org_id, 'financial_event.reversed', target_type_value, target_id_value,
    jsonb_build_object('reversalId', reversal_id_value), reason_value, idempotency_key
  );
  result_value := jsonb_build_object(
    'operationId', operation.id, 'replayed', false, 'version', 1,
    'entities', jsonb_build_object('reversalId', reversal_id_value, 'targetType', target_type_value, 'targetId', target_id_value)
  );
  return public.finance_complete_operation(operation.id, result_value);
end;
$$;

revoke execute on function public.reverse_financial_event(jsonb, text) from public;
grant execute on function public.reverse_financial_event(jsonb, text) to authenticated;
