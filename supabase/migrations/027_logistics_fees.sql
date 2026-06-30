-- Local logistics fees: empty-box delivery and full-box pickup at home.

alter table public.organization_route_settings
  add column if not exists empty_box_delivery_fee text not null default '$0',
  add column if not exists full_box_pickup_fee text not null default '$0';
