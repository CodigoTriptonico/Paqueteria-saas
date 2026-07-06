-- Seller contact log per shipment.

create table if not exists public.shipment_contact_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  shipment_id uuid not null references public.shipments (id) on delete cascade,
  channel text not null default 'call' check (
    channel in ('call', 'whatsapp', 'sms', 'email', 'other')
  ),
  outcome text not null default 'answered' check (
    outcome in ('answered', 'no_answer', 'left_message', 'call_back', 'wrong_number', 'other')
  ),
  note text not null default '' check (length(trim(note)) > 0 and length(note) <= 2000),
  next_step text not null default '' check (length(next_step) <= 240),
  follow_up_at timestamptz,
  created_by uuid constraint shipment_contact_logs_created_by_fkey references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_shipment_contact_logs_org_created
  on public.shipment_contact_logs (organization_id, created_at desc);

create index if not exists idx_shipment_contact_logs_shipment_created
  on public.shipment_contact_logs (shipment_id, created_at desc);

create index if not exists idx_shipment_contact_logs_follow_up
  on public.shipment_contact_logs (organization_id, follow_up_at)
  where follow_up_at is not null;

alter table public.shipment_contact_logs enable row level security;

drop policy if exists shipment_contact_logs_select on public.shipment_contact_logs;
create policy shipment_contact_logs_select on public.shipment_contact_logs for select
  using (
    organization_id = public.current_organization_id()
    and exists (
      select 1
      from public.shipments s
      where s.id = shipment_id
        and s.organization_id = public.current_organization_id()
        and (
          public.current_role_slug() = 'administrador'
          or (
            public.user_has_permission('sales.manage')
            and s.sales_owner_id = auth.uid()
          )
        )
    )
  );

drop policy if exists shipment_contact_logs_write on public.shipment_contact_logs;
create policy shipment_contact_logs_write on public.shipment_contact_logs for all
  using (
    organization_id = public.current_organization_id()
    and exists (
      select 1
      from public.shipments s
      where s.id = shipment_id
        and s.organization_id = public.current_organization_id()
        and (
          public.current_role_slug() = 'administrador'
          or (
            public.user_has_permission('sales.manage')
            and s.sales_owner_id = auth.uid()
          )
        )
    )
  )
  with check (
    organization_id = public.current_organization_id()
    and exists (
      select 1
      from public.shipments s
      where s.id = shipment_id
        and s.organization_id = public.current_organization_id()
        and (
          public.current_role_slug() = 'administrador'
          or (
            public.user_has_permission('sales.manage')
            and s.sales_owner_id = auth.uid()
          )
        )
    )
  );
