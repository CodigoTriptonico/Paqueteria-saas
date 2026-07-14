-- Allow contact emails on customer recipients (destinatarios), same shape as customers.

alter table public.customer_recipients
  add column if not exists email text not null default '',
  add column if not exists emails text[] not null default '{}'::text[];

update public.customer_recipients
set emails = array_remove(array[lower(nullif(btrim(email), ''))], null)
where coalesce(cardinality(emails), 0) = 0
  and nullif(btrim(email), '') is not null;
