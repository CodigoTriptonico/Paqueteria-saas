-- Invoice billing: minimum deposit and logistics fee mode (per trip vs per box).

alter table public.organization_route_settings
  add column if not exists minimum_deposit text not null default '$20',
  add column if not exists logistics_fee_mode text not null default 'per_trip'
    check (logistics_fee_mode in ('per_trip', 'per_box'));
