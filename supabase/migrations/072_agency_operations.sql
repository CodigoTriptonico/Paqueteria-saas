-- Agency operations: quantity-based box custody, service requests, combined visits,
-- default-route history, and transactional/idempotent operational commands.

create table public.agency_service_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.business_tenants(id) on delete restrict,
  organization_id uuid not null default public.current_business_organization_id() references public.organizations(id) on delete restrict,
  agency_id uuid not null references public.agencies(id) on delete restrict,
  code text not null,
  status text not null default 'draft' check (status in (
    'draft', 'submitted', 'under_review', 'confirmed', 'scheduled', 'assigned',
    'in_route', 'partially_completed', 'completed', 'rejected', 'cancelled'
  )),
  status_version bigint not null default 1 check (status_version > 0),
  requested_service_date date,
  address_snapshot jsonb not null default '{}'::jsonb,
  notes text not null default '',
  created_by_membership_id uuid not null default public.current_membership_id() references public.organization_memberships(id) on delete restrict,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table public.agency_service_request_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  request_id uuid not null references public.agency_service_requests(id) on delete restrict,
  service_kind text not null check (service_kind in (
    'empty_box_delivery', 'full_box_pickup', 'home_delivery', 'home_pickup', 'additional_service'
  )),
  requested_quantity integer not null check (requested_quantity > 0),
  confirmed_quantity integer not null default 0 check (confirmed_quantity >= 0),
  inventory_item_id uuid references public.inventory_items(id) on delete restrict,
  matrix_warehouse_id uuid references public.warehouses(id) on delete restrict,
  product_key text not null default '',
  box_size text not null default '',
  unit_charge_amount_cents bigint not null default 0 check (unit_charge_amount_cents >= 0),
  currency text not null default 'USD' check (currency = 'USD'),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    service_kind <> 'empty_box_delivery'
    or (inventory_item_id is not null and matrix_warehouse_id is not null and product_key <> '' and box_size <> '')
  )
);

create table public.agency_request_status_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  request_id uuid not null references public.agency_service_requests(id) on delete restrict,
  previous_status text not null,
  status text not null,
  status_version bigint not null check (status_version > 0),
  actor_membership_id uuid references public.organization_memberships(id) on delete restrict,
  reason text not null default '',
  occurred_at timestamptz not null default now()
);

create table public.agency_visits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  agency_id uuid not null references public.agencies(id) on delete restrict,
  route_id uuid references public.logistics_routes(id) on delete restrict,
  status text not null default 'scheduled' check (status in (
    'scheduled', 'assigned', 'in_route', 'partially_completed', 'completed', 'cancelled'
  )),
  status_version bigint not null default 1 check (status_version > 0),
  scheduled_for timestamptz,
  address_snapshot jsonb not null default '{}'::jsonb,
  notes text not null default '',
  created_by_membership_id uuid not null references public.organization_memberships(id) on delete restrict,
  confirmed_by_membership_id uuid references public.organization_memberships(id) on delete restrict,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agency_visit_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  visit_id uuid not null references public.agency_visits(id) on delete restrict,
  request_line_id uuid not null references public.agency_service_request_lines(id) on delete restrict,
  requested_quantity integer not null check (requested_quantity > 0),
  confirmed_quantity integer check (confirmed_quantity is null or confirmed_quantity >= 0),
  difference_quantity integer,
  difference_reason text not null default '',
  evidence jsonb not null default '{}'::jsonb,
  responsible_membership_id uuid references public.organization_memberships(id) on delete restrict,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (visit_id, request_line_id),
  check (
    confirmed_quantity is null
    or difference_quantity = confirmed_quantity - requested_quantity
  ),
  check (
    confirmed_quantity is null
    or confirmed_quantity = requested_quantity
    or char_length(btrim(difference_reason)) > 0
  )
);

create table public.agency_visit_status_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  visit_id uuid not null references public.agency_visits(id) on delete restrict,
  previous_status text not null,
  status text not null,
  status_version bigint not null check (status_version > 0),
  actor_membership_id uuid references public.organization_memberships(id) on delete restrict,
  reason text not null default '',
  occurred_at timestamptz not null default now()
);

create table public.agency_default_route_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  agency_id uuid not null references public.agencies(id) on delete restrict,
  route_template_id uuid not null references public.logistics_route_templates(id) on delete restrict,
  assigned_by_membership_id uuid not null references public.organization_memberships(id) on delete restrict,
  reason text not null default '',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);

create unique index agency_default_route_active_uidx
  on public.agency_default_route_assignments(agency_id)
  where ended_at is null;

create table public.agency_box_batches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  agency_id uuid not null references public.agencies(id) on delete restrict,
  source_visit_id uuid not null unique references public.agency_visits(id) on delete restrict,
  delivered_by_membership_id uuid not null references public.organization_memberships(id) on delete restrict,
  delivered_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.agency_box_lots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  agency_id uuid not null references public.agencies(id) on delete restrict,
  batch_id uuid not null references public.agency_box_batches(id) on delete restrict,
  source_visit_line_id uuid not null unique references public.agency_visit_lines(id) on delete restrict,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  product_key text not null,
  box_size text not null,
  delivered_quantity integer not null check (delivered_quantity > 0),
  delivered_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.agency_box_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  agency_id uuid not null references public.agencies(id) on delete restrict,
  lot_id uuid references public.agency_box_lots(id) on delete restrict,
  movement_type text not null check (movement_type in ('delivered', 'sold', 'used', 'adjustment', 'reversal')),
  quantity_delta integer not null check (quantity_delta <> 0),
  source_operation_type text not null,
  source_operation_id uuid not null,
  actor_membership_id uuid references public.organization_memberships(id) on delete restrict,
  reason text not null default '',
  occurred_at timestamptz not null default now(),
  unique (tenant_id, source_operation_type, source_operation_id, movement_type, lot_id)
);

create table public.agency_shipment_box_sources (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  agency_id uuid not null references public.agencies(id) on delete restrict,
  shipment_id uuid not null unique references public.shipments(id) on delete restrict,
  source text not null check (source in ('matrix_purchased', 'own_box')),
  inventory_item_id uuid references public.inventory_items(id) on delete restrict,
  product_key text not null default '',
  box_size text not null default '',
  quantity integer not null default 1 check (quantity > 0),
  allocation_status text not null default 'pending' check (allocation_status in ('pending', 'allocated', 'insufficient', 'not_applicable')),
  created_by_membership_id uuid not null references public.organization_memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    source <> 'matrix_purchased'
    or (inventory_item_id is not null and product_key <> '' and box_size <> '')
  )
);

