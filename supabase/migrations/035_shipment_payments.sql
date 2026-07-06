-- Payment records for shipment invoices

create table if not exists public.shipment_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  shipment_id uuid not null references public.shipments (id) on delete cascade,
  amount numeric not null check (amount > 0),
  method text not null check (
    method in (
      'cash',
      'card',
      'check',
      'zelle',
      'venmo',
      'paypal',
      'cash_app',
      'bank_transfer',
      'deposit',
      'other'
    )
  ),
  kind text not null default 'balance' check (kind in ('deposit', 'balance', 'full')),
  note text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_shipment_payments_org
  on public.shipment_payments (organization_id, created_at desc);

create index if not exists idx_shipment_payments_shipment
  on public.shipment_payments (shipment_id);

create index if not exists idx_shipment_payments_method
  on public.shipment_payments (organization_id, method);

alter table public.shipment_payments enable row level security;

drop policy if exists shipment_payments_select on public.shipment_payments;
create policy shipment_payments_select on public.shipment_payments for select
  using (
    organization_id = public.current_organization_id()
    and (
      public.user_has_permission('sales.manage')
      or public.user_has_permission('routes.view')
    )
  );

drop policy if exists shipment_payments_write on public.shipment_payments;
create policy shipment_payments_write on public.shipment_payments for all
  using (
    organization_id = public.current_organization_id()
    and public.user_has_permission('sales.manage')
  )
  with check (
    organization_id = public.current_organization_id()
    and public.user_has_permission('sales.manage')
  );
