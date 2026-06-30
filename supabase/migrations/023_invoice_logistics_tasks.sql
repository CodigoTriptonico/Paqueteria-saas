-- Open invoice states and logistics tasks

alter table public.shipments
  add column if not exists invoice_status text not null default 'open',
  add column if not exists accounting_status text not null default 'not_exportable',
  add column if not exists finalized_at timestamptz;

do $$
begin
  alter table public.shipments
    add constraint shipments_invoice_status_check
    check (invoice_status in ('open', 'paid', 'void'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.shipments
    add constraint shipments_accounting_status_check
    check (accounting_status in ('not_exportable', 'exportable'));
exception
  when duplicate_object then null;
end $$;

update public.shipments
set invoice_status = 'paid',
    accounting_status = 'exportable',
    finalized_at = coalesce(finalized_at, created_at)
where sale_kind = 'full';

update public.shipments
set invoice_status = 'open',
    accounting_status = 'not_exportable',
    finalized_at = null
where sale_kind = 'empty_box_deposit';

create table if not exists public.shipment_logistics_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  shipment_id uuid not null references public.shipments (id) on delete cascade,
  task_type text not null check (task_type in ('deliver_empty_box', 'pickup_full_box')),
  status text not null default 'pending' check (
    status in ('pending', 'scheduled', 'assigned', 'loaded_to_truck', 'completed', 'cancelled')
  ),
  assigned_to uuid references public.profiles (id) on delete set null,
  scheduled_at timestamptz,
  warehouse_id uuid references public.warehouses (id) on delete set null,
  notes text not null default '',
  stock_deducted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_shipment_logistics_tasks_org
  on public.shipment_logistics_tasks (organization_id, created_at desc);

create index if not exists idx_shipment_logistics_tasks_shipment
  on public.shipment_logistics_tasks (shipment_id);

create index if not exists idx_shipment_logistics_tasks_assigned
  on public.shipment_logistics_tasks (assigned_to, status);

alter table public.shipment_logistics_tasks enable row level security;

drop policy if exists shipment_logistics_tasks_select on public.shipment_logistics_tasks;
create policy shipment_logistics_tasks_select on public.shipment_logistics_tasks for select
  using (
    organization_id = public.current_organization_id()
    and (
      public.user_has_permission('sales.manage')
      or public.user_has_permission('routes.view')
    )
    and (
      public.current_role_slug() <> 'conductor'
      or assigned_to = auth.uid()
    )
  );

drop policy if exists shipment_logistics_tasks_write on public.shipment_logistics_tasks;
create policy shipment_logistics_tasks_write on public.shipment_logistics_tasks for all
  using (
    organization_id = public.current_organization_id()
    and (
      public.user_has_permission('sales.manage')
      or public.user_has_permission('routes.update_status')
    )
  )
  with check (
    organization_id = public.current_organization_id()
    and (
      public.user_has_permission('sales.manage')
      or public.user_has_permission('routes.update_status')
    )
  );
