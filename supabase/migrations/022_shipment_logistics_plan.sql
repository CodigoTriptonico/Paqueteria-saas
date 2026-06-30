-- Structured logistics for empty-box delivery and full-box pickup.

alter table public.shipments
  add column if not exists logistics_plan jsonb not null default '{}'::jsonb;
