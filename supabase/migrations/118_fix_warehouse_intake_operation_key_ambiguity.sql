-- Migration 117 was applied locally before PostgreSQL exposed that an input
-- parameter named operation_key conflicts with columns of the same name.
-- Positional references preserve the public RPC signature and remove ambiguity.

do $migration$
declare
  definition text;
begin
  select pg_get_functiondef('public.open_warehouse_intake(uuid,uuid,text)'::regprocedure)
    into definition;
  execute replace(definition, 'btrim(operation_key)', 'btrim($3)');

  select pg_get_functiondef('public.scan_warehouse_intake_package(uuid,text,numeric,text,text,text,uuid,text)'::regprocedure)
    into definition;
  execute replace(definition, 'btrim(operation_key)', 'btrim($8)');

  select pg_get_functiondef('public.close_warehouse_intake(uuid,boolean,text,boolean,text)'::regprocedure)
    into definition;
  execute replace(definition, 'btrim(operation_key)', 'btrim($5)');

  select pg_get_functiondef('public.reopen_warehouse_intake(uuid,text,text)'::regprocedure)
    into definition;
  execute replace(definition, 'btrim(operation_key)', 'btrim($3)');
end;
$migration$;
