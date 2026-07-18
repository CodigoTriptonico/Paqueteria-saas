-- Closed agency dates accept corrections only as current-day reversal facts.
-- The historical sale/payment fact is never edited in place.

create or replace function public.assert_agency_daily_close_open(
  target_organization_id uuid,
  target_occurred_at timestamptz
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_organization_id is null or target_occurred_at is null then
    return;
  end if;

  if not exists (
    select 1 from public.organizations
    where id = target_organization_id and organization_type = 'agency'
  ) then
    return;
  end if;

  if exists (
    select 1
    from public.agency_daily_closures closure
    where closure.organization_id = target_organization_id
      and closure.status = 'closed'
      and closure.operating_date = (target_occurred_at at time zone closure.timezone)::date
  ) then
    raise exception 'AGENCY_DAILY_CLOSE_LOCKED';
  end if;
end;
$$;

create or replace function public.guard_agency_sale_daily_close()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_agency_daily_close_open(new.selling_organization_id, new.created_at);
  return new;
end;
$$;

create or replace function public.guard_agency_customer_payment_daily_close()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_agency_daily_close_open(new.organization_id, new.received_at);
  return new;
end;
$$;

create or replace function public.guard_agency_matrix_payment_daily_close()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_agency_daily_close_open(new.agency_organization_id, new.received_at);
  return new;
end;
$$;

drop trigger if exists sales_agency_daily_close_guard on public.sales;
create trigger sales_agency_daily_close_guard
  before insert on public.sales
  for each row execute function public.guard_agency_sale_daily_close();

drop trigger if exists customer_payments_agency_daily_close_guard on public.customer_payments;
create trigger customer_payments_agency_daily_close_guard
  before insert on public.customer_payments
  for each row execute function public.guard_agency_customer_payment_daily_close();

drop trigger if exists agency_payments_agency_daily_close_guard on public.agency_payments;
create trigger agency_payments_agency_daily_close_guard
  before insert on public.agency_payments
  for each row execute function public.guard_agency_matrix_payment_daily_close();

-- Payments are operationally dated by receipt, not by database insertion time.
create or replace function public.agency_daily_close_summary(target_organization_id uuid, target_date date, target_timezone text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare start_at timestamptz; end_at timestamptz;
begin
  start_at := (target_date::timestamp at time zone target_timezone);
  end_at := ((target_date + 1)::timestamp at time zone target_timezone);
  return jsonb_build_object(
    'salesCount', (select count(*) from public.sales where selling_organization_id = target_organization_id and created_at >= start_at and created_at < end_at and status = 'confirmed'),
    'salesCents', (select coalesce(sum(total_cents), 0) from public.sales where selling_organization_id = target_organization_id and created_at >= start_at and created_at < end_at and status = 'confirmed'),
    'customerPaymentsCents', (select coalesce(sum(amount_cents), 0) from public.customer_payments where organization_id = target_organization_id and received_at >= start_at and received_at < end_at),
    'expectedCashCents', (select coalesce(sum(amount_cents), 0) from public.customer_payments where organization_id = target_organization_id and received_at >= start_at and received_at < end_at and lower(method) = 'cash'),
    'agencyPaymentsCents', (select coalesce(sum(amount_cents), 0) from public.agency_payments where agency_organization_id = target_organization_id and received_at >= start_at and received_at < end_at),
    'shipmentsCreated', (select count(*) from public.shipments where organization_id = target_organization_id and created_at >= start_at and created_at < end_at),
    'pendingCustody', (select count(*) from public.package_custody_handoffs where organization_id = target_organization_id and status = 'pending'),
    'openExceptions', (select count(*) from public.operational_exceptions where organization_id = target_organization_id and status in ('open', 'in_resolution', 'pending_approval'))
  );
end;
$$;