create table public.agency_box_allocations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  agency_id uuid not null references public.agencies(id) on delete restrict,
  shipment_box_source_id uuid not null references public.agency_shipment_box_sources(id) on delete restrict,
  shipment_id uuid not null references public.shipments(id) on delete restrict,
  lot_id uuid not null references public.agency_box_lots(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  allocated_at timestamptz not null default now(),
  unique (shipment_box_source_id, lot_id)
);

create index agency_service_requests_scope_idx
  on public.agency_service_requests(tenant_id, organization_id, status, created_at desc);
create index agency_service_request_lines_request_idx
  on public.agency_service_request_lines(request_id, created_at);
create index agency_visits_scope_idx
  on public.agency_visits(tenant_id, organization_id, status, scheduled_for);
create index agency_visits_route_idx on public.agency_visits(route_id) where route_id is not null;
create index agency_visit_lines_visit_idx on public.agency_visit_lines(visit_id, created_at);
create index agency_box_lots_fifo_idx
  on public.agency_box_lots(agency_id, inventory_item_id, product_key, box_size, delivered_at, id);
create index agency_box_movements_agency_idx
  on public.agency_box_movements(agency_id, occurred_at desc);
create index agency_box_allocations_lot_idx on public.agency_box_allocations(lot_id);
create index agency_request_status_history_request_idx on public.agency_request_status_history(request_id, occurred_at desc);
create index agency_visit_status_history_visit_idx on public.agency_visit_status_history(visit_id, occurred_at desc);

create view public.agency_box_lot_balances
with (security_invoker = true)
as
select
  lot.id,
  lot.tenant_id,
  lot.organization_id,
  lot.agency_id,
  lot.inventory_item_id,
  lot.product_key,
  lot.box_size,
  lot.delivered_at,
  lot.delivered_quantity,
  coalesce(sum(allocation.quantity), 0)::integer as allocated_quantity,
  (lot.delivered_quantity - coalesce(sum(allocation.quantity), 0))::integer as available_quantity,
  now() - lot.delivered_at as age
from public.agency_box_lots lot
left join public.agency_box_allocations allocation on allocation.lot_id = lot.id
group by lot.id;

grant select on public.agency_box_lot_balances to authenticated;

create function public.agency_operations_validate_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'agency_service_requests' then
    if tg_op = 'UPDATE' and (
      new.tenant_id is distinct from old.tenant_id
      or new.organization_id is distinct from old.organization_id
      or new.agency_id is distinct from old.agency_id
    ) then raise exception 'IMMUTABLE_REQUEST_SCOPE'; end if;
    if not exists (
      select 1 from public.agencies agency
      where agency.id = new.agency_id and agency.tenant_id = new.tenant_id
        and agency.organization_id = new.organization_id
    ) then raise exception 'AGENCY_SCOPE_MISMATCH'; end if;
  elsif tg_table_name = 'agency_service_request_lines' then
    if tg_op = 'UPDATE' and (
      new.tenant_id is distinct from old.tenant_id
      or new.organization_id is distinct from old.organization_id
      or new.request_id is distinct from old.request_id
    ) then raise exception 'IMMUTABLE_REQUEST_LINE_SCOPE'; end if;
    if not exists (
      select 1 from public.agency_service_requests request
      where request.id = new.request_id and request.tenant_id = new.tenant_id
        and request.organization_id = new.organization_id
    ) then raise exception 'REQUEST_SCOPE_MISMATCH'; end if;
  elsif tg_table_name = 'agency_visits' then
    if not exists (
      select 1 from public.agencies agency
      where agency.id = new.agency_id and agency.tenant_id = new.tenant_id
        and agency.organization_id = new.organization_id
        and (
          new.route_id is null
          or exists (
            select 1 from public.logistics_routes route
            where route.id = new.route_id and route.organization_id = agency.matrix_organization_id
          )
        )
    ) then raise exception 'VISIT_SCOPE_MISMATCH'; end if;
  elsif tg_table_name = 'agency_visit_lines' then
    if not exists (
      select 1
      from public.agency_visits visit
      join public.agency_service_request_lines request_line on request_line.id = new.request_line_id
      join public.agency_service_requests request on request.id = request_line.request_id
      where visit.id = new.visit_id and visit.tenant_id = new.tenant_id
        and visit.organization_id = new.organization_id
        and request_line.tenant_id = new.tenant_id
        and request_line.organization_id = new.organization_id
        and request.agency_id = visit.agency_id
    ) then raise exception 'VISIT_LINE_SCOPE_MISMATCH'; end if;
  elsif tg_table_name = 'agency_default_route_assignments' then
    if not exists (
      select 1 from public.agencies agency
      join public.logistics_route_templates template on template.id = new.route_template_id
      where agency.id = new.agency_id and agency.tenant_id = new.tenant_id
        and agency.organization_id = new.organization_id
        and template.organization_id = agency.matrix_organization_id
    ) then raise exception 'DEFAULT_ROUTE_SCOPE_MISMATCH'; end if;
  elsif tg_table_name = 'agency_box_batches' then
    if not exists (
      select 1 from public.agency_visits visit
      where visit.id = new.source_visit_id and visit.tenant_id = new.tenant_id
        and visit.organization_id = new.organization_id and visit.agency_id = new.agency_id
    ) then raise exception 'BOX_BATCH_SCOPE_MISMATCH'; end if;
  elsif tg_table_name = 'agency_box_lots' then
    if not exists (
      select 1 from public.agency_box_batches batch
      join public.agency_visit_lines line on line.id = new.source_visit_line_id
      where batch.id = new.batch_id and batch.tenant_id = new.tenant_id
        and batch.organization_id = new.organization_id and batch.agency_id = new.agency_id
        and line.visit_id = batch.source_visit_id
    ) then raise exception 'BOX_LOT_SCOPE_MISMATCH'; end if;
  elsif tg_table_name = 'agency_box_movements' and new.lot_id is not null then
    if not exists (
      select 1 from public.agency_box_lots lot
      where lot.id = new.lot_id and lot.tenant_id = new.tenant_id
        and lot.organization_id = new.organization_id and lot.agency_id = new.agency_id
    ) then raise exception 'BOX_MOVEMENT_SCOPE_MISMATCH'; end if;
  elsif tg_table_name = 'agency_shipment_box_sources' then
    if not exists (
      select 1 from public.agencies agency
      where agency.id = new.agency_id and agency.tenant_id = new.tenant_id
        and agency.organization_id = new.organization_id
    ) then raise exception 'BOX_SOURCE_SCOPE_MISMATCH'; end if;
  elsif tg_table_name = 'agency_box_allocations' then
    if not exists (
      select 1 from public.agency_shipment_box_sources source
      join public.agency_box_lots lot on lot.id = new.lot_id
      where source.id = new.shipment_box_source_id and source.tenant_id = new.tenant_id
        and source.organization_id = new.organization_id and source.agency_id = new.agency_id
        and source.shipment_id = new.shipment_id
        and lot.tenant_id = new.tenant_id and lot.organization_id = new.organization_id
        and lot.agency_id = new.agency_id
    ) then raise exception 'BOX_ALLOCATION_SCOPE_MISMATCH'; end if;
  end if;
  return new;
