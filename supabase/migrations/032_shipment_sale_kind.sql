-- Sale kind and delivery notes for full shipments vs empty-box deposits

alter table public.shipments
  add column if not exists sale_kind text not null default 'full',
  add column if not exists delivery_notes text not null default '';
