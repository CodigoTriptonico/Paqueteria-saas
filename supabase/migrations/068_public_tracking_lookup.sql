-- Búsqueda pública: el código se valida además contra el teléfono del remitente en servidor.
create index if not exists idx_shipments_code on public.shipments (code);
