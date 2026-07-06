-- Driver truck inventory and task evidence.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'logistics-task-evidence',
  'logistics-task-evidence',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.logistics_truck_inventory_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  route_id uuid references public.logistics_routes (id) on delete cascade,
  task_id uuid references public.shipment_logistics_tasks (id) on delete set null,
  shipment_id uuid references public.shipments (id) on delete set null,
  assigned_driver_id uuid not null references public.profiles (id) on delete cascade,
  warehouse_id uuid references public.warehouses (id) on delete set null,
  item_id uuid references public.inventory_items (id) on delete set null,
  item_name text not null default '',
  catalog_key text not null default '',
  item_label text not null default '',
  event_type text not null check (event_type in ('load', 'deliver', 'return', 'adjust')),
  qty numeric not null check (qty <> 0),
  note text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_logistics_truck_events_driver_route
  on public.logistics_truck_inventory_events (assigned_driver_id, route_id, created_at desc);

create index if not exists idx_logistics_truck_events_task
  on public.logistics_truck_inventory_events (task_id, created_at desc);

create index if not exists idx_logistics_truck_events_item
  on public.logistics_truck_inventory_events (organization_id, item_id, created_at desc);

create table if not exists public.shipment_logistics_task_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  shipment_id uuid not null references public.shipments (id) on delete cascade,
  task_id uuid not null references public.shipment_logistics_tasks (id) on delete cascade,
  route_id uuid references public.logistics_routes (id) on delete set null,
  driver_id uuid not null references public.profiles (id) on delete cascade,
  result text not null check (result in ('completed', 'failed')),
  failure_reason text not null default '',
  note text not null default '',
  evidence_url text not null default '',
  payment_amount numeric,
  payment_method text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    result = 'completed'
    or length(trim(failure_reason)) > 0
  ),
  check (
    result = 'failed'
    or length(trim(evidence_url)) > 0
  )
);

create index if not exists idx_shipment_task_attempts_task
  on public.shipment_logistics_task_attempts (task_id, created_at desc);

create index if not exists idx_shipment_task_attempts_shipment
  on public.shipment_logistics_task_attempts (shipment_id, created_at desc);

create index if not exists idx_shipment_task_attempts_driver
  on public.shipment_logistics_task_attempts (driver_id, created_at desc);

alter table public.logistics_truck_inventory_events enable row level security;
alter table public.shipment_logistics_task_attempts enable row level security;

drop policy if exists logistics_truck_events_select on public.logistics_truck_inventory_events;
create policy logistics_truck_events_select on public.logistics_truck_inventory_events for select
  using (
    organization_id = public.current_organization_id()
    and public.user_has_permission('routes.view')
    and (
      public.current_role_slug() <> 'conductor'
      or assigned_driver_id = auth.uid()
    )
  );

drop policy if exists logistics_truck_events_write on public.logistics_truck_inventory_events;
create policy logistics_truck_events_write on public.logistics_truck_inventory_events for all
  using (
    organization_id = public.current_organization_id()
    and (
      public.current_role_slug() = 'administrador'
      or public.user_has_permission('sales.manage')
      or (
        public.user_has_permission('routes.update_status')
        and assigned_driver_id = auth.uid()
      )
    )
  )
  with check (
    organization_id = public.current_organization_id()
    and (
      public.current_role_slug() = 'administrador'
      or public.user_has_permission('sales.manage')
      or (
        public.user_has_permission('routes.update_status')
        and assigned_driver_id = auth.uid()
      )
    )
  );

drop policy if exists shipment_task_attempts_select on public.shipment_logistics_task_attempts;
create policy shipment_task_attempts_select on public.shipment_logistics_task_attempts for select
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
          or (
            public.user_has_permission('routes.view')
            and driver_id = auth.uid()
          )
        )
    )
  );

drop policy if exists shipment_task_attempts_write on public.shipment_logistics_task_attempts;
create policy shipment_task_attempts_write on public.shipment_logistics_task_attempts for all
  using (
    organization_id = public.current_organization_id()
    and (
      public.current_role_slug() = 'administrador'
      or public.user_has_permission('sales.manage')
      or (
        public.user_has_permission('routes.update_status')
        and driver_id = auth.uid()
      )
    )
  )
  with check (
    organization_id = public.current_organization_id()
    and (
      public.current_role_slug() = 'administrador'
      or public.user_has_permission('sales.manage')
      or (
        public.user_has_permission('routes.update_status')
        and driver_id = auth.uid()
      )
    )
  );

drop policy if exists logistics_task_evidence_select on storage.objects;
create policy logistics_task_evidence_select on storage.objects for select
  using (
    bucket_id = 'logistics-task-evidence'
    and (storage.foldername(name))[1] = public.current_organization_id()::text
    and public.user_has_permission('routes.view')
  );

drop policy if exists logistics_task_evidence_insert on storage.objects;
create policy logistics_task_evidence_insert on storage.objects for insert
  with check (
    bucket_id = 'logistics-task-evidence'
    and (storage.foldername(name))[1] = public.current_organization_id()::text
    and (
      public.user_has_permission('routes.update_status')
      or public.user_has_permission('sales.manage')
    )
  );

drop policy if exists logistics_task_evidence_delete on storage.objects;
create policy logistics_task_evidence_delete on storage.objects for delete
  using (
    bucket_id = 'logistics-task-evidence'
    and (storage.foldername(name))[1] = public.current_organization_id()::text
    and (
      public.current_role_slug() = 'administrador'
      or public.user_has_permission('sales.manage')
    )
  );
