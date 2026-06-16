-- Shipment sale metadata and invoice counters

alter table public.shipments
  add column if not exists customer_id uuid references public.customers (id) on delete set null,
  add column if not exists recipient_id uuid references public.customer_recipients (id) on delete set null,
  add column if not exists recipient_snapshot jsonb;

create table public.organization_invoice_counters (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  last_number bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.organization_invoice_counters enable row level security;

create policy organization_invoice_counters_select on public.organization_invoice_counters for select
  using (
    organization_id = public.current_organization_id()
    and (public.user_has_permission('sales.manage') or public.user_has_permission('routes.view'))
  );

create policy organization_invoice_counters_write on public.organization_invoice_counters for all
  using (
    organization_id = public.current_organization_id()
    and public.user_has_permission('sales.manage')
  );

create or replace function public.next_organization_invoice_number(target_org_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  next_value bigint;
begin
  insert into public.organization_invoice_counters (organization_id, last_number)
  values (target_org_id, 1)
  on conflict (organization_id) do update
    set last_number = public.organization_invoice_counters.last_number + 1,
        updated_at = now()
  returning last_number into next_value;

  return next_value;
end;
$$;

grant execute on function public.next_organization_invoice_number(uuid) to authenticated;
grant execute on function public.next_organization_invoice_number(uuid) to service_role;

create policy shipments_insert_sales on public.shipments for insert
  with check (
    organization_id = public.current_organization_id()
    and public.user_has_permission('sales.manage')
  );
