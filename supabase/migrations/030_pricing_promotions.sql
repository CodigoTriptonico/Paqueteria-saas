-- Promociones por pais y producto

create table public.pricing_promotions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  country_id uuid not null references public.pricing_countries (id) on delete cascade,
  catalog_key text not null,
  name text not null,
  is_active boolean not null default true,
  promotion_type text not null default 'bundle_price'
    check (promotion_type in ('bundle_price', 'extra_discount')),
  bundle_quantity int not null default 2 check (bundle_quantity >= 1),
  bundle_price text not null default '$0',
  paid_quantity int not null default 2 check (paid_quantity >= 1),
  discounted_quantity int not null default 1 check (discounted_quantity >= 1),
  discount_percent numeric(5,2) not null default 100
    check (discount_percent >= 0 and discount_percent <= 100),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_pricing_promotions_org on public.pricing_promotions (organization_id);
create index idx_pricing_promotions_country on public.pricing_promotions (country_id);
create index idx_pricing_promotions_country_catalog
  on public.pricing_promotions (country_id, catalog_key);

alter table public.pricing_promotions enable row level security;

create policy pricing_promotions_select on public.pricing_promotions for select
  using (
    organization_id = public.current_organization_id()
    and (public.user_has_permission('settings.manage') or public.user_has_permission('sales.manage'))
  );

create policy pricing_promotions_write on public.pricing_promotions for all
  using (
    organization_id = public.current_organization_id()
    and public.user_has_permission('settings.manage')
  );
