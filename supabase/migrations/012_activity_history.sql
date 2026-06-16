-- Historial general de ventas, clientes y destinatarios

create table if not exists public.activity_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  actor_name text not null default '',
  action text not null,
  entity_type text not null,
  entity_id uuid,
  title text not null,
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_history_org_created
  on public.activity_history (organization_id, created_at desc);

alter table public.activity_history enable row level security;

create policy activity_history_select on public.activity_history for select
  using (
    organization_id = public.current_organization_id()
    and (
      public.user_has_permission('sales.manage')
      or public.user_has_permission('customers.manage')
      or public.user_has_permission('routes.view')
      or public.user_has_permission('routes.update_status')
      or public.user_has_permission('settings.manage')
    )
  );

create policy activity_history_insert on public.activity_history for insert
  with check (
    organization_id = public.current_organization_id()
    and (
      public.user_has_permission('sales.manage')
      or public.user_has_permission('customers.manage')
      or public.user_has_permission('routes.update_status')
      or public.user_has_permission('settings.manage')
    )
  );
