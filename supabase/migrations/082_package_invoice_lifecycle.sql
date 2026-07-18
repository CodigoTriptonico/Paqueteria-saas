-- Every child invoice keeps its financial and physical lifecycle separately.
-- The immutable event log is the source of the timestamp and responsible user
-- for Creada, Pagada, En bodega, En transito and Entregada.

alter table public.shipment_packages
  add column if not exists invoice_payment_status text not null default 'pending',
  add column if not exists invoice_fulfillment_status text not null default 'created',
  add column if not exists invoice_created_at timestamptz,
  add column if not exists invoice_created_by uuid references public.profiles(id) on delete set null,
  add column if not exists invoice_paid_at timestamptz,
  add column if not exists invoice_paid_by uuid references public.profiles(id) on delete set null,
  add column if not exists invoice_fulfillment_changed_at timestamptz,
  add column if not exists invoice_fulfillment_changed_by uuid references public.profiles(id) on delete set null;

alter table public.shipment_packages
  drop constraint if exists shipment_packages_invoice_payment_status_check,
  add constraint shipment_packages_invoice_payment_status_check
    check (invoice_payment_status in ('pending', 'paid')),
  drop constraint if exists shipment_packages_invoice_fulfillment_status_check,
  add constraint shipment_packages_invoice_fulfillment_status_check
    check (invoice_fulfillment_status in ('created', 'in_warehouse', 'in_transit', 'delivered'));

create table if not exists public.shipment_package_invoice_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  package_id uuid not null references public.shipment_packages(id) on delete cascade,
  state text not null check (state in ('created', 'paid', 'in_warehouse', 'in_transit', 'delivered')),
  occurred_at timestamptz not null default now(),
  changed_by uuid references public.profiles(id) on delete set null,
  source text not null default 'system',
  created_at timestamptz not null default now(),
  unique (package_id, state)
);

create index if not exists idx_shipment_package_invoice_events_package
  on public.shipment_package_invoice_events(package_id, occurred_at);

alter table public.shipment_package_invoice_events enable row level security;

create policy shipment_package_invoice_events_select on public.shipment_package_invoice_events for select
  using (
    organization_id = public.current_organization_id()
    and (
      public.user_has_permission('sales.manage')
      or public.user_has_permission('routes.view')
      or public.user_has_permission('warehouse.operations')
    )
  );