end;
$$;

create trigger agency_service_requests_scope_guard before insert or update on public.agency_service_requests
  for each row execute function public.agency_operations_validate_scope();
create trigger agency_service_request_lines_scope_guard before insert or update on public.agency_service_request_lines
  for each row execute function public.agency_operations_validate_scope();
create trigger agency_visits_scope_guard before insert or update on public.agency_visits
  for each row execute function public.agency_operations_validate_scope();
create trigger agency_visit_lines_scope_guard before insert or update on public.agency_visit_lines
  for each row execute function public.agency_operations_validate_scope();
create trigger agency_default_routes_scope_guard before insert or update on public.agency_default_route_assignments
  for each row execute function public.agency_operations_validate_scope();
create trigger agency_box_batches_scope_guard before insert or update on public.agency_box_batches
  for each row execute function public.agency_operations_validate_scope();
create trigger agency_box_lots_scope_guard before insert or update on public.agency_box_lots
  for each row execute function public.agency_operations_validate_scope();
create trigger agency_box_movements_scope_guard before insert or update on public.agency_box_movements
  for each row execute function public.agency_operations_validate_scope();
create trigger agency_shipment_box_sources_scope_guard before insert or update on public.agency_shipment_box_sources
  for each row execute function public.agency_operations_validate_scope();
create trigger agency_box_allocations_scope_guard before insert or update on public.agency_box_allocations
  for each row execute function public.agency_operations_validate_scope();

alter table public.agency_service_requests enable row level security;
alter table public.agency_service_request_lines enable row level security;
alter table public.agency_request_status_history enable row level security;
alter table public.agency_visits enable row level security;
alter table public.agency_visit_lines enable row level security;
alter table public.agency_visit_status_history enable row level security;
alter table public.agency_default_route_assignments enable row level security;
alter table public.agency_box_batches enable row level security;
alter table public.agency_box_lots enable row level security;
alter table public.agency_box_movements enable row level security;
alter table public.agency_shipment_box_sources enable row level security;
alter table public.agency_box_allocations enable row level security;

