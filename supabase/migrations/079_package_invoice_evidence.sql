-- Every physical box is identified by the invoice code written on it.
-- Delivery and collection evidence use the driver's offline-first task photo.

alter table public.shipment_packages
  add column if not exists invoice_code text not null default '',
  add column if not exists invoice_marked_at timestamptz,
  add column if not exists invoice_marked_by uuid references public.profiles(id) on delete set null,
  add column if not exists invoice_delivery_evidence_url text not null default '',
  add column if not exists invoice_pickup_confirmed_at timestamptz,
  add column if not exists invoice_pickup_confirmed_by uuid references public.profiles(id) on delete set null,
  add column if not exists invoice_pickup_evidence_url text not null default '',
  add column if not exists invoice_incident_at timestamptz,
  add column if not exists invoice_incident_reason text not null default '';

update public.shipment_packages
set invoice_code = regexp_replace(code, '-[0-9]{2}$', '')
where invoice_code = '';

alter table public.shipment_logistics_task_attempts
  add column if not exists invoice_visible boolean not null default false;

create index if not exists idx_shipment_packages_invoice_pending
  on public.shipment_packages (organization_id, invoice_marked_at, invoice_pickup_confirmed_at)
  where invoice_marked_at is null or invoice_pickup_confirmed_at is null;
