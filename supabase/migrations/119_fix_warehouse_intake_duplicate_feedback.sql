-- Report a duplicate in the current intake before the package's new custody
-- state produces the less useful PACKAGE_ALREADY_RECEIVED error.

do $migration$
declare
  definition text;
  marker text := '  select * into package_row from public.shipment_packages package';
  duplicate_guard text := $guard$  if exists (
    select 1 from public.warehouse_intake_items item
    where item.session_id = session_row.id and lower(item.scanned_code) = lower(btrim(scanned_code_value))
  ) then raise exception 'PACKAGE_ALREADY_SCANNED'; end if;

$guard$;
begin
  select pg_get_functiondef('public.scan_warehouse_intake_package(uuid,text,numeric,text,text,text,uuid,text)'::regprocedure)
    into definition;
  if position('lower(item.scanned_code)' in definition) = 0 then
    execute replace(definition, marker, duplicate_guard || marker);
  end if;
end;
$migration$;
