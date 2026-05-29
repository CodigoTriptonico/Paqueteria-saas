create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  code text not null,
  customer_name text not null,
  country text not null,
  carrier text not null,
  paid numeric not null default 0,
  profit numeric not null default 0,
  status text not null default 'Pendiente',
  assigned_to uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists idx_shipments_org on public.shipments (organization_id);
create index if not exists idx_shipments_assigned on public.shipments (assigned_to);

alter table public.shipments enable row level security;

create policy shipments_select on public.shipments for select
  using (
    organization_id = public.current_organization_id()
    and public.user_has_permission('routes.view')
    and (
      public.current_role_slug() <> 'conductor'
      or assigned_to = auth.uid()
    )
  );

create policy shipments_update on public.shipments for update
  using (
    organization_id = public.current_organization_id()
    and public.user_has_permission('routes.update_status')
    and (
      public.current_role_slug() <> 'conductor'
      or assigned_to = auth.uid()
    )
  );

create policy shipments_insert on public.shipments for insert
  with check (
    organization_id = public.current_organization_id()
    and public.user_has_permission('routes.view')
  );
