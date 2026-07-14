-- Independent distributors: the matrix owns operations while each distributor
-- owns its public sale price. The only receivable for the matrix is the
-- immutable wholesale charge created for each distributor sale.

insert into public.permissions (key, name, description) values
  ('distribution.manage', 'Distribuidores', 'Configurar distribuidores, tarifas internas y cobros'),
  ('distribution.sell', 'Ventas de distribuidor', 'Registrar ventas propias con la matriz')
on conflict (key) do nothing;

create table public.distribution_partners (
  id uuid primary key default gen_random_uuid(),
  parent_organization_id uuid not null references public.organizations(id) on delete cascade,
  distributor_organization_id uuid not null references public.organizations(id) on delete cascade,
  credit_limit numeric(12,2) not null check (credit_limit >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (parent_organization_id, distributor_organization_id),
  check (parent_organization_id <> distributor_organization_id)
);

create index idx_distribution_partners_parent
  on public.distribution_partners(parent_organization_id, is_active);
create index idx_distribution_partners_distributor
  on public.distribution_partners(distributor_organization_id, is_active);

create table public.distribution_partner_offers (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.distribution_partners(id) on delete cascade,
  country_name text not null,
  catalog_key text not null,
  product_name text not null,
  wholesale_price numeric(12,2) not null check (wholesale_price >= 0),
  public_price numeric(12,2) check (public_price is null or public_price > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partner_id, country_name, catalog_key)
);

create index idx_distribution_partner_offers_partner
  on public.distribution_partner_offers(partner_id, is_active);

create table public.distribution_partner_ledger (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.distribution_partners(id) on delete cascade,
  shipment_id uuid references public.shipments(id) on delete set null,
  kind text not null check (kind in ('charge', 'payment', 'reversal')),
  amount numeric(12,2) not null check (amount <> 0),
  note text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    (kind = 'charge' and amount > 0)
    or (kind in ('payment', 'reversal') and amount < 0)
  )
);

create unique index idx_distribution_ledger_one_charge
  on public.distribution_partner_ledger(shipment_id)
  where kind = 'charge';
create unique index idx_distribution_ledger_one_reversal
  on public.distribution_partner_ledger(shipment_id)
  where kind = 'reversal';
create index idx_distribution_partner_ledger_balance
  on public.distribution_partner_ledger(partner_id, created_at desc);

alter table public.shipments
  add column if not exists distribution_partner_id uuid references public.distribution_partners(id) on delete set null,
  add column if not exists distributor_public_price numeric(12,2),
  add column if not exists distributor_wholesale_price numeric(12,2);

alter table public.shipments
  drop constraint if exists shipments_distributor_price_check;
alter table public.shipments
  add constraint shipments_distributor_price_check check (
    distribution_partner_id is null
    or (
      distributor_public_price is not null and distributor_public_price > 0
      and distributor_wholesale_price is not null and distributor_wholesale_price >= 0
    )
  );

create index idx_shipments_distribution_partner
  on public.shipments(distribution_partner_id, created_at desc)
  where distribution_partner_id is not null;

alter table public.distribution_partners enable row level security;
alter table public.distribution_partner_offers enable row level security;
alter table public.distribution_partner_ledger enable row level security;

-- Every interaction goes through the narrowly-scoped RPCs below. Direct table
-- access is deliberately denied so a distributor cannot forge its price or debt.
create policy distribution_partners_deny_direct on public.distribution_partners
  for all using (false) with check (false);
create policy distribution_partner_offers_deny_direct on public.distribution_partner_offers
  for all using (false) with check (false);
create policy distribution_partner_ledger_deny_direct on public.distribution_partner_ledger
  for all using (false) with check (false);

create or replace function public.distribution_partner_balance(target_partner_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(amount), 0)::numeric
  from public.distribution_partner_ledger
  where partner_id = target_partner_id;
$$;

create or replace function public.distribution_assert_parent_manager(target_partner_id uuid)
returns public.distribution_partners
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  partner public.distribution_partners;
begin
  select * into partner
  from public.distribution_partners
  where id = target_partner_id;

  if partner.id is null
     or partner.parent_organization_id is distinct from public.current_organization_id()
     or not public.user_has_permission('settings.manage') then
    raise exception 'FORBIDDEN';
  end if;

  return partner;
end;
$$;

