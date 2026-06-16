-- Customers (remitentes) and recipients for sales flow

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  phones text[] not null default '{}',
  email text not null default '',
  street text not null default '',
  house_number text not null default '',
  neighborhood text not null default '',
  city text not null default '',
  state text not null default '',
  postal_code text not null default '',
  country text not null default 'USA',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customer_recipients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  phone text not null,
  country text not null,
  street text not null default '',
  house_number text not null default '',
  neighborhood text not null default '',
  city text not null default '',
  state text not null default '',
  postal_code text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_customers_org on public.customers (organization_id);
create index idx_customers_org_active on public.customers (organization_id, is_active);
create index idx_customer_recipients_customer on public.customer_recipients (customer_id);
create index idx_customer_recipients_org on public.customer_recipients (organization_id);

alter table public.customers enable row level security;
alter table public.customer_recipients enable row level security;

create or replace function public.can_manage_customers()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.user_has_permission('sales.manage')
    or public.user_has_permission('customers.manage');
$$;

create policy customers_select on public.customers for select
  using (
    organization_id = public.current_organization_id()
    and public.can_manage_customers()
  );

create policy customers_insert on public.customers for insert
  with check (
    organization_id = public.current_organization_id()
    and public.can_manage_customers()
  );

create policy customers_update on public.customers for update
  using (
    organization_id = public.current_organization_id()
    and public.can_manage_customers()
  );

create policy customers_delete on public.customers for delete
  using (
    organization_id = public.current_organization_id()
    and public.can_manage_customers()
  );

create policy customer_recipients_select on public.customer_recipients for select
  using (
    organization_id = public.current_organization_id()
    and public.can_manage_customers()
  );

create policy customer_recipients_insert on public.customer_recipients for insert
  with check (
    organization_id = public.current_organization_id()
    and public.can_manage_customers()
  );

create policy customer_recipients_update on public.customer_recipients for update
  using (
    organization_id = public.current_organization_id()
    and public.can_manage_customers()
  );

create policy customer_recipients_delete on public.customer_recipients for delete
  using (
    organization_id = public.current_organization_id()
    and public.can_manage_customers()
  );
