-- Captadores de distribuidores. La titularidad actual vive en el partner y la
-- atribución de cada venta se congela en shipments para no reescribir historia.

insert into public.permissions (key, name, description) values
  ('distribution.acquire', 'Captar distribuidores', 'Crear y consultar la cartera propia de distribuidores')
on conflict (key) do nothing;

alter table public.distribution_partners
  add column if not exists acquisition_owner_id uuid references public.profiles(id) on delete set null;

create index if not exists idx_distribution_partners_acquisition_owner
  on public.distribution_partners(parent_organization_id, acquisition_owner_id, created_at desc);

create table if not exists public.distribution_partner_owner_history (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.distribution_partners(id) on delete cascade,
  previous_owner_id uuid references public.profiles(id) on delete set null,
  owner_id uuid references public.profiles(id) on delete set null,
  changed_by uuid references public.profiles(id) on delete set null,
  reason text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_distribution_owner_history_partner
  on public.distribution_partner_owner_history(partner_id, created_at desc);

alter table public.shipments
  add column if not exists distribution_acquisition_owner_id uuid references public.profiles(id) on delete set null;

create index if not exists idx_shipments_distribution_acquisition_owner
  on public.shipments(organization_id, distribution_acquisition_owner_id, created_at desc)
  where distribution_partner_id is not null;

alter table public.distribution_partner_owner_history enable row level security;
drop policy if exists distribution_partner_owner_history_deny_direct on public.distribution_partner_owner_history;
create policy distribution_partner_owner_history_deny_direct on public.distribution_partner_owner_history
  for all using (false) with check (false);

insert into public.roles (organization_id, slug, name, is_system)
select o.id, 'captador_distribuidores', 'Captador de distribuidores', true
from public.organizations o
where o.kind = 'client'
  and not exists (
    select 1 from public.distribution_partners p
    where p.distributor_organization_id = o.id
  )
on conflict (organization_id, slug) do nothing;

insert into public.role_permissions (role_id, permission_id, granted)
select r.id, p.id, true
from public.roles r
join public.permissions p on p.key = 'distribution.acquire'
where r.slug = 'captador_distribuidores'
on conflict (role_id, permission_id) do update set granted = true;

create or replace function public.bootstrap_organization(
  org_name text,
  owner_id uuid,
  owner_email text,
  owner_name text default null,
  org_slug text default null,
  org_kind text default 'client',
  owner_phone text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  role_admin uuid;
  role_vendor uuid;
  role_driver uuid;
  role_acquirer uuid;
  wh_id uuid;
  perm record;
  final_slug text;
  slug_base text;
  slug_suffix int := 0;
  resolved_kind text;
  resolved_phone text;
  resolved_phone_digits text;
begin
  resolved_kind := case when lower(trim(coalesce(org_kind, ''))) = 'platform' then 'platform' else 'client' end;
  resolved_phone := nullif(trim(coalesce(owner_phone, '')), '');
  resolved_phone_digits := public.normalize_phone_digits(resolved_phone);
  slug_base := coalesce(nullif(trim(org_slug), ''), public.slugify_org_name(org_name));
  if slug_base = '' then slug_base := 'empresa'; end if;
  final_slug := slug_base;
  while exists (select 1 from public.organizations o where o.slug = final_slug) loop
    slug_suffix := slug_suffix + 1;
    final_slug := slug_base || '-' || slug_suffix::text;
  end loop;

  insert into public.organizations (name, slug, is_active, kind)
  values (org_name, final_slug, true, resolved_kind)
  returning id into org_id;
  insert into public.roles (organization_id, slug, name, is_system) values
    (org_id, 'administrador', 'Administrador', true) returning id into role_admin;
  insert into public.roles (organization_id, slug, name, is_system) values
    (org_id, 'vendedor', 'Vendedor', true) returning id into role_vendor;
  insert into public.roles (organization_id, slug, name, is_system) values
    (org_id, 'conductor', 'Conductor', true) returning id into role_driver;
  insert into public.roles (organization_id, slug, name, is_system) values
    (org_id, 'captador_distribuidores', 'Captador de distribuidores', true) returning id into role_acquirer;

  for perm in select id, key from public.permissions loop
    insert into public.role_permissions (role_id, permission_id, granted) select role_admin, perm.id, true;
    insert into public.role_permissions (role_id, permission_id, granted)
    select role_vendor, perm.id, perm.key in ('sales.manage', 'customers.manage', 'inventory.view', 'inventory.reserve');
    insert into public.role_permissions (role_id, permission_id, granted)
    select role_driver, perm.id, perm.key in ('routes.view', 'routes.update_status');
    insert into public.role_permissions (role_id, permission_id, granted)
    select role_acquirer, perm.id, perm.key = 'distribution.acquire';
  end loop;

  insert into public.warehouses (organization_id, name, code, is_default, is_active)
  values (org_id, 'Bodega principal', 'MAIN', true, true) returning id into wh_id;
  insert into public.profiles (id, organization_id, email, full_name, role_id, is_active, phone, phone_digits, phone_verified_at)
  values (owner_id, org_id, owner_email, coalesce(owner_name, owner_email), role_admin, true, coalesce(resolved_phone, ''), resolved_phone_digits, null);
  return org_id;
end;
$$;

grant execute on function public.bootstrap_organization(text, uuid, text, text, text, text, text) to service_role;

create or replace function public.distribution_assign_acquisition_owner(
  target_partner_id uuid,
  target_owner_id uuid,
  assignment_reason text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  partner public.distribution_partners;
  target_owner public.profiles;
begin
  partner := public.distribution_assert_parent_manager(target_partner_id);

  select p.* into target_owner
  from public.profiles p
  join public.roles r on r.id = p.role_id
  where p.id = target_owner_id
    and p.organization_id = partner.parent_organization_id
    and p.is_active = true
    and r.slug = 'captador_distribuidores';

  if target_owner.id is null then
    raise exception 'Captador invalido';
  end if;

  if partner.acquisition_owner_id is not distinct from target_owner.id then
    return target_owner.id;
  end if;

  update public.distribution_partners
  set acquisition_owner_id = target_owner.id
  where id = partner.id;

  insert into public.distribution_partner_owner_history (
    partner_id, previous_owner_id, owner_id, changed_by, reason
  ) values (
    partner.id, partner.acquisition_owner_id, target_owner.id, auth.uid(), coalesce(assignment_reason, '')
  );

  return target_owner.id;
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
    distribution_partner_id, distribution_acquisition_owner_id,
    distributor_public_price, distributor_wholesale_price
  ) values (
    partner.parent_organization_id, created_shipment_code, trimmed_customer_name,
    source_country.name, coalesce(nullif(btrim(carrier_input), ''), 'Distribuidor'),
    0, 0, 'Pendiente entrega caja vacía', owner_profile_id, owner_profile_id,
    coalesce(recipient_snapshot_input, '{}'::jsonb), 'full', coalesce(delivery_notes_input, ''),
    jsonb_build_object(
      'distributionPartnerId', partner.id,
      'acquisitionOwnerId', partner.acquisition_owner_id,
      'offerId', offer.id,
      'catalogKey', source_box.catalog_key,
      'product', source_box.size,
      'publicPrice', offer.public_price,
      'wholesalePrice', offer.wholesale_price
    ), 'paid', 'not_exportable', now(),
    partner.id, partner.acquisition_owner_id, offer.public_price, offer.wholesale_price
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

grant execute on function public.distribution_assign_acquisition_owner(uuid, uuid, text) to authenticated;
grant execute on function public.distribution_create_sale(uuid, text, jsonb, text, text) to authenticated;