create or replace function public.distribution_create_sale(
  target_offer_id uuid,
  customer_name_input text,
  recipient_snapshot_input jsonb,
  carrier_input text default '',
  delivery_notes_input text default ''
)
returns table (shipment_id uuid, shipment_code text, wholesale_price numeric, public_price numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  partner public.distribution_partners;
  offer public.distribution_partner_offers;
  source_box public.pricing_country_boxes;
  source_country public.pricing_countries;
  next_number int;
  owner_profile_id uuid;
  created_shipment_id uuid;
  created_shipment_code text;
  current_balance numeric;
  trimmed_customer_name text := btrim(coalesce(customer_name_input, ''));
begin
  select p.* into partner
  from public.distribution_partners p
  where p.distributor_organization_id = public.current_organization_id()
    and p.is_active = true
  for update;

  if partner.id is null or not public.user_has_permission('distribution.sell') then
    raise exception 'FORBIDDEN';
  end if;

  select * into offer
  from public.distribution_partner_offers
  where id = target_offer_id
    and partner_id = partner.id
    and is_active = true;

  if offer.id is null or offer.public_price is null or offer.public_price <= 0 then
    raise exception 'Producto sin precio publico activo';
  end if;

  select * into source_country
  from public.pricing_countries
  where organization_id = partner.parent_organization_id
    and name = offer.country_name;

  select * into source_box
  from public.pricing_country_boxes
  where organization_id = partner.parent_organization_id
    and country_id = source_country.id
    and catalog_key = offer.catalog_key;

  if source_box.id is null
     or source_country.id is null
     or source_box.organization_id <> partner.parent_organization_id
     or source_country.organization_id <> partner.parent_organization_id then
    raise exception 'Producto mayorista invalido';
  end if;

  if trimmed_customer_name = '' then
    raise exception 'Falta el nombre del cliente';
  end if;

  select public.distribution_partner_balance(partner.id) into current_balance;
  if current_balance + offer.wholesale_price > partner.credit_limit then
    raise exception 'Limite de credito alcanzado';
  end if;

  insert into public.organization_invoice_counters (organization_id, last_number)
  values (partner.parent_organization_id, 1)
  on conflict (organization_id) do update
  set last_number = public.organization_invoice_counters.last_number + 1
  returning last_number into next_number;

  select p.id into owner_profile_id
  from public.profiles p
  join public.roles r on r.id = p.role_id
  where p.organization_id = partner.parent_organization_id
    and p.is_active = true
  order by case when r.slug = 'administrador' then 0 else 1 end, p.created_at
  limit 1;

  if owner_profile_id is null then
    raise exception 'La matriz no tiene administrador activo';
  end if;

  created_shipment_code := 'INV-' || lpad(next_number::text, 6, '0');

  insert into public.shipments (
    organization_id, code, customer_name, country, carrier, paid, profit, status,
    created_by, sales_owner_id, recipient_snapshot, sale_kind, delivery_notes,
    logistics_plan, invoice_status, accounting_status, finalized_at,
    distribution_partner_id, distributor_public_price, distributor_wholesale_price
  ) values (
    partner.parent_organization_id, created_shipment_code, trimmed_customer_name,
    source_country.name, coalesce(nullif(btrim(carrier_input), ''), 'Distribuidor'),
    0, 0, 'Pendiente entrega caja vacÃ­a', owner_profile_id, owner_profile_id,
    coalesce(recipient_snapshot_input, '{}'::jsonb), 'full', coalesce(delivery_notes_input, ''),
    jsonb_build_object(
      'distributionPartnerId', partner.id,
      'offerId', offer.id,
      'catalogKey', source_box.catalog_key,
      'product', source_box.size,
      'publicPrice', offer.public_price,
      'wholesalePrice', offer.wholesale_price
    ), 'paid', 'not_exportable', now(),
    partner.id, offer.public_price, offer.wholesale_price
  ) returning id into created_shipment_id;

  insert into public.distribution_partner_ledger (
    partner_id, shipment_id, kind, amount, note, created_by
  ) values (
    partner.id, created_shipment_id, 'charge', offer.wholesale_price,
    'Cargo interno ' || created_shipment_code, null
  );

  shipment_id := created_shipment_id;
  shipment_code := created_shipment_code;
  wholesale_price := offer.wholesale_price;
  public_price := offer.public_price;
  return next;
end;
$$;

create or replace function public.distribution_record_payment(
  target_partner_id uuid,
  payment_amount numeric,
  payment_note text default ''
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  partner public.distribution_partners;
  balance_after numeric;
begin
  partner := public.distribution_assert_parent_manager(target_partner_id);
  if payment_amount is null or payment_amount <= 0 then
    raise exception 'Pago invalido';
  end if;

  if payment_amount > public.distribution_partner_balance(partner.id) then
    raise exception 'El pago supera el saldo pendiente';
  end if;

  insert into public.distribution_partner_ledger (partner_id, kind, amount, note, created_by)
  values (partner.id, 'payment', -payment_amount, coalesce(payment_note, ''), auth.uid());

  select public.distribution_partner_balance(partner.id) into balance_after;
  return balance_after;
end;
$$;

create or replace function public.distribution_reverse_voided_shipment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.distribution_partner_id is not null
     and old.invoice_status is distinct from 'void'
     and new.invoice_status = 'void' then
    insert into public.distribution_partner_ledger (partner_id, shipment_id, kind, amount, note)
    values (
      new.distribution_partner_id,
      new.id,
      'reversal',
      -new.distributor_wholesale_price,
      'Reverso por anular ' || new.code
    ) on conflict (shipment_id) where kind = 'reversal' do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists distribution_reverse_voided_shipment on public.shipments;
create trigger distribution_reverse_voided_shipment
  after update of invoice_status on public.shipments
  for each row execute function public.distribution_reverse_voided_shipment();

grant execute on function public.distribution_partner_balance(uuid) to authenticated;
grant execute on function public.distribution_create_sale(uuid, text, jsonb, text, text) to authenticated;
grant execute on function public.distribution_record_payment(uuid, numeric, text) to authenticated;
