-- Keep a warehouse discrepancy visible until an authorized user reviews it.

alter table public.shipment_packages
  add column if not exists weight_difference_reviewed_at timestamptz,
  add column if not exists weight_difference_reviewed_by uuid references public.profiles(id) on delete set null;

create index if not exists idx_shipment_packages_weight_review
  on public.shipment_packages(organization_id, weight_difference_reviewed_at)
  where weight_difference_kg is not null;
