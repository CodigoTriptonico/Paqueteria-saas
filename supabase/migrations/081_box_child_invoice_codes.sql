-- A sale remains one financial invoice. Each physical box gets a linked child
-- invoice so the label written on the box is INV-000123/A, /B, /C, etc.

create or replace function public.invoice_box_child_code(parent_invoice_code text, box_index integer)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  value integer := greatest(coalesce(box_index, 0), 0);
  suffix text := '';
begin
  loop
    suffix := substr(alphabet, (value % 26) + 1, 1) || suffix;
    value := floor(value / 26.0)::integer - 1;
    exit when value < 0;
  end loop;

  return btrim(parent_invoice_code) || '/' || suffix;
end;
$$;

with numbered_packages as (
  select
    package.id,
    shipment.code as parent_invoice_code,
    row_number() over (
      partition by package.shipment_id
      order by package.created_at, package.id
    )::integer - 1 as box_index
  from public.shipment_packages package
  join public.shipments shipment on shipment.id = package.shipment_id
)
update public.shipment_packages package
set invoice_code = public.invoice_box_child_code(
  numbered_packages.parent_invoice_code,
  numbered_packages.box_index
)
from numbered_packages
where package.id = numbered_packages.id;
