-- Pricing countries, boxes, distributors, route settings

create table public.pricing_countries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  code text not null,
  name text not null,
  delivery_time text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.pricing_country_boxes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  country_id uuid not null references public.pricing_countries (id) on delete cascade,
  size text not null,
  price text not null default '$0',
  cost text not null default '$0',
  unique (country_id, size)
);

create table public.distributors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  contact text not null default '',
  phone text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.distributor_country_boxes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  distributor_id uuid not null references public.distributors (id) on delete cascade,
  country_id uuid not null references public.pricing_countries (id) on delete cascade,
  size text not null,
  price text not null default '$0',
  unique (distributor_id, country_id, size)
);

create table public.organization_route_settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  delivery_days text[] not null default '{}',
  pickup_days text[] not null default '{}',
  delivery_ranges text[] not null default '{}',
  pickup_ranges text[] not null default '{}',
  pending_allowed boolean not null default true,
  route_lead_time text not null default '',
  updated_at timestamptz not null default now()
);

create index idx_pricing_countries_org on public.pricing_countries (organization_id);
create index idx_pricing_country_boxes_org on public.pricing_country_boxes (organization_id);
create index idx_distributors_org on public.distributors (organization_id);
create index idx_distributor_country_boxes_org on public.distributor_country_boxes (organization_id);

alter table public.pricing_countries enable row level security;
alter table public.pricing_country_boxes enable row level security;
alter table public.distributors enable row level security;
alter table public.distributor_country_boxes enable row level security;
alter table public.organization_route_settings enable row level security;

create policy pricing_countries_select on public.pricing_countries for select
  using (
    organization_id = public.current_organization_id()
    and (public.user_has_permission('settings.manage') or public.user_has_permission('sales.manage'))
  );

create policy pricing_countries_write on public.pricing_countries for all
  using (
    organization_id = public.current_organization_id()
    and public.user_has_permission('settings.manage')
  );

create policy pricing_country_boxes_select on public.pricing_country_boxes for select
  using (
    organization_id = public.current_organization_id()
    and (public.user_has_permission('settings.manage') or public.user_has_permission('sales.manage'))
  );

create policy pricing_country_boxes_write on public.pricing_country_boxes for all
  using (
    organization_id = public.current_organization_id()
    and public.user_has_permission('settings.manage')
  );

create policy distributors_select on public.distributors for select
  using (
    organization_id = public.current_organization_id()
    and (public.user_has_permission('settings.manage') or public.user_has_permission('sales.manage'))
  );

create policy distributors_write on public.distributors for all
  using (
    organization_id = public.current_organization_id()
    and public.user_has_permission('settings.manage')
  );

create policy distributor_country_boxes_select on public.distributor_country_boxes for select
  using (
    organization_id = public.current_organization_id()
    and (public.user_has_permission('settings.manage') or public.user_has_permission('sales.manage'))
  );

create policy distributor_country_boxes_write on public.distributor_country_boxes for all
  using (
    organization_id = public.current_organization_id()
    and public.user_has_permission('settings.manage')
  );

create policy organization_route_settings_select on public.organization_route_settings for select
  using (
    organization_id = public.current_organization_id()
    and (public.user_has_permission('settings.manage') or public.user_has_permission('sales.manage'))
  );

create policy organization_route_settings_write on public.organization_route_settings for all
  using (
    organization_id = public.current_organization_id()
    and public.user_has_permission('settings.manage')
  );
