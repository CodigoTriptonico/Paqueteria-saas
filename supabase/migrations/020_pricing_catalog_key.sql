-- Enlace estable entre cajas de pricing y productos del catálogo de inventario

alter table public.pricing_country_boxes
  add column if not exists catalog_key text;

create unique index if not exists idx_pricing_country_boxes_country_catalog
  on public.pricing_country_boxes (country_id, catalog_key)
  where catalog_key is not null;