create function public.agency_operations_can_view(target_tenant_id uuid, target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.tenant_organization_access(target_tenant_id, target_organization_id)
    and public.current_membership_has_permission(
      'agency.requests.view', target_tenant_id, target_organization_id
    );
$$;

create policy agency_service_requests_select on public.agency_service_requests for select
  using (public.agency_operations_can_view(tenant_id, organization_id));
create policy agency_service_requests_insert on public.agency_service_requests for insert
  with check (
    tenant_id = public.current_tenant_id()
    and public.tenant_organization_access(tenant_id, organization_id)
    and public.current_membership_has_permission('agency.requests.create', tenant_id, organization_id)
    and exists (
      select 1 from public.agencies agency
      where agency.id = agency_service_requests.agency_id
        and agency.tenant_id = agency_service_requests.tenant_id
        and agency.organization_id = agency_service_requests.organization_id
    )
  );
create policy agency_service_requests_update on public.agency_service_requests for update
  using (
    tenant_id = public.current_tenant_id()
    and public.current_membership_has_permission('agency.requests.create', tenant_id, organization_id)
    and status = 'draft'
  )
  with check (
    tenant_id = public.current_tenant_id()
    and status = 'draft'
    and public.current_membership_has_permission('agency.requests.create', tenant_id, organization_id)
  );

create policy agency_service_request_lines_select on public.agency_service_request_lines for select
  using (public.agency_operations_can_view(tenant_id, organization_id));
create policy agency_service_request_lines_insert on public.agency_service_request_lines for insert
  with check (
    tenant_id = public.current_tenant_id()
    and public.current_membership_has_permission('agency.requests.create', tenant_id, organization_id)
    and exists (
      select 1 from public.agency_service_requests request
      where request.id = request_id
        and request.tenant_id = tenant_id
        and request.organization_id = organization_id
        and request.status = 'draft'
    )
  );
create policy agency_service_request_lines_update on public.agency_service_request_lines for update
  using (
    tenant_id = public.current_tenant_id()
    and public.current_membership_has_permission('agency.requests.create', tenant_id, organization_id)
    and exists (
      select 1 from public.agency_service_requests request
      where request.id = request_id and request.status = 'draft'
    )
  );

create policy agency_request_status_history_select on public.agency_request_status_history for select
  using (public.agency_operations_can_view(tenant_id, organization_id));
create policy agency_visits_select on public.agency_visits for select
  using (public.agency_operations_can_view(tenant_id, organization_id));
create policy agency_visit_lines_select on public.agency_visit_lines for select
  using (public.agency_operations_can_view(tenant_id, organization_id));
create policy agency_visit_status_history_select on public.agency_visit_status_history for select
  using (public.agency_operations_can_view(tenant_id, organization_id));
create policy agency_default_route_assignments_select on public.agency_default_route_assignments for select
  using (public.agency_operations_can_view(tenant_id, organization_id));
create policy agency_box_batches_select on public.agency_box_batches for select
  using (public.agency_operations_can_view(tenant_id, organization_id));
create policy agency_box_lots_select on public.agency_box_lots for select
  using (public.agency_operations_can_view(tenant_id, organization_id));
create policy agency_box_movements_select on public.agency_box_movements for select
  using (public.agency_operations_can_view(tenant_id, organization_id));
create policy agency_shipment_box_sources_select on public.agency_shipment_box_sources for select
  using (public.agency_operations_can_view(tenant_id, organization_id));
create policy agency_box_allocations_select on public.agency_box_allocations for select
  using (public.agency_operations_can_view(tenant_id, organization_id));

create function public.agency_operations_reject_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'IMMUTABLE_OPERATIONAL_HISTORY';
end;
$$;

create trigger agency_request_status_history_immutable
  before update or delete on public.agency_request_status_history
  for each row execute function public.agency_operations_reject_mutation();
create trigger agency_visit_status_history_immutable
  before update or delete on public.agency_visit_status_history
  for each row execute function public.agency_operations_reject_mutation();
create trigger agency_box_movements_immutable
  before update or delete on public.agency_box_movements
  for each row execute function public.agency_operations_reject_mutation();
create trigger agency_box_allocations_immutable
  before update or delete on public.agency_box_allocations
  for each row execute function public.agency_operations_reject_mutation();

create function public.agency_allocate_boxes_fifo(target_box_source_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  source_row public.agency_shipment_box_sources;
  lot_row record;
  already_allocated integer;
  remaining integer;
  available integer;
  allocate_now integer;
begin
  select * into source_row
  from public.agency_shipment_box_sources
  where id = target_box_source_id
  for update;

  if source_row.id is null then
    raise exception 'Fuente de caja no encontrada';
  end if;

  if source_row.source = 'own_box' then
    update public.agency_shipment_box_sources
    set allocation_status = 'not_applicable', updated_at = now()
    where id = source_row.id;
    return jsonb_build_object('sourceId', source_row.id, 'allocatedQuantity', 0, 'unfulfilledQuantity', 0);
  end if;

  select coalesce(sum(quantity), 0)::integer into already_allocated
  from public.agency_box_allocations
  where shipment_box_source_id = source_row.id;
  remaining := greatest(source_row.quantity - already_allocated, 0);

  for lot_row in
    select lot.*
    from public.agency_box_lots lot
    where lot.tenant_id = source_row.tenant_id
      and lot.agency_id = source_row.agency_id
      and lot.inventory_item_id = source_row.inventory_item_id
      and lot.product_key = source_row.product_key
      and lot.box_size = source_row.box_size
    order by lot.delivered_at, lot.id
    for update
  loop
    exit when remaining = 0;
    select lot_row.delivered_quantity - coalesce(sum(allocation.quantity), 0)::integer
      into available
    from public.agency_box_allocations allocation
    where allocation.lot_id = lot_row.id;
    available := coalesce(available, lot_row.delivered_quantity);
    if available <= 0 then continue; end if;

    allocate_now := least(available, remaining);
    insert into public.agency_box_allocations (
      tenant_id, organization_id, agency_id, shipment_box_source_id, shipment_id, lot_id, quantity
    ) values (
      source_row.tenant_id, source_row.organization_id, source_row.agency_id,
      source_row.id, source_row.shipment_id, lot_row.id, allocate_now
    )
    on conflict (shipment_box_source_id, lot_id) do nothing;
    if found then
      insert into public.agency_box_movements (
        tenant_id, organization_id, agency_id, lot_id, movement_type, quantity_delta,
        source_operation_type, source_operation_id, actor_membership_id, reason
      ) values (
        source_row.tenant_id, source_row.organization_id, source_row.agency_id,
        lot_row.id, 'used', -allocate_now, 'agency_shipment_box_source', source_row.id,
        source_row.created_by_membership_id, 'Asignacion FIFO a envio'
      ) on conflict (
        tenant_id, source_operation_type, source_operation_id, movement_type, lot_id
      ) do nothing;
      remaining := remaining - allocate_now;
    end if;
  end loop;

  update public.agency_shipment_box_sources
  set allocation_status = case when remaining = 0 then 'allocated' else 'insufficient' end,
      updated_at = now()
  where id = source_row.id;

  return jsonb_build_object(
    'sourceId', source_row.id,
    'allocatedQuantity', source_row.quantity - remaining,
    'unfulfilledQuantity', remaining
  );
end;
$$;

revoke all on function public.agency_allocate_boxes_fifo(uuid) from public, anon, authenticated;
grant execute on function public.agency_allocate_boxes_fifo(uuid) to service_role;

create function public.transition_agency_status(
  target_agency_id uuid,
  target_status text,
  expected_version bigint,
  transition_reason text,
  request_id text,
  idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tenant uuid := public.current_tenant_id();
  actor_membership uuid := public.current_membership_id();
  operation_row public.idempotency_operations;
  agency_row public.agencies;
  previous_status text;
  result_payload jsonb;
  allowed boolean := false;
  operation_key text := btrim($6);
  operation_request_id text := nullif(btrim($5), '');
begin
  if tenant is null or actor_membership is null or nullif(operation_key, '') is null then
    raise exception 'FORBIDDEN';
  end if;

  insert into public.idempotency_operations (
    tenant_id, operation_type, idempotency_key, actor_membership_id, status
  ) values (tenant, 'transition_agency_status', operation_key, actor_membership, 'executing')
  on conflict (tenant_id, operation_type, idempotency_key) do nothing
  returning * into operation_row;

  if operation_row.id is null then
    select * into operation_row from public.idempotency_operations
    where tenant_id = tenant and operation_type = 'transition_agency_status'
      and idempotency_key = operation_key;
    if operation_row.status = 'completed' then
      return operation_row.result || jsonb_build_object('replayed', true);
    end if;
    raise exception 'OPERATION_IN_PROGRESS';
  end if;

  select * into agency_row from public.agencies
  where id = target_agency_id and tenant_id = tenant
  for update;
  if agency_row.id is null
    or not public.current_membership_has_permission(
      'agency.status.transition', tenant, agency_row.organization_id
    ) then
    raise exception 'FORBIDDEN';
  end if;
  if agency_row.status_version <> expected_version then raise exception 'VERSION_CONFLICT'; end if;
  if nullif(btrim(transition_reason), '') is null then raise exception 'Motivo requerido'; end if;

  allowed := case agency_row.status
    when 'prospect' then target_status in ('registration_started', 'rejected', 'closed')
    when 'registration_started' then target_status in ('documents_pending', 'rejected', 'closed')
    when 'documents_pending' then target_status in ('approval_pending', 'rejected', 'closed')
    when 'approval_pending' then target_status in ('activation_pending', 'documents_pending', 'rejected')
    when 'activation_pending' then target_status in ('active', 'rejected')
    when 'active' then target_status in ('temporarily_suspended', 'debt_blocked', 'inactive', 'closed')
    when 'temporarily_suspended' then target_status in ('active', 'inactive', 'closed')
    when 'debt_blocked' then target_status in ('active', 'inactive', 'closed')
    when 'inactive' then target_status in ('active', 'closed')
    else false
  end;
  if not allowed then raise exception 'INVALID_AGENCY_STATUS_TRANSITION'; end if;

  previous_status := agency_row.status;
  update public.agencies
  set status = target_status,
      status_version = status_version + 1,
      archived_at = case when target_status = 'closed' then now() else null end,
      updated_at = now()
  where id = agency_row.id
  returning * into agency_row;

  insert into public.agency_status_history (
    tenant_id, agency_id, previous_status, status, version, actor_membership_id, reason
  ) values (
    tenant, agency_row.id, previous_status, target_status,
    agency_row.status_version, actor_membership, btrim(transition_reason)
  );

  insert into public.immutable_audit_events (
    tenant_id, organization_id, actor_user_id, actor_membership_id, action, entity_type,
    entity_id, before_state, after_state, reason, request_id, idempotency_key, metadata
  ) values (
    tenant, agency_row.organization_id, auth.uid(), actor_membership, 'agency.status.transitioned',
    'agency', agency_row.id,
    jsonb_build_object('status', previous_status, 'version', expected_version),
    jsonb_build_object('status', target_status, 'version', agency_row.status_version),
    btrim(transition_reason), operation_request_id, operation_key, '{}'::jsonb
  );

  result_payload := jsonb_build_object(
    'operationId', operation_row.id, 'replayed', false, 'version', agency_row.status_version,
    'entities', jsonb_build_array(jsonb_build_object('type', 'agency', 'id', agency_row.id))
  );
  update public.idempotency_operations
  set status = 'completed', result = result_payload, completed_at = now()
  where id = operation_row.id;
  return result_payload;
end;
$$;

create function public.assign_agency_captor(
  target_agency_id uuid,
  target_captor_membership_id uuid,
  assignment_reason text,
  request_id text,
  idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tenant uuid := public.current_tenant_id();
  actor_membership uuid := public.current_membership_id();
  operation_row public.idempotency_operations;
  agency_row public.agencies;
  captor_row public.organization_memberships;
  assignment_id uuid;
  previous_assignment_id uuid;
  previous_captor_membership_id uuid;
  result_payload jsonb;
  operation_key text := btrim($5);
  operation_request_id text := nullif(btrim($4), '');
begin
  if tenant is null or actor_membership is null or nullif(operation_key, '') is null then raise exception 'FORBIDDEN'; end if;
  insert into public.idempotency_operations (tenant_id, operation_type, idempotency_key, actor_membership_id, status)
  values (tenant, 'assign_agency_captor', operation_key, actor_membership, 'executing')
  on conflict (tenant_id, operation_type, idempotency_key) do nothing returning * into operation_row;
  if operation_row.id is null then
    select * into operation_row from public.idempotency_operations
    where tenant_id = tenant and operation_type = 'assign_agency_captor' and idempotency_key = operation_key;
    if operation_row.status = 'completed' then return operation_row.result || jsonb_build_object('replayed', true); end if;
    raise exception 'OPERATION_IN_PROGRESS';
  end if;

  select * into agency_row from public.agencies where id = target_agency_id and tenant_id = tenant for update;
  select * into captor_row from public.organization_memberships
  where id = target_captor_membership_id and tenant_id = tenant and status = 'active' and ended_at is null;
  if agency_row.id is null or captor_row.id is null
    or captor_row.role_slug_snapshot not in ('captador_agencias', 'captador_distribuidores')
    or not public.current_membership_has_permission('agency.captor.assign', tenant, agency_row.organization_id) then
    raise exception 'FORBIDDEN';
  end if;
  if nullif(btrim(assignment_reason), '') is null then raise exception 'Motivo requerido'; end if;

  select assignment.id, assignment.captor_membership_id
    into previous_assignment_id, previous_captor_membership_id
  from public.agency_captor_assignments assignment
  where assignment.agency_id = agency_row.id and assignment.ended_at is null
  for update;

  if previous_captor_membership_id is not distinct from captor_row.id then
    result_payload := jsonb_build_object(
      'operationId', operation_row.id, 'replayed', false, 'version', 1,
      'entities', jsonb_build_array(jsonb_build_object(
        'type', 'agency_captor_assignment', 'id', previous_assignment_id
      ))
    );
    insert into public.immutable_audit_events (
      tenant_id, organization_id, actor_user_id, actor_membership_id, action, entity_type,
      entity_id, before_state, after_state, reason, request_id, idempotency_key, metadata
    ) values (
      tenant, agency_row.organization_id, auth.uid(), actor_membership,
      'agency.captor.assignment_unchanged', 'agency_captor_assignment', previous_assignment_id,
      jsonb_build_object('captorMembershipId', captor_row.id),
      jsonb_build_object('captorMembershipId', captor_row.id),
      btrim(assignment_reason), operation_request_id, operation_key, '{}'::jsonb
    );
    update public.idempotency_operations
    set status = 'completed', result = result_payload, completed_at = now()
    where id = operation_row.id;
    return result_payload;
  end if;

  update public.agency_captor_assignments set ended_at = now()
  where agency_id = agency_row.id and ended_at is null;
  insert into public.agency_captor_assignments (
    tenant_id, agency_id, captor_membership_id, assigned_by_membership_id, reason
  ) values (tenant, agency_row.id, captor_row.id, actor_membership, btrim(assignment_reason))
  returning id into assignment_id;

  insert into public.immutable_audit_events (
    tenant_id, organization_id, actor_user_id, actor_membership_id, action, entity_type,
    entity_id, before_state, after_state, reason, request_id, idempotency_key, metadata
  ) values (
    tenant, agency_row.organization_id, auth.uid(), actor_membership, 'agency.captor.assigned',
    'agency_captor_assignment', assignment_id,
    jsonb_build_object(
      'assignmentId', previous_assignment_id,
      'captorMembershipId', previous_captor_membership_id
    ),
    jsonb_build_object('agencyId', agency_row.id, 'captorMembershipId', captor_row.id),
    btrim(assignment_reason), operation_request_id, operation_key, '{}'::jsonb
  );

  result_payload := jsonb_build_object(
    'operationId', operation_row.id, 'replayed', false, 'version', 1,
    'entities', jsonb_build_array(jsonb_build_object('type', 'agency_captor_assignment', 'id', assignment_id))
  );
  update public.idempotency_operations set status = 'completed', result = result_payload, completed_at = now()
  where id = operation_row.id;
  return result_payload;
end;
$$;

create function public.assign_captor_supervisor(
  target_captor_membership_id uuid,
  target_supervisor_membership_id uuid,
  assignment_reason text,
  request_id text,
  idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tenant uuid := public.current_tenant_id();
  actor_membership uuid := public.current_membership_id();
  operation_row public.idempotency_operations;
  captor_row public.organization_memberships;
  supervisor_row public.organization_memberships;
  assignment_id uuid;
  previous_assignment_id uuid;
  previous_supervisor_membership_id uuid;
  result_payload jsonb;
  operation_key text := btrim($5);
  operation_request_id text := nullif(btrim($4), '');
begin
  if tenant is null or actor_membership is null or nullif(operation_key, '') is null then raise exception 'FORBIDDEN'; end if;
  insert into public.idempotency_operations (tenant_id, operation_type, idempotency_key, actor_membership_id, status)
  values (tenant, 'assign_captor_supervisor', operation_key, actor_membership, 'executing')
  on conflict (tenant_id, operation_type, idempotency_key) do nothing returning * into operation_row;
  if operation_row.id is null then
    select * into operation_row from public.idempotency_operations
    where tenant_id = tenant and operation_type = 'assign_captor_supervisor' and idempotency_key = operation_key;
    if operation_row.status = 'completed' then return operation_row.result || jsonb_build_object('replayed', true); end if;
    raise exception 'OPERATION_IN_PROGRESS';
  end if;

  select * into captor_row from public.organization_memberships
  where id = target_captor_membership_id and tenant_id = tenant and status = 'active' and ended_at is null;
  select * into supervisor_row from public.organization_memberships
  where id = target_supervisor_membership_id and tenant_id = tenant and status = 'active' and ended_at is null;
  if captor_row.id is null or supervisor_row.id is null
    or captor_row.role_slug_snapshot not in ('captador_agencias', 'captador_distribuidores')
    or supervisor_row.role_slug_snapshot <> 'supervisor_agencias'
    or not public.current_membership_has_permission(
      'agency.supervisor.assign', tenant, captor_row.organization_id
    ) then raise exception 'FORBIDDEN'; end if;
  if nullif(btrim(assignment_reason), '') is null then raise exception 'Motivo requerido'; end if;

  select assignment.id, assignment.supervisor_membership_id
    into previous_assignment_id, previous_supervisor_membership_id
  from public.captor_supervisor_assignments assignment
  where assignment.captor_membership_id = captor_row.id and assignment.ended_at is null
  for update;

  if previous_supervisor_membership_id is not distinct from supervisor_row.id then
    result_payload := jsonb_build_object(
      'operationId', operation_row.id, 'replayed', false, 'version', 1,
      'entities', jsonb_build_array(jsonb_build_object(
        'type', 'captor_supervisor_assignment', 'id', previous_assignment_id
      ))
    );
    insert into public.immutable_audit_events (
      tenant_id, organization_id, actor_user_id, actor_membership_id, action, entity_type,
      entity_id, before_state, after_state, reason, request_id, idempotency_key, metadata
    ) values (
      tenant, captor_row.organization_id, auth.uid(), actor_membership,
      'captor.supervisor.assignment_unchanged', 'captor_supervisor_assignment', previous_assignment_id,
      jsonb_build_object('supervisorMembershipId', supervisor_row.id),
      jsonb_build_object('supervisorMembershipId', supervisor_row.id),
      btrim(assignment_reason), operation_request_id, operation_key, '{}'::jsonb
    );
    update public.idempotency_operations
    set status = 'completed', result = result_payload, completed_at = now()
    where id = operation_row.id;
    return result_payload;
  end if;

  update public.captor_supervisor_assignments set ended_at = now()
  where captor_membership_id = captor_row.id and ended_at is null;
  insert into public.captor_supervisor_assignments (
    tenant_id, captor_membership_id, supervisor_membership_id, assigned_by_membership_id, reason
  ) values (tenant, captor_row.id, supervisor_row.id, actor_membership, btrim(assignment_reason))
  returning id into assignment_id;

  insert into public.immutable_audit_events (
    tenant_id, organization_id, actor_user_id, actor_membership_id, action, entity_type,
    entity_id, before_state, after_state, reason, request_id, idempotency_key, metadata
  ) values (
    tenant, captor_row.organization_id, auth.uid(), actor_membership, 'captor.supervisor.assigned',
    'captor_supervisor_assignment', assignment_id,
    jsonb_build_object(
      'assignmentId', previous_assignment_id,
      'supervisorMembershipId', previous_supervisor_membership_id
    ),
    jsonb_build_object('captorMembershipId', captor_row.id, 'supervisorMembershipId', supervisor_row.id),
    btrim(assignment_reason), operation_request_id, operation_key, '{}'::jsonb
  );

  result_payload := jsonb_build_object(
    'operationId', operation_row.id, 'replayed', false, 'version', 1,
    'entities', jsonb_build_array(jsonb_build_object('type', 'captor_supervisor_assignment', 'id', assignment_id))
  );
  update public.idempotency_operations set status = 'completed', result = result_payload, completed_at = now()
  where id = operation_row.id;
  return result_payload;
end;
$$;

create function public.confirm_agency_visit(
  target_visit_id uuid,
  line_confirmations jsonb,
  confirmation_reason text,
  request_id text,
  idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tenant uuid := public.current_tenant_id();
  actor_membership uuid := public.current_membership_id();
  operation_row public.idempotency_operations;
  visit_row public.agency_visits;
  visit_line_row record;
  confirmation_json jsonb;
  request_row record;
  batch_id uuid;
  lot_id uuid;
  line_count integer;
  confirmation_count integer;
  duplicate_count integer;
  confirmed_value integer;
  difference_value integer;
  difference_reason_value text;
  evidence_value jsonb;
  inventory_stock_id uuid;
  inventory_stock_quantity numeric;
  inventory_item_name text;
  final_visit_status text;
  final_request_status text;
  result_payload jsonb;
  operation_key text := btrim($5);
  operation_request_id text := nullif(btrim($4), '');
begin
  if tenant is null or actor_membership is null or nullif(operation_key, '') is null then raise exception 'FORBIDDEN'; end if;
  if jsonb_typeof(line_confirmations) <> 'array' or jsonb_array_length(line_confirmations) = 0 then
    raise exception 'La visita debe incluir confirmaciones';
  end if;

  insert into public.idempotency_operations (tenant_id, operation_type, idempotency_key, actor_membership_id, status)
  values (tenant, 'confirm_agency_visit', operation_key, actor_membership, 'executing')
  on conflict (tenant_id, operation_type, idempotency_key) do nothing returning * into operation_row;
  if operation_row.id is null then
    select * into operation_row from public.idempotency_operations
    where tenant_id = tenant and operation_type = 'confirm_agency_visit' and idempotency_key = operation_key;
    if operation_row.status = 'completed' then return operation_row.result || jsonb_build_object('replayed', true); end if;
    raise exception 'OPERATION_IN_PROGRESS';
  end if;

  select * into visit_row from public.agency_visits
  where id = target_visit_id and tenant_id = tenant
  for update;
  if visit_row.id is null
    or not public.current_membership_has_permission('agency.visits.confirm', tenant, visit_row.organization_id) then
    raise exception 'FORBIDDEN';
  end if;
  if visit_row.status not in ('scheduled', 'assigned', 'in_route') or visit_row.confirmed_at is not null then
    raise exception 'VISIT_ALREADY_FINALIZED';
  end if;

  select count(*) into line_count from public.agency_visit_lines where visit_id = visit_row.id;
  select count(*), count(*) - count(distinct item->>'visitLineId')
    into confirmation_count, duplicate_count
  from jsonb_array_elements(line_confirmations) item;
  if line_count = 0 or confirmation_count <> line_count or duplicate_count <> 0 then
    raise exception 'Cada linea de visita debe confirmarse exactamente una vez';
  end if;
  if exists (
    select 1 from jsonb_array_elements(line_confirmations) item
    left join public.agency_visit_lines line
      on line.id::text = item->>'visitLineId' and line.visit_id = visit_row.id
    where line.id is null
  ) then raise exception 'Confirmacion de linea invalida'; end if;

  for visit_line_row in
    select line.*, request_line.service_kind, request_line.request_id,
      request_line.inventory_item_id, request_line.matrix_warehouse_id,
      request_line.product_key, request_line.box_size,
      request_line.unit_charge_amount_cents, request_line.currency,
      agency.matrix_organization_id
    from public.agency_visit_lines line
    join public.agency_service_request_lines request_line on request_line.id = line.request_line_id
    join public.agencies agency on agency.id = visit_row.agency_id
    where line.visit_id = visit_row.id
    order by line.created_at, line.id
    for update of line
  loop
    select item.value into confirmation_json
    from jsonb_array_elements(line_confirmations) as item(value)
    where item.value->>'visitLineId' = visit_line_row.id::text;
    if jsonb_typeof(confirmation_json->'confirmedQuantity') <> 'number'
      or (confirmation_json->>'confirmedQuantity') !~ '^[0-9]+$' then
      raise exception 'Cantidad confirmada invalida';
    end if;
    confirmed_value := (confirmation_json->>'confirmedQuantity')::integer;
    difference_value := confirmed_value - visit_line_row.requested_quantity;
    difference_reason_value := btrim(coalesce(confirmation_json->>'differenceReason', ''));
    evidence_value := coalesce(confirmation_json->'evidence', '{}'::jsonb);
    if jsonb_typeof(evidence_value) <> 'object' then raise exception 'Evidencia invalida'; end if;
    if difference_value <> 0 and difference_reason_value = '' then raise exception 'Toda diferencia requiere motivo'; end if;

    update public.agency_visit_lines
    set confirmed_quantity = confirmed_value,
        difference_quantity = difference_value,
        difference_reason = difference_reason_value,
        evidence = evidence_value,
        responsible_membership_id = actor_membership,
        confirmed_at = now(),
        updated_at = now()
    where id = visit_line_row.id;

    if confirmed_value > 0 and visit_line_row.unit_charge_amount_cents > 0 then
      insert into public.agency_charges (
        tenant_id, matrix_organization_id, agency_organization_id, concept,
        source_operation_type, source_operation_id, amount_cents, currency,
        created_by_membership_id, idempotency_key, metadata
      ) values (
        tenant, visit_line_row.matrix_organization_id, visit_row.organization_id,
        case visit_line_row.service_kind
          when 'empty_box_delivery' then 'empty_box'
          when 'full_box_pickup' then 'home_pickup'
          else visit_line_row.service_kind
        end,
        'agency_visit_line', visit_line_row.id,
        visit_line_row.unit_charge_amount_cents * confirmed_value, 'USD', actor_membership,
        operation_key || ':' || visit_line_row.id::text,
        jsonb_build_object(
          'visitId', visit_row.id, 'requestId', visit_line_row.request_id,
          'quantity', confirmed_value, 'unitAmountCents', visit_line_row.unit_charge_amount_cents
        )
      )
      on conflict (tenant_id, source_operation_type, source_operation_id, concept) do nothing;
    end if;

    if visit_line_row.service_kind = 'empty_box_delivery' and confirmed_value > 0 then
      select stock.id, stock.stock, item.name
        into inventory_stock_id, inventory_stock_quantity, inventory_item_name
      from public.inventory_stock stock
      join public.inventory_items item on item.id = stock.item_id
      where stock.organization_id = visit_line_row.matrix_organization_id
        and stock.warehouse_id = visit_line_row.matrix_warehouse_id
        and stock.item_id = visit_line_row.inventory_item_id
      for update of stock;
      if inventory_stock_id is null then raise exception 'Stock de caja no encontrado'; end if;
      if inventory_stock_quantity < confirmed_value then raise exception 'Stock insuficiente de cajas'; end if;

      update public.inventory_stock set stock = stock - confirmed_value where id = inventory_stock_id;
      insert into public.inventory_movements (
        organization_id, warehouse_id, item_id, item_name, type, qty, note, created_by
      ) values (
        visit_line_row.matrix_organization_id, visit_line_row.matrix_warehouse_id,
        visit_line_row.inventory_item_id, inventory_item_name, 'salida', confirmed_value,
        'Entrega confirmada a agencia en visita ' || visit_row.id::text, auth.uid()
      );

      if batch_id is null then
        insert into public.agency_box_batches (
          tenant_id, organization_id, agency_id, source_visit_id,
          delivered_by_membership_id, delivered_at
        ) values (
          tenant, visit_row.organization_id, visit_row.agency_id, visit_row.id,
          actor_membership, now()
        ) returning id into batch_id;
      end if;
      insert into public.agency_box_lots (
        tenant_id, organization_id, agency_id, batch_id, source_visit_line_id,
        inventory_item_id, product_key, box_size, delivered_quantity, delivered_at
      ) values (
        tenant, visit_row.organization_id, visit_row.agency_id, batch_id, visit_line_row.id,
        visit_line_row.inventory_item_id, visit_line_row.product_key,
        visit_line_row.box_size, confirmed_value, now()
      ) returning id into lot_id;
      insert into public.agency_box_movements (
        tenant_id, organization_id, agency_id, lot_id, movement_type, quantity_delta,
        source_operation_type, source_operation_id, actor_membership_id, reason
      ) values (
        tenant, visit_row.organization_id, visit_row.agency_id, lot_id, 'delivered', confirmed_value,
        'agency_visit_line', visit_line_row.id, actor_membership, coalesce(confirmation_reason, '')
      );
    end if;
  end loop;

  for request_row in
    select request.id, request.status, request.status_version
    from public.agency_service_requests request
    where request.id in (
      select request_line.request_id
      from public.agency_service_request_lines request_line
      join public.agency_visit_lines visit_line on visit_line.request_line_id = request_line.id
      where visit_line.visit_id = visit_row.id
    )
    for update
  loop
    update public.agency_service_request_lines request_line
    set confirmed_quantity = aggregate.confirmed_quantity, updated_at = now()
    from (
      select line.request_line_id, coalesce(sum(line.confirmed_quantity), 0)::integer confirmed_quantity
      from public.agency_visit_lines line
      where line.confirmed_at is not null
      group by line.request_line_id
    ) aggregate
    where request_line.id = aggregate.request_line_id and request_line.request_id = request_row.id;

    select case when bool_and(line.confirmed_quantity = line.requested_quantity)
      then 'completed' else 'partially_completed' end
      into final_request_status
    from public.agency_service_request_lines line
    where line.request_id = request_row.id;

    update public.agency_service_requests
    set status = final_request_status, status_version = status_version + 1, updated_at = now()
    where id = request_row.id;
    insert into public.agency_request_status_history (
      tenant_id, organization_id, request_id, previous_status, status,
      status_version, actor_membership_id, reason
    ) values (
      tenant, visit_row.organization_id, request_row.id, request_row.status,
      final_request_status, request_row.status_version + 1, actor_membership,
      coalesce(confirmation_reason, '')
    );
  end loop;

  select case when bool_and(confirmed_quantity = requested_quantity)
    then 'completed' else 'partially_completed' end
    into final_visit_status
  from public.agency_visit_lines where visit_id = visit_row.id;
  update public.agency_visits
  set status = final_visit_status, status_version = status_version + 1,
      confirmed_by_membership_id = actor_membership, confirmed_at = now(), updated_at = now()
  where id = visit_row.id;
  insert into public.agency_visit_status_history (
    tenant_id, organization_id, visit_id, previous_status, status,
    status_version, actor_membership_id, reason
  ) values (
    tenant, visit_row.organization_id, visit_row.id, visit_row.status, final_visit_status,
    visit_row.status_version + 1, actor_membership, coalesce(confirmation_reason, '')
  );

  insert into public.immutable_audit_events (
    tenant_id, organization_id, actor_user_id, actor_membership_id, action, entity_type,
    entity_id, before_state, after_state, reason, request_id, idempotency_key, metadata
  ) values (
    tenant, visit_row.organization_id, auth.uid(), actor_membership, 'agency.visit.confirmed',
    'agency_visit', visit_row.id,
    jsonb_build_object('status', visit_row.status, 'version', visit_row.status_version),
    jsonb_build_object('status', final_visit_status, 'version', visit_row.status_version + 1),
    coalesce(confirmation_reason, ''), operation_request_id, operation_key,
    jsonb_build_object('lineCount', line_count)
  );

  result_payload := jsonb_build_object(
    'operationId', operation_row.id, 'replayed', false, 'version', visit_row.status_version + 1,
    'entities', jsonb_build_array(
      jsonb_build_object('type', 'agency_visit', 'id', visit_row.id),
      jsonb_build_object('type', 'agency', 'id', visit_row.agency_id)
    )
  );
  update public.idempotency_operations set status = 'completed', result = result_payload, completed_at = now()
  where id = operation_row.id;
  return result_payload;
end;
$$;

grant execute on function public.transition_agency_status(uuid, text, bigint, text, text, text) to authenticated;
grant execute on function public.assign_agency_captor(uuid, uuid, text, text, text) to authenticated;
grant execute on function public.assign_captor_supervisor(uuid, uuid, text, text, text) to authenticated;
grant execute on function public.confirm_agency_visit(uuid, jsonb, text, text, text) to authenticated;

revoke insert, update, delete on public.agency_status_history from authenticated;
revoke insert, update, delete on public.agency_request_status_history from authenticated;
revoke insert, update, delete on public.agency_visit_status_history from authenticated;
revoke insert, update, delete on public.agency_box_movements from authenticated;
revoke insert, update, delete on public.agency_box_allocations from authenticated;
