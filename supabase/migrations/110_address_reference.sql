-- Free-text delivery references (floor, house color, landmarks, etc.)

alter table public.customers
  add column if not exists address_reference text not null default '';

alter table public.customer_recipients
  add column if not exists address_reference text not null default '';
