-- Bodega favorita del usuario (inventario abre aquí si tiene acceso).

alter table public.profiles
  add column if not exists default_warehouse_id uuid references public.warehouses (id) on delete set null;
