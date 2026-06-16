alter table public.customers
  add column if not exists referred_by_customer_id uuid references public.customers (id) on delete set null;

create index if not exists idx_customers_referred_by
  on public.customers (organization_id, referred_by_customer_id);
