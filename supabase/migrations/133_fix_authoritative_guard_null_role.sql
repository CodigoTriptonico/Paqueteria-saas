-- Administrative PostgreSQL sessions do not carry request.jwt.claim.role.
-- Keep authenticated application writes command-only without blocking the
-- migration runner, backups, or transactional local integration fixtures.

create or replace function public.guard_authoritative_shipment_writes()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if auth.role() is distinct from 'authenticated' then
    return coalesce(new, old);
  end if;
  if tg_op in ('INSERT', 'DELETE') then
    raise exception 'SHIPMENT_COMMAND_REQUIRED';
  end if;
  if new.paid is distinct from old.paid
    or new.profit is distinct from old.profit
    or new.invoice_status is distinct from old.invoice_status
    or new.accounting_status is distinct from old.accounting_status
    or new.finalized_at is distinct from old.finalized_at
    or new.logistics_plan is distinct from old.logistics_plan
    or new.public_tracking_token_hash is distinct from old.public_tracking_token_hash
    or new.public_tracking_expires_at is distinct from old.public_tracking_expires_at
    or new.public_tracking_revoked_at is distinct from old.public_tracking_revoked_at
  then
    raise exception 'SHIPMENT_AUTHORITATIVE_COLUMNS_COMMAND_REQUIRED';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_authoritative_shipment_writes()
  from public, anon, authenticated;

create or replace function public.guard_inventory_stock_direct_write()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if auth.role() is distinct from 'authenticated' then
    return coalesce(new, old);
  end if;
  if tg_op = 'INSERT' then
    if coalesce(new.stock, 0) <> 0 or coalesce(new.reserved, 0) <> 0
       or coalesce(new.assigned, 0) <> 0 or coalesce(new.unavailable, 0) <> 0 then
      raise exception 'INVENTORY_MOVEMENT_COMMAND_REQUIRED';
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    if coalesce(old.stock, 0) <> 0 or coalesce(old.reserved, 0) <> 0
       or coalesce(old.assigned, 0) <> 0 or coalesce(old.unavailable, 0) <> 0 then
      raise exception 'INVENTORY_STOCK_WITH_BALANCE_IMMUTABLE';
    end if;
    return old;
  end if;
  if new.stock is distinct from old.stock
    or new.reserved is distinct from old.reserved
    or new.assigned is distinct from old.assigned
    or new.unavailable is distinct from old.unavailable
    or new.avg_cost is distinct from old.avg_cost
  then
    raise exception 'INVENTORY_MOVEMENT_COMMAND_REQUIRED';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_inventory_stock_direct_write()
  from public, anon, authenticated;
