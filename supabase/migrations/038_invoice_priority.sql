-- Mark invoices that need priority handling in envios.

alter table public.shipments
  add column if not exists invoice_priority boolean not null default false;
