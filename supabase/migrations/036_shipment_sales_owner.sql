-- Seller ownership for shipment visibility

alter table public.shipments
  add column if not exists created_by uuid references public.profiles (id) on delete set null,
  add column if not exists sales_owner_id uuid references public.profiles (id) on delete set null;

create index if not exists idx_shipments_org_sales_owner
  on public.shipments (organization_id, sales_owner_id, created_at desc);

create index if not exists idx_shipments_org_created_by
  on public.shipments (organization_id, created_by, created_at desc);

with ranked_profiles as (
  select
    p.organization_id,
    p.id,
    row_number() over (
      partition by p.organization_id
      order by case when r.slug = 'administrador' then 0 else 1 end, p.created_at asc
    ) as rank
  from public.profiles p
  join public.roles r on r.id = p.role_id
  where p.is_active = true
),
fallback_owner as (
  select organization_id, id
  from ranked_profiles
  where rank = 1
)
update public.shipments s
set created_by = coalesce(s.created_by, fallback_owner.id),
    sales_owner_id = coalesce(s.sales_owner_id, fallback_owner.id)
from fallback_owner
where s.organization_id = fallback_owner.organization_id
  and (s.created_by is null or s.sales_owner_id is null);

drop policy if exists shipments_select on public.shipments;
create policy shipments_select on public.shipments for select
  using (
    organization_id = public.current_organization_id()
    and (
      public.current_role_slug() = 'administrador'
      or (
        public.user_has_permission('sales.manage')
        and sales_owner_id = auth.uid()
      )
      or (
        public.user_has_permission('routes.view')
        and assigned_to = auth.uid()
      )
    )
  );

drop policy if exists shipments_insert on public.shipments;
drop policy if exists shipments_insert_sales on public.shipments;
create policy shipments_insert on public.shipments for insert
  with check (
    organization_id = public.current_organization_id()
    and public.user_has_permission('sales.manage')
    and (
      public.current_role_slug() = 'administrador'
      or sales_owner_id = auth.uid()
    )
  );

drop policy if exists shipments_update on public.shipments;
create policy shipments_update on public.shipments for update
  using (
    organization_id = public.current_organization_id()
    and (
      public.current_role_slug() = 'administrador'
      or (
        public.user_has_permission('sales.manage')
        and sales_owner_id = auth.uid()
      )
      or (
        public.user_has_permission('routes.update_status')
        and assigned_to = auth.uid()
      )
    )
  )
  with check (
    organization_id = public.current_organization_id()
    and (
      public.current_role_slug() = 'administrador'
      or (
        public.user_has_permission('sales.manage')
        and sales_owner_id = auth.uid()
      )
      or (
        public.user_has_permission('routes.update_status')
        and assigned_to = auth.uid()
      )
    )
  );

drop policy if exists shipment_logistics_tasks_select on public.shipment_logistics_tasks;
create policy shipment_logistics_tasks_select on public.shipment_logistics_tasks for select
  using (
    organization_id = public.current_organization_id()
    and (
      public.current_role_slug() = 'administrador'
      or (
        public.user_has_permission('sales.manage')
        and exists (
          select 1
          from public.shipments s
          where s.id = shipment_id
            and s.organization_id = public.current_organization_id()
            and s.sales_owner_id = auth.uid()
        )
      )
      or (
        public.user_has_permission('routes.view')
        and assigned_to = auth.uid()
      )
    )
  );

drop policy if exists shipment_logistics_tasks_write on public.shipment_logistics_tasks;
create policy shipment_logistics_tasks_write on public.shipment_logistics_tasks for all
  using (
    organization_id = public.current_organization_id()
    and (
      public.current_role_slug() = 'administrador'
      or (
        public.user_has_permission('sales.manage')
        and exists (
          select 1
          from public.shipments s
          where s.id = shipment_id
            and s.organization_id = public.current_organization_id()
            and s.sales_owner_id = auth.uid()
        )
      )
      or (
        public.user_has_permission('routes.update_status')
        and assigned_to = auth.uid()
      )
    )
  )
  with check (
    organization_id = public.current_organization_id()
    and (
      public.current_role_slug() = 'administrador'
      or (
        public.user_has_permission('sales.manage')
        and exists (
          select 1
          from public.shipments s
          where s.id = shipment_id
            and s.organization_id = public.current_organization_id()
            and s.sales_owner_id = auth.uid()
        )
      )
      or (
        public.user_has_permission('routes.update_status')
        and assigned_to = auth.uid()
      )
    )
  );

drop policy if exists shipment_payments_select on public.shipment_payments;
create policy shipment_payments_select on public.shipment_payments for select
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
            and s.assigned_to = auth.uid()
          )
        )
    )
  );

drop policy if exists shipment_payments_write on public.shipment_payments;
create policy shipment_payments_write on public.shipment_payments for all
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