create or replace function public.record_shipment_package_invoice_event(
  target_package_id uuid,
  target_state text,
  target_occurred_at timestamptz,
  target_changed_by uuid,
  target_source text default 'system'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  package_row public.shipment_packages;
  effective_at timestamptz := coalesce(target_occurred_at, now());
begin
  if target_state not in ('created', 'paid', 'in_warehouse', 'in_transit', 'delivered') then
    raise exception 'PACKAGE_INVOICE_STATE_INVALID';
  end if;

  select * into package_row
  from public.shipment_packages
  where id = target_package_id;

  if package_row.id is null then
    raise exception 'PACKAGE_NOT_FOUND';
  end if;

  if target_changed_by is not null and not exists (
    select 1 from public.profiles
    where id = target_changed_by
      and organization_id = package_row.organization_id
  ) then
    raise exception 'PACKAGE_INVOICE_ACTOR_OUT_OF_SCOPE';
  end if;

  insert into public.shipment_package_invoice_events (
    organization_id, package_id, state, occurred_at, changed_by, source
  ) values (
    package_row.organization_id,
    package_row.id,
    target_state,
    effective_at,
    target_changed_by,
    coalesce(nullif(btrim(target_source), ''), 'system')
  )
  on conflict (package_id, state) do update
    set changed_by = coalesce(public.shipment_package_invoice_events.changed_by, excluded.changed_by);

  if target_state = 'created' then
    update public.shipment_packages
    set invoice_created_at = coalesce(invoice_created_at, effective_at),
        invoice_created_by = coalesce(invoice_created_by, target_changed_by)
    where id = package_row.id;
  elsif target_state = 'paid' then
    update public.shipment_packages
    set invoice_payment_status = 'paid',
        invoice_paid_at = coalesce(invoice_paid_at, effective_at),
        invoice_paid_by = coalesce(invoice_paid_by, target_changed_by)
    where id = package_row.id;
  else
    update public.shipment_packages
    set invoice_fulfillment_status = target_state,
        invoice_fulfillment_changed_at = effective_at,
        invoice_fulfillment_changed_by = target_changed_by
    where id = package_row.id;
  end if;
end;
$$;

create or replace function public.record_shipment_package_invoice_state(
  target_shipment_id uuid,
  target_state text,
  target_occurred_at timestamptz,
  target_changed_by uuid,
  target_source text default 'system'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  package_id uuid;
begin
  for package_id in
    select id from public.shipment_packages where shipment_id = target_shipment_id
  loop
    perform public.record_shipment_package_invoice_event(
      package_id,
      target_state,
      target_occurred_at,
      target_changed_by,
      target_source
    );
  end loop;
end;
$$;

create or replace function public.sync_shipment_package_invoice_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  shipment_invoice_status text;
begin
  perform public.record_shipment_package_invoice_event(
    new.id,
    'created',
    new.created_at,
    coalesce(new.invoice_created_by, auth.uid()),
    'sale'
  );

  select invoice_status into shipment_invoice_status
  from public.shipments
  where id = new.shipment_id;

  if shipment_invoice_status = 'paid' then
    perform public.record_shipment_package_invoice_event(
      new.id,
      'paid',
      now(),
      coalesce(new.invoice_paid_by, auth.uid()),
      'sale'
    );
  end if;

  return new;
end;
$$;

create or replace function public.sync_shipment_package_invoice_on_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_state text;
  state_at timestamptz;
  state_by uuid;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status in ('warehouse_intake', 'in_warehouse', 'on_pallet') then
    next_state := 'in_warehouse';
    state_at := coalesce(new.intake_recorded_at, new.warehouse_placed_at, new.palletized_at, now());
    state_by := coalesce(new.intake_recorded_by, new.warehouse_placed_by, new.palletized_by, auth.uid());
  elsif new.status in ('in_truck', 'handed_to_carrier') then
    next_state := 'in_transit';
    state_at := coalesce(new.truck_arrived_at, now());
    state_by := auth.uid();
  else
    return new;
  end if;

  perform public.record_shipment_package_invoice_event(
    new.id,
    next_state,
    state_at,
    state_by,
    'physical_custody'
  );

  return new;
end;
$$;

create or replace function public.sync_shipment_package_invoice_on_shipment_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.invoice_status is distinct from 'paid' and new.invoice_status = 'paid' then
    perform public.record_shipment_package_invoice_state(new.id, 'paid', now(), auth.uid(), 'payment');
  end if;

  if old.status is distinct from 'Entregado' and new.status = 'Entregado' then
    perform public.record_shipment_package_invoice_state(new.id, 'delivered', now(), auth.uid(), 'shipment_status');
  end if;

  return new;
end;
$$;

drop trigger if exists shipment_package_invoice_insert_lifecycle on public.shipment_packages;
create trigger shipment_package_invoice_insert_lifecycle
  after insert on public.shipment_packages
  for each row execute function public.sync_shipment_package_invoice_on_insert();

drop trigger if exists shipment_package_invoice_status_lifecycle on public.shipment_packages;
create trigger shipment_package_invoice_status_lifecycle
  after update of status on public.shipment_packages
  for each row execute function public.sync_shipment_package_invoice_on_status_change();

drop trigger if exists shipment_package_invoice_shipment_lifecycle on public.shipments;
create trigger shipment_package_invoice_shipment_lifecycle
  after update of invoice_status, status on public.shipments
  for each row execute function public.sync_shipment_package_invoice_on_shipment_change();

-- Legacy rows did not carry per-box state. Reconstruct every known milestone
-- without inventing a user when the prior record did not store one.
select public.record_shipment_package_invoice_event(
  package.id, 'created', package.created_at, package.invoice_created_by, 'backfill'
)
from public.shipment_packages package;

select public.record_shipment_package_invoice_event(
  package.id, 'paid', coalesce(shipment.finalized_at, package.created_at), package.invoice_paid_by, 'backfill'
)
from public.shipment_packages package
join public.shipments shipment on shipment.id = package.shipment_id
where shipment.invoice_status = 'paid';

select public.record_shipment_package_invoice_event(
  package.id, 'in_warehouse',
  coalesce(package.intake_recorded_at, package.warehouse_placed_at, package.palletized_at, package.created_at),
  coalesce(package.intake_recorded_by, package.warehouse_placed_by, package.palletized_by),
  'backfill'
)
from public.shipment_packages package
where package.status in ('warehouse_intake', 'in_warehouse', 'on_pallet');

select public.record_shipment_package_invoice_event(
  package.id, 'in_transit', coalesce(package.truck_arrived_at, package.created_at), null, 'backfill'
)
from public.shipment_packages package
where package.status in ('in_truck', 'handed_to_carrier');

select public.record_shipment_package_invoice_event(
  package.id, 'delivered', coalesce(shipment.delivered_at, package.created_at), null, 'backfill'
)
from public.shipment_packages package
join public.shipments shipment on shipment.id = package.shipment_id
where shipment.status = 'Entregado';

grant execute on function public.record_shipment_package_invoice_event(uuid, text, timestamptz, uuid, text) to authenticated, service_role;
grant execute on function public.record_shipment_package_invoice_state(uuid, text, timestamptz, uuid, text) to authenticated, service_role;
