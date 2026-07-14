-- Keep the original email while allowing more than one billing/contact email per customer.

alter table public.customers
  add column if not exists emails text[] not null default '{}'::text[];

update public.customers
set emails = array_remove(array[lower(nullif(btrim(email), ''))], null)
where coalesce(cardinality(emails), 0) = 0
  and nullif(btrim(email), '') is not null;
