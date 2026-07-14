-- Truck inventory balances belong to the vehicle, not the driver.
-- assigned_driver_id remains as the actor who recorded the event.

alter table public.logistics_truck_inventory_events
  add column if not exists vehicle_id uuid references public.logistics_vehicles (id) on delete restrict;

update public.logistics_truck_inventory_events e
set vehicle_id = coalesce(
  (
    select r.vehicle_id
    from public.logistics_routes r
    where r.id = e.route_id
      and r.vehicle_id is not null
  ),
  (
    select v.id
    from public.logistics_vehicles v
    where v.organization_id = e.organization_id
      and v.assigned_driver_id = e.assigned_driver_id
      and v.is_active = true
    order by v.updated_at desc nulls last, v.created_at desc
    limit 1
  )
)
where e.vehicle_id is null;

create index if not exists idx_logistics_truck_events_vehicle
  on public.logistics_truck_inventory_events (vehicle_id, created_at desc)
  where vehicle_id is not null;

drop index if exists public.logistics_truck_deliver_task_line_uidx;
create unique index if not exists logistics_truck_deliver_task_line_uidx
  on public.logistics_truck_inventory_events (
    organization_id,
    task_id,
    catalog_key,
    item_label
  )
  where event_type = 'deliver' and task_id is not null;

drop index if exists public.logistics_truck_collect_task_line_uidx;
create unique index if not exists logistics_truck_collect_task_line_uidx
  on public.logistics_truck_inventory_events (
    organization_id,
    task_id,
    catalog_key,
    item_label
  )
  where event_type = 'collect_full_box' and task_id is not null;

drop index if exists public.logistics_truck_unload_task_line_uidx;
create unique index if not exists logistics_truck_unload_task_line_uidx
  on public.logistics_truck_inventory_events (
    organization_id,
    task_id,
    catalog_key,
    item_label
  )
  where event_type = 'unload_full_box' and task_id is not null;

drop policy if exists logistics_truck_events_select on public.logistics_truck_inventory_events;
create policy logistics_truck_events_select on public.logistics_truck_inventory_events for select
  using (
    organization_id = public.current_organization_id()
    and public.user_has_permission('routes.view')
    and (
      public.current_role_slug() <> 'conductor'
      or assigned_driver_id = auth.uid()
      or vehicle_id in (
        select v.id
        from public.logistics_vehicles v
        where v.organization_id = public.current_organization_id()
          and v.assigned_driver_id = auth.uid()
          and v.is_active = true
      )
      or vehicle_id in (
        select r.vehicle_id
        from public.logistics_routes r
        where r.organization_id = public.current_organization_id()
          and r.assigned_to = auth.uid()
          and r.vehicle_id is not null
          and r.status in ('planned', 'in_progress')
      )
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
        and (
          assigned_driver_id = auth.uid()
          or vehicle_id in (
            select v.id
            from public.logistics_vehicles v
            where v.organization_id = public.current_organization_id()
              and v.assigned_driver_id = auth.uid()
              and v.is_active = true
          )
          or vehicle_id in (
            select r.vehicle_id
            from public.logistics_routes r
            where r.organization_id = public.current_organization_id()
              and r.assigned_to = auth.uid()
              and r.vehicle_id is not null
              and r.status in ('planned', 'in_progress')
          )
        )
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
        and (
          assigned_driver_id = auth.uid()
          or vehicle_id in (
            select v.id
            from public.logistics_vehicles v
            where v.organization_id = public.current_organization_id()
              and v.assigned_driver_id = auth.uid()
              and v.is_active = true
          )
          or vehicle_id in (
            select r.vehicle_id
            from public.logistics_routes r
            where r.organization_id = public.current_organization_id()
              and r.assigned_to = auth.uid()
              and r.vehicle_id is not null
              and r.status in ('planned', 'in_progress')
          )
        )
      )
    )
  );
