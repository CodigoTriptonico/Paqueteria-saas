-- Close direct balance probing: a distributor may only read its own account,
-- and the matrix may only read accounts linked to its current organization.

create or replace function public.distribution_partner_balance(target_partner_id uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  partner public.distribution_partners;
begin
  select * into partner from public.distribution_partners where id = target_partner_id;
  if partner.id is null
     or public.current_organization_id() not in (partner.parent_organization_id, partner.distributor_organization_id) then
    raise exception 'FORBIDDEN';
  end if;

  return coalesce((
    select sum(amount)::numeric
    from public.distribution_partner_ledger
    where partner_id = target_partner_id
  ), 0);
end;
$$;

grant execute on function public.distribution_partner_balance(uuid) to authenticated;
