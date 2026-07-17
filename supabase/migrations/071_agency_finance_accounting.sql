-- Boxario business finance v1.
-- Money is stored as integer USD cents. Financial facts are append-only; their
-- current state is derived from applications, credits and linked reversals.

insert into public.permissions (key, name, description) values
  ('agency.sales.create', 'Ventas de agencia', 'Crear ventas comerciales de la agencia')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Versioned internal rates and agency-owned public price lists
-- ---------------------------------------------------------------------------

create table public.internal_rate_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  matrix_organization_id uuid not null references public.organizations(id) on delete restrict,
  agency_organization_id uuid references public.organizations(id) on delete restrict,
  name text not null,
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  valid_from timestamptz not null,
  valid_until timestamptz,
  created_by_membership_id uuid references public.organization_memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (valid_until is null or valid_until > valid_from),
  unique (tenant_id, matrix_organization_id, agency_organization_id, name, version)
);

create table public.internal_rate_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  rate_version_id uuid not null references public.internal_rate_versions(id) on delete restrict,
  destination_code text not null,
  product_code text not null,
  concept text not null check (concept in ('empty_box', 'international_shipping', 'home_delivery', 'home_pickup', 'additional_service')),
  amount_cents bigint not null check (amount_cents >= 0),
  currency text not null default 'USD' check (currency = 'USD'),
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (rate_version_id, destination_code, product_code, concept)
);

create table public.agency_price_list_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  agency_organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null,
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  valid_from timestamptz not null,
  valid_until timestamptz,
  created_by_membership_id uuid references public.organization_memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (valid_until is null or valid_until > valid_from),
  unique (tenant_id, agency_organization_id, name, version)
);

create table public.agency_price_list_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  price_list_version_id uuid not null references public.agency_price_list_versions(id) on delete restrict,
  destination_code text not null,
  product_code text not null,
  concept text not null check (concept in ('empty_box', 'international_shipping', 'home_delivery', 'home_pickup', 'additional_service')),
  amount_cents bigint not null check (amount_cents >= 0),
  currency text not null default 'USD' check (currency = 'USD'),
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (price_list_version_id, destination_code, product_code, concept)
);

create unique index internal_rate_one_active_scope_idx
  on public.internal_rate_versions (tenant_id, matrix_organization_id, coalesce(agency_organization_id, '00000000-0000-0000-0000-000000000000'::uuid), name)
  where status = 'active';
create unique index agency_price_list_one_active_idx
  on public.agency_price_list_versions (tenant_id, agency_organization_id, name)
  where status = 'active';

-- ---------------------------------------------------------------------------
-- Sales and commercial customer subledger
-- ---------------------------------------------------------------------------

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  selling_organization_id uuid not null references public.organizations(id) on delete restrict,
  matrix_organization_id uuid not null references public.organizations(id) on delete restrict,
  agency_organization_id uuid references public.organizations(id) on delete restrict,
  shipment_id uuid references public.shipments(id) on delete restrict,
  legacy_distribution_partner_id uuid references public.distribution_partners(id) on delete restrict,
  sale_kind text not null check (sale_kind in ('matrix_direct', 'agency_retail')),
  status text not null default 'confirmed' check (status in ('draft', 'confirmed', 'cancelled', 'reversed')),
  customer_id uuid references public.customers(id) on delete restrict,
  customer_name_snapshot text not null,
  currency text not null default 'USD' check (currency = 'USD'),
  subtotal_cents bigint not null default 0 check (subtotal_cents >= 0),
  total_cents bigint not null default 0 check (total_cents >= 0),
  captor_assignment_id uuid,
  supervisor_assignment_id uuid,
  seller_membership_id uuid references public.organization_memberships(id) on delete restrict,
  attribution_snapshot jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  check (
    (sale_kind = 'matrix_direct' and agency_organization_id is null and selling_organization_id = matrix_organization_id)
    or (sale_kind = 'agency_retail' and agency_organization_id is not null and selling_organization_id = agency_organization_id)
  ),
  unique (tenant_id, idempotency_key)
);

create table public.sale_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  sale_id uuid not null references public.sales(id) on delete restrict,
  line_number integer not null check (line_number > 0),
  concept text not null check (concept in ('empty_box', 'international_shipping', 'home_delivery', 'home_pickup', 'additional_service')),
  description text not null,
  quantity integer not null check (quantity > 0),
  unit_amount_cents bigint not null check (unit_amount_cents >= 0),
  amount_cents bigint generated always as (quantity::bigint * unit_amount_cents) stored,
  currency text not null default 'USD' check (currency = 'USD'),
  internal_rate_line_id uuid references public.internal_rate_lines(id) on delete restrict,
  public_price_line_id uuid references public.agency_price_list_lines(id) on delete restrict,
  box_source text check (box_source in ('matrix_purchased', 'own_box')),
  rate_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (sale_id, line_number)
);

create table public.commercial_invoice_counters (
  organization_id uuid primary key references public.organizations(id) on delete restrict,
  last_number bigint not null default 0 check (last_number >= 0)
);

create table public.customer_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  sale_id uuid not null references public.sales(id) on delete restrict,
  customer_id uuid references public.customers(id) on delete restrict,
  invoice_number text not null,
  issued_at timestamptz not null default now(),
  due_at timestamptz,
  currency text not null default 'USD' check (currency = 'USD'),
  amount_cents bigint not null check (amount_cents >= 0),
  lifecycle_status text not null default 'issued' check (lifecycle_status in ('issued', 'cancelled', 'reversed')),
  created_by_membership_id uuid references public.organization_memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (organization_id, invoice_number),
  unique (sale_id)
);

create table public.customer_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  invoice_id uuid not null references public.customer_invoices(id) on delete restrict,
  sale_line_id uuid references public.sale_lines(id) on delete restrict,
  line_number integer not null check (line_number > 0),
  description text not null,
  quantity integer not null check (quantity > 0),
  unit_amount_cents bigint not null check (unit_amount_cents >= 0),
  amount_cents bigint generated always as (quantity::bigint * unit_amount_cents) stored,
  currency text not null default 'USD' check (currency = 'USD'),
  created_at timestamptz not null default now(),
  unique (invoice_id, line_number)
);

create table public.customer_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  customer_id uuid references public.customers(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'USD' check (currency = 'USD'),
  method text not null,
  reference text not null default '',
  received_at timestamptz not null default now(),
  created_by_membership_id uuid references public.organization_memberships(id) on delete restrict,
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);

create table public.customer_payment_applications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  payment_id uuid not null references public.customer_payments(id) on delete restrict,
  invoice_id uuid not null references public.customer_invoices(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  applied_at timestamptz not null default now(),
  applied_by_membership_id uuid references public.organization_memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (payment_id, invoice_id)
);

create table public.customer_payment_application_reversals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  application_id uuid not null unique references public.customer_payment_applications(id) on delete restrict,
  reason text not null check (btrim(reason) <> ''),
  created_by_membership_id uuid references public.organization_memberships(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.customer_credit_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  invoice_id uuid not null references public.customer_invoices(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'USD' check (currency = 'USD'),
  reason text not null check (btrim(reason) <> ''),
  created_by_membership_id uuid references public.organization_memberships(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.customer_payment_reversals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  payment_id uuid not null unique references public.customer_payments(id) on delete restrict,
  reason text not null check (btrim(reason) <> ''),
  created_by_membership_id uuid references public.organization_memberships(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index sales_scope_idx on public.sales(tenant_id, selling_organization_id, created_at desc);
create index customer_invoices_scope_idx on public.customer_invoices(tenant_id, organization_id, issued_at desc);
create index customer_payments_scope_idx on public.customer_payments(tenant_id, organization_id, received_at desc);

-- ---------------------------------------------------------------------------
-- Agency-to-matrix receivable
-- ---------------------------------------------------------------------------

create table public.agency_charges (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  matrix_organization_id uuid not null references public.organizations(id) on delete restrict,
  agency_organization_id uuid not null references public.organizations(id) on delete restrict,
  sale_id uuid references public.sales(id) on delete restrict,
  shipment_id uuid references public.shipments(id) on delete restrict,
  package_id uuid references public.shipment_packages(id) on delete restrict,
  concept text not null check (concept in ('empty_box', 'international_shipping', 'home_delivery', 'home_pickup', 'additional_service', 'adjustment')),
  source_operation_type text not null,
  source_operation_id uuid not null,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'USD' check (currency = 'USD'),
  posted_at timestamptz not null default now(),
  due_at timestamptz,
  created_by_membership_id uuid references public.organization_memberships(id) on delete restrict,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (matrix_organization_id <> agency_organization_id),
  unique (tenant_id, source_operation_type, source_operation_id, concept)
);

create unique index agency_charges_idempotency_idx
  on public.agency_charges(tenant_id, idempotency_key)
  where idempotency_key is not null;

create table public.agency_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  matrix_organization_id uuid not null references public.organizations(id) on delete restrict,
  agency_organization_id uuid not null references public.organizations(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'USD' check (currency = 'USD'),
  method text not null,
  reference text not null default '',
  received_at timestamptz not null default now(),
  created_by_membership_id uuid references public.organization_memberships(id) on delete restrict,
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);

create table public.agency_payment_applications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  matrix_organization_id uuid not null references public.organizations(id) on delete restrict,
  agency_organization_id uuid not null references public.organizations(id) on delete restrict,
  payment_id uuid not null references public.agency_payments(id) on delete restrict,
  charge_id uuid not null references public.agency_charges(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  applied_at timestamptz not null default now(),
  applied_by_membership_id uuid references public.organization_memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (payment_id, charge_id)
);

create table public.agency_payment_application_reversals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  application_id uuid not null unique references public.agency_payment_applications(id) on delete restrict,
  reason text not null check (btrim(reason) <> ''),
  created_by_membership_id uuid references public.organization_memberships(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.agency_credits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  matrix_organization_id uuid not null references public.organizations(id) on delete restrict,
  agency_organization_id uuid not null references public.organizations(id) on delete restrict,
  charge_id uuid not null references public.agency_charges(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'USD' check (currency = 'USD'),
  reason text not null check (btrim(reason) <> ''),
  created_by_membership_id uuid references public.organization_memberships(id) on delete restrict,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);

create table public.agency_adjustments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  matrix_organization_id uuid not null references public.organizations(id) on delete restrict,
  agency_organization_id uuid not null references public.organizations(id) on delete restrict,
  charge_id uuid not null references public.agency_charges(id) on delete restrict,
  amount_cents bigint not null check (amount_cents <> 0),
  currency text not null default 'USD' check (currency = 'USD'),
  reason text not null check (btrim(reason) <> ''),
  created_by_membership_id uuid references public.organization_memberships(id) on delete restrict,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);

create table public.agency_financial_reversals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  matrix_organization_id uuid not null references public.organizations(id) on delete restrict,
  agency_organization_id uuid not null references public.organizations(id) on delete restrict,
  target_type text not null check (target_type in ('charge', 'payment', 'credit', 'adjustment', 'driver_settlement')),
  target_id uuid not null,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'USD' check (currency = 'USD'),
  reason text not null check (btrim(reason) <> ''),
  created_by_membership_id uuid references public.organization_memberships(id) on delete restrict,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, target_type, target_id),
  unique (tenant_id, idempotency_key)
);

create index agency_charges_open_scope_idx
  on public.agency_charges(tenant_id, matrix_organization_id, agency_organization_id, posted_at);
create index agency_payments_scope_idx
  on public.agency_payments(tenant_id, matrix_organization_id, agency_organization_id, received_at);

-- ---------------------------------------------------------------------------
-- Accrual general ledger for matrix organizations
-- ---------------------------------------------------------------------------

create table public.gl_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  matrix_organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null,
  name text not null,
  account_type text not null check (account_type in ('asset', 'liability', 'equity', 'revenue', 'expense')),
  normal_balance text not null check (normal_balance in ('debit', 'credit')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (matrix_organization_id, code)
);

create table public.accounting_periods (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  matrix_organization_id uuid not null references public.organizations(id) on delete restrict,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'open' check (status in ('open', 'closed', 'locked')),
  closed_at timestamptz,
  closed_by_membership_id uuid references public.organization_memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  unique (matrix_organization_id, starts_on, ends_on)
);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  matrix_organization_id uuid not null references public.organizations(id) on delete restrict,
  period_id uuid references public.accounting_periods(id) on delete restrict,
  entry_number bigint not null,
  occurred_at timestamptz not null default now(),
  description text not null,
  source_type text not null,
  source_id uuid not null,
  reversal_of_entry_id uuid unique references public.journal_entries(id) on delete restrict,
  created_by_membership_id uuid references public.organization_memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (matrix_organization_id, entry_number),
  unique (tenant_id, source_type, source_id)
);

create table public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  matrix_organization_id uuid not null references public.organizations(id) on delete restrict,
  journal_entry_id uuid not null references public.journal_entries(id) on delete restrict,
  line_number integer not null check (line_number > 0),
  account_id uuid not null references public.gl_accounts(id) on delete restrict,
  agency_organization_id uuid references public.organizations(id) on delete restrict,
  description text not null default '',
  debit_cents bigint not null default 0 check (debit_cents >= 0),
  credit_cents bigint not null default 0 check (credit_cents >= 0),
  currency text not null default 'USD' check (currency = 'USD'),
  created_at timestamptz not null default now(),
  check ((debit_cents > 0 and credit_cents = 0) or (credit_cents > 0 and debit_cents = 0)),
  unique (journal_entry_id, line_number)
);

create table public.journal_entry_counters (
  matrix_organization_id uuid primary key references public.organizations(id) on delete restrict,
  last_number bigint not null default 0 check (last_number >= 0)
);

create index journal_entries_scope_idx
  on public.journal_entries(tenant_id, matrix_organization_id, occurred_at desc);
create index journal_lines_entry_idx on public.journal_lines(journal_entry_id, line_number);

-- ---------------------------------------------------------------------------
-- Driver cash custody and settlements
-- ---------------------------------------------------------------------------

create table public.driver_cash_custody_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  matrix_organization_id uuid not null references public.organizations(id) on delete restrict,
  driver_membership_id uuid not null references public.organization_memberships(id) on delete restrict,
  beneficiary_organization_id uuid not null references public.organizations(id) on delete restrict,
  source_type text not null check (source_type in ('matrix_receivable', 'agency_customer_receivable')),
  source_id uuid not null,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'USD' check (currency = 'USD'),
  collected_at timestamptz not null,
  evidence jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);

create table public.driver_settlements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  matrix_organization_id uuid not null references public.organizations(id) on delete restrict,
  driver_membership_id uuid not null references public.organization_memberships(id) on delete restrict,
  expected_cents bigint not null check (expected_cents >= 0),
  counted_cents bigint not null check (counted_cents >= 0),
  difference_cents bigint generated always as (counted_cents - expected_cents) stored,
  currency text not null default 'USD' check (currency = 'USD'),
  status text not null check (status in ('reconciled', 'difference')),
  reason text not null default '',
  evidence jsonb not null default '{}'::jsonb,
  reconciled_by_membership_id uuid not null references public.organization_memberships(id) on delete restrict,
  idempotency_key text not null,
  reconciled_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);

create table public.driver_settlement_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  settlement_id uuid not null references public.driver_settlements(id) on delete restrict,
  custody_event_id uuid not null references public.driver_cash_custody_events(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  created_at timestamptz not null default now(),
  unique (settlement_id, custody_event_id)
);

create table public.driver_settlement_reversals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  matrix_organization_id uuid not null references public.organizations(id) on delete restrict,
  settlement_id uuid not null unique references public.driver_settlements(id) on delete restrict,
  reason text not null check (btrim(reason) <> ''),
  reversed_by_membership_id uuid not null references public.organization_memberships(id) on delete restrict,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);

-- ---------------------------------------------------------------------------
-- Operation-linked financial holds
-- ---------------------------------------------------------------------------

create table public.financial_holds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  matrix_organization_id uuid not null references public.organizations(id) on delete restrict,
  agency_organization_id uuid not null references public.organizations(id) on delete restrict,
  sale_id uuid references public.sales(id) on delete restrict,
  shipment_id uuid references public.shipments(id) on delete restrict,
  package_id uuid references public.shipment_packages(id) on delete restrict,
  agency_charge_id uuid not null references public.agency_charges(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (shipment_id is not null or package_id is not null),
  unique (agency_charge_id)
);

create table public.financial_hold_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  hold_id uuid not null references public.financial_holds(id) on delete restrict,
  status text not null check (status in ('active', 'released_automatically', 'released_manually', 'cancelled')),
  reason text not null default '',
  evidence jsonb not null default '{}'::jsonb,
  actor_membership_id uuid references public.organization_memberships(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.financial_hold_policies (
  tenant_id uuid primary key references public.business_tenants(id) on delete restrict,
  manual_release_requires_second_approval boolean not null default false,
  updated_by_membership_id uuid references public.organization_memberships(id) on delete restrict,
  updated_at timestamptz not null default now()
);

create table public.financial_hold_release_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  hold_id uuid not null references public.financial_holds(id) on delete restrict,
  reason text not null check (btrim(reason) <> ''),
  evidence jsonb not null check (evidence <> '{}'::jsonb),
  requested_by_membership_id uuid not null references public.organization_memberships(id) on delete restrict,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);

create table public.financial_hold_release_approvals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.business_tenants(id) on delete restrict,
  request_id uuid not null unique references public.financial_hold_release_requests(id) on delete restrict,
  approved_by_membership_id uuid not null references public.organization_memberships(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index financial_holds_shipment_idx on public.financial_holds(tenant_id, shipment_id);
create index financial_holds_package_idx on public.financial_holds(tenant_id, package_id);
create index financial_hold_events_current_idx on public.financial_hold_events(hold_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Derived balances and immutable-event guards
-- ---------------------------------------------------------------------------

create or replace view public.customer_invoice_balances
with (security_invoker = true)
as
select
  i.*,
  coalesce(a.applied_cents, 0)::bigint as applied_cents,
  coalesce(c.credit_cents, 0)::bigint as credit_cents,
  greatest(i.amount_cents - coalesce(a.applied_cents, 0) - coalesce(c.credit_cents, 0), 0)::bigint as outstanding_cents,
  case
    when i.lifecycle_status = 'reversed' then 'reversed'
    when i.lifecycle_status = 'cancelled' then 'cancelled'
    when i.amount_cents <= coalesce(a.applied_cents, 0) + coalesce(c.credit_cents, 0) then 'paid'
    when coalesce(a.applied_cents, 0) + coalesce(c.credit_cents, 0) > 0 then 'partially_paid'
    else 'pending'
  end as status
from public.customer_invoices i
left join (
  select invoice_id, sum(amount_cents)::bigint as applied_cents
  from public.customer_payment_applications application
  where not exists (
    select 1 from public.customer_payment_application_reversals reversal
    where reversal.application_id = application.id
  )
  group by invoice_id
) a on a.invoice_id = i.id
left join (
  select invoice_id, sum(amount_cents)::bigint as credit_cents
  from public.customer_credit_notes group by invoice_id
) c on c.invoice_id = i.id;

create or replace view public.customer_payment_balances
with (security_invoker = true)
as
select
  p.*,
  coalesce(a.applied_cents, 0)::bigint as applied_cents,
  greatest(p.amount_cents - coalesce(a.applied_cents, 0), 0)::bigint as unapplied_cents,
  case
    when r.id is not null then 'reversed'
    when coalesce(a.applied_cents, 0) = 0 then 'received'
    when coalesce(a.applied_cents, 0) < p.amount_cents then 'partially_applied'
    else 'applied'
  end as status
from public.customer_payments p
left join (
  select payment_id, sum(amount_cents)::bigint as applied_cents
  from public.customer_payment_applications application
  where not exists (
    select 1 from public.customer_payment_application_reversals reversal
    where reversal.application_id = application.id
  )
  group by payment_id
) a on a.payment_id = p.id
left join public.customer_payment_reversals r on r.payment_id = p.id;

create or replace view public.agency_charge_balances
with (security_invoker = true)
as
select
  c.*,
  coalesce(a.applied_cents, 0)::bigint as applied_cents,
  coalesce(cr.credit_cents, 0)::bigint as credit_cents,
  coalesce(adj.adjustment_cents, 0)::bigint as adjustment_cents,
  coalesce(rv.reversed_cents, 0)::bigint as reversed_cents,
  greatest(c.amount_cents + coalesce(adj.adjustment_cents, 0) - coalesce(a.applied_cents, 0) - coalesce(cr.credit_cents, 0) - coalesce(rv.reversed_cents, 0), 0)::bigint as outstanding_cents,
  case
    when coalesce(rv.reversed_cents, 0) >= c.amount_cents + coalesce(adj.adjustment_cents, 0) then 'reversed'
    when c.amount_cents + coalesce(adj.adjustment_cents, 0) <= coalesce(a.applied_cents, 0) + coalesce(cr.credit_cents, 0) + coalesce(rv.reversed_cents, 0) then 'paid'
    when coalesce(a.applied_cents, 0) + coalesce(cr.credit_cents, 0) + coalesce(rv.reversed_cents, 0) > 0 then 'partially_paid'
    else 'pending'
  end as status
from public.agency_charges c
left join (
  select charge_id, sum(amount_cents)::bigint as applied_cents
  from public.agency_payment_applications application
  where not exists (
    select 1 from public.agency_payment_application_reversals reversal
    where reversal.application_id = application.id
  )
  group by charge_id
) a on a.charge_id = c.id
left join (
  select charge_id, sum(amount_cents)::bigint as credit_cents
  from public.agency_credits credit
  where not exists (
    select 1 from public.agency_financial_reversals reversal
    where reversal.target_type = 'credit' and reversal.target_id = credit.id
  )
  group by charge_id
) cr on cr.charge_id = c.id
left join (
  select charge_id, sum(amount_cents)::bigint as adjustment_cents
  from public.agency_adjustments adjustment
  where not exists (
    select 1 from public.agency_financial_reversals reversal
    where reversal.target_type = 'adjustment' and reversal.target_id = adjustment.id
  )
  group by charge_id
) adj on adj.charge_id = c.id
left join (
  select target_id, sum(amount_cents)::bigint as reversed_cents
  from public.agency_financial_reversals where target_type = 'charge' group by target_id
) rv on rv.target_id = c.id;

create or replace view public.agency_payment_balances
with (security_invoker = true)
as
select
  p.*,
  coalesce(a.applied_cents, 0)::bigint as applied_cents,
  greatest(p.amount_cents - coalesce(a.applied_cents, 0), 0)::bigint as unapplied_cents,
  case
    when rv.id is not null then 'reversed'
    when coalesce(a.applied_cents, 0) = 0 then 'received'
    when coalesce(a.applied_cents, 0) < p.amount_cents then 'partially_applied'
    else 'applied'
  end as status
from public.agency_payments p
left join (
  select payment_id, sum(amount_cents)::bigint as applied_cents
  from public.agency_payment_applications application
  where not exists (
    select 1 from public.agency_payment_application_reversals reversal
    where reversal.application_id = application.id
  )
  group by payment_id
) a on a.payment_id = p.id
left join public.agency_financial_reversals rv on rv.target_type = 'payment' and rv.target_id = p.id;

create or replace view public.current_financial_holds
with (security_invoker = true)
as
select h.*, e.status, e.reason, e.evidence, e.actor_membership_id, e.created_at as status_changed_at
from public.financial_holds h
join lateral (
  select he.* from public.financial_hold_events he
  where he.hold_id = h.id
  order by he.created_at desc, he.id desc
  limit 1
) e on true;

create or replace view public.driver_settlement_statuses
with (security_invoker = true)
as
select settlement.*,
  case when reversal.id is null then settlement.status else 'reversed' end as current_status,
  reversal.id as reversal_id
from public.driver_settlements settlement
left join public.driver_settlement_reversals reversal on reversal.settlement_id = settlement.id;

create or replace function public.finance_reject_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'IMMUTABLE_FINANCIAL_EVENT';
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'customer_invoices', 'customer_invoice_lines', 'customer_payments',
    'customer_payment_applications', 'customer_payment_application_reversals', 'customer_credit_notes', 'customer_payment_reversals',
    'agency_charges', 'agency_payments', 'agency_payment_applications', 'agency_payment_application_reversals', 'agency_credits',
    'agency_adjustments', 'agency_financial_reversals', 'journal_entries', 'journal_lines',
    'driver_cash_custody_events', 'driver_settlements', 'driver_settlement_lines', 'driver_settlement_reversals',
    'financial_holds', 'financial_hold_events', 'financial_hold_release_requests', 'financial_hold_release_approvals'
  ] loop
    execute format('drop trigger if exists finance_immutable_guard on public.%I', table_name);
    execute format(
      'create trigger finance_immutable_guard before update or delete on public.%I for each row execute function public.finance_reject_mutation()',
      table_name
    );
  end loop;
end $$;

create or replace function public.finance_validate_organization_pair()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  payload jsonb := to_jsonb(new);
  row_tenant uuid := (payload->>'tenant_id')::uuid;
  matrix_id uuid := (payload->>'matrix_organization_id')::uuid;
  agency_id uuid := nullif(payload->>'agency_organization_id', '')::uuid;
begin
  if not exists (
    select 1 from public.organizations o
    where o.id = matrix_id and o.tenant_id = row_tenant and o.organization_type = 'matrix'
  ) then
    raise exception 'INVALID_MATRIX_SCOPE';
  end if;
  if agency_id is not null and not exists (
    select 1 from public.organizations o
    where o.id = agency_id and o.tenant_id = row_tenant
      and o.organization_type = 'agency' and o.matrix_organization_id = matrix_id
  ) then
    raise exception 'INVALID_AGENCY_SCOPE';
  end if;
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'internal_rate_versions', 'sales', 'agency_charges', 'agency_payments',
    'agency_payment_applications', 'agency_credits', 'agency_adjustments',
    'agency_financial_reversals', 'journal_entries', 'journal_lines',
    'driver_cash_custody_events', 'driver_settlements', 'driver_settlement_reversals', 'financial_holds'
  ] loop
    execute format(
      'create trigger finance_scope_guard before insert on public.%I for each row execute function public.finance_validate_organization_pair()',
      table_name
    );
  end loop;
end $$;

create or replace function public.finance_validate_agency_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_row public.agency_payments;
  charge_row public.agency_charges;
  payment_applied bigint;
  charge_applied bigint;
  charge_credited bigint;
  charge_reversed bigint;
  charge_adjusted bigint;
begin
  select * into payment_row from public.agency_payments where id = new.payment_id for update;
  select * into charge_row from public.agency_charges where id = new.charge_id for update;
  if payment_row.id is null or charge_row.id is null
     or payment_row.tenant_id <> new.tenant_id or charge_row.tenant_id <> new.tenant_id
     or payment_row.matrix_organization_id <> new.matrix_organization_id
     or charge_row.matrix_organization_id <> new.matrix_organization_id
     or payment_row.agency_organization_id <> new.agency_organization_id
     or charge_row.agency_organization_id <> new.agency_organization_id then
    raise exception 'APPLICATION_SCOPE_MISMATCH';
  end if;
  if exists (select 1 from public.agency_financial_reversals where target_type = 'payment' and target_id = payment_row.id) then
    raise exception 'PAYMENT_REVERSED';
  end if;
  select coalesce(sum(amount_cents), 0) into payment_applied
  from public.agency_payment_applications application
  where payment_id = new.payment_id
    and not exists (select 1 from public.agency_payment_application_reversals reversal where reversal.application_id = application.id);
  select coalesce(sum(amount_cents), 0) into charge_applied
  from public.agency_payment_applications application
  where charge_id = new.charge_id
    and not exists (select 1 from public.agency_payment_application_reversals reversal where reversal.application_id = application.id);
  select coalesce(sum(amount_cents), 0) into charge_credited
  from public.agency_credits credit where charge_id = new.charge_id
    and not exists (select 1 from public.agency_financial_reversals reversal where reversal.target_type = 'credit' and reversal.target_id = credit.id);
  select coalesce(sum(amount_cents), 0) into charge_reversed
  from public.agency_financial_reversals where target_type = 'charge' and target_id = new.charge_id;
  select coalesce(sum(amount_cents), 0) into charge_adjusted
  from public.agency_adjustments adjustment where charge_id = new.charge_id
    and not exists (select 1 from public.agency_financial_reversals reversal where reversal.target_type = 'adjustment' and reversal.target_id = adjustment.id);
  if payment_applied + new.amount_cents > payment_row.amount_cents then
    raise exception 'PAYMENT_OVERAPPLIED';
  end if;
  if charge_applied + charge_credited + charge_reversed + new.amount_cents > charge_row.amount_cents + charge_adjusted then
    raise exception 'CHARGE_OVERAPPLIED';
  end if;
  return new;
end;
$$;

create trigger agency_payment_application_guard
  before insert on public.agency_payment_applications
  for each row execute function public.finance_validate_agency_application();

create or replace function public.finance_validate_agency_credit_or_adjustment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  charge_row public.agency_charges;
  applied bigint;
  credited bigint;
  reversed bigint;
  adjusted bigint;
begin
  select * into charge_row from public.agency_charges where id = new.charge_id for update;
  if charge_row.id is null or charge_row.tenant_id <> new.tenant_id
     or charge_row.matrix_organization_id <> new.matrix_organization_id
     or charge_row.agency_organization_id <> new.agency_organization_id then
    raise exception 'CREDIT_SCOPE_MISMATCH';
  end if;
  select coalesce(sum(amount_cents), 0) into applied
  from public.agency_payment_applications application where charge_id = new.charge_id
    and not exists (select 1 from public.agency_payment_application_reversals reversal where reversal.application_id = application.id);
  select coalesce(sum(amount_cents), 0) into credited from public.agency_credits credit where charge_id = new.charge_id
    and not exists (select 1 from public.agency_financial_reversals reversal where reversal.target_type = 'credit' and reversal.target_id = credit.id);
  select coalesce(sum(amount_cents), 0) into reversed from public.agency_financial_reversals where target_type = 'charge' and target_id = new.charge_id;
  select coalesce(sum(amount_cents), 0) into adjusted from public.agency_adjustments adjustment where charge_id = new.charge_id
    and not exists (select 1 from public.agency_financial_reversals reversal where reversal.target_type = 'adjustment' and reversal.target_id = adjustment.id);
  if tg_table_name = 'agency_credits' and applied + credited + reversed + new.amount_cents > charge_row.amount_cents + adjusted then
    raise exception 'CHARGE_OVERCREDITED';
  end if;
  if tg_table_name = 'agency_adjustments'
     and charge_row.amount_cents + adjusted + new.amount_cents < applied + credited + reversed then
    raise exception 'ADJUSTMENT_BELOW_APPLIED_BALANCE';
  end if;
  return new;
end;
$$;

create trigger agency_credit_amount_guard
  before insert on public.agency_credits
  for each row execute function public.finance_validate_agency_credit_or_adjustment();
create trigger agency_adjustment_amount_guard
  before insert on public.agency_adjustments
  for each row execute function public.finance_validate_agency_credit_or_adjustment();

create or replace function public.finance_validate_customer_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_row public.customer_payments;
  invoice_row public.customer_invoices;
  payment_applied bigint;
  invoice_applied bigint;
  invoice_credited bigint;
begin
  select * into payment_row from public.customer_payments where id = new.payment_id for update;
  select * into invoice_row from public.customer_invoices where id = new.invoice_id for update;
  if payment_row.id is null or invoice_row.id is null
     or payment_row.tenant_id <> new.tenant_id or invoice_row.tenant_id <> new.tenant_id
     or payment_row.organization_id <> new.organization_id or invoice_row.organization_id <> new.organization_id then
    raise exception 'APPLICATION_SCOPE_MISMATCH';
  end if;
  if exists (select 1 from public.customer_payment_reversals where payment_id = payment_row.id) then
    raise exception 'PAYMENT_REVERSED';
  end if;
  select coalesce(sum(amount_cents), 0) into payment_applied
  from public.customer_payment_applications application where payment_id = new.payment_id
    and not exists (select 1 from public.customer_payment_application_reversals reversal where reversal.application_id = application.id);
  select coalesce(sum(amount_cents), 0) into invoice_applied
  from public.customer_payment_applications application where invoice_id = new.invoice_id
    and not exists (select 1 from public.customer_payment_application_reversals reversal where reversal.application_id = application.id);
  select coalesce(sum(amount_cents), 0) into invoice_credited
  from public.customer_credit_notes where invoice_id = new.invoice_id;
  if payment_applied + new.amount_cents > payment_row.amount_cents then
    raise exception 'PAYMENT_OVERAPPLIED';
  end if;
  if invoice_applied + invoice_credited + new.amount_cents > invoice_row.amount_cents then
    raise exception 'INVOICE_OVERAPPLIED';
  end if;
  return new;
end;
$$;

create trigger customer_payment_application_guard
  before insert on public.customer_payment_applications
  for each row execute function public.finance_validate_customer_application();

create or replace function public.finance_validate_customer_credit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invoice_row public.customer_invoices;
  applied bigint;
  credited bigint;
begin
  select * into invoice_row from public.customer_invoices where id = new.invoice_id for update;
  if invoice_row.id is null or invoice_row.tenant_id <> new.tenant_id or invoice_row.organization_id <> new.organization_id then
    raise exception 'CREDIT_SCOPE_MISMATCH';
  end if;
  select coalesce(sum(amount_cents), 0) into applied
  from public.customer_payment_applications application where invoice_id = new.invoice_id
    and not exists (select 1 from public.customer_payment_application_reversals reversal where reversal.application_id = application.id);
  select coalesce(sum(amount_cents), 0) into credited from public.customer_credit_notes where invoice_id = new.invoice_id;
  if applied + credited + new.amount_cents > invoice_row.amount_cents then raise exception 'INVOICE_OVERCREDITED'; end if;
  return new;
end;
$$;

create trigger customer_credit_amount_guard
  before insert on public.customer_credit_notes
  for each row execute function public.finance_validate_customer_credit();

create or replace function public.finance_guard_rate_history()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_status text;
begin
  if tg_table_name = 'internal_rate_versions' or tg_table_name = 'agency_price_list_versions' then
    if old.status <> 'draft' then raise exception 'ACTIVE_RATE_VERSION_IS_IMMUTABLE'; end if;
    return new;
  end if;
  if tg_table_name = 'internal_rate_lines' then
    select status into parent_status from public.internal_rate_versions where id = old.rate_version_id;
  else
    select status into parent_status from public.agency_price_list_versions where id = old.price_list_version_id;
  end if;
  if parent_status <> 'draft' then raise exception 'ACTIVE_RATE_LINE_IS_IMMUTABLE'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger internal_rate_version_history_guard
  before update or delete on public.internal_rate_versions
  for each row execute function public.finance_guard_rate_history();
create trigger internal_rate_line_history_guard
  before update or delete on public.internal_rate_lines
  for each row execute function public.finance_guard_rate_history();
create trigger agency_price_version_history_guard
  before update or delete on public.agency_price_list_versions
  for each row execute function public.finance_guard_rate_history();
create trigger agency_price_line_history_guard
  before update or delete on public.agency_price_list_lines
  for each row execute function public.finance_guard_rate_history();

-- ---------------------------------------------------------------------------
-- Posting engine. Every source event produces one balanced accrual entry.
-- ---------------------------------------------------------------------------

create or replace function public.ensure_matrix_chart(target_tenant_id uuid, target_matrix_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.organizations
    where id = target_matrix_id and tenant_id = target_tenant_id and organization_type = 'matrix'
  ) then
    raise exception 'INVALID_MATRIX_SCOPE';
  end if;
  insert into public.gl_accounts (tenant_id, matrix_organization_id, code, name, account_type, normal_balance) values
    (target_tenant_id, target_matrix_id, '1100', 'Caja y bancos', 'asset', 'debit'),
    (target_tenant_id, target_matrix_id, '1120', 'Efectivo en tránsito', 'asset', 'debit'),
    (target_tenant_id, target_matrix_id, '1200', 'Cuentas por cobrar a agencias', 'asset', 'debit'),
    (target_tenant_id, target_matrix_id, '1210', 'Cuentas por cobrar a clientes matriz', 'asset', 'debit'),
    (target_tenant_id, target_matrix_id, '2100', 'Efectivo por pagar a agencias', 'liability', 'credit'),
    (target_tenant_id, target_matrix_id, '4000', 'Ingreso por envíos y servicios', 'revenue', 'credit'),
    (target_tenant_id, target_matrix_id, '4010', 'Ingreso por cajas', 'revenue', 'credit'),
    (target_tenant_id, target_matrix_id, '5000', 'Costo de cajas', 'expense', 'debit'),
    (target_tenant_id, target_matrix_id, '6990', 'Diferencias de caja', 'expense', 'debit')
  on conflict (matrix_organization_id, code) do nothing;
end;
$$;

create or replace function public.finance_next_journal_number(target_matrix_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  next_number bigint;
begin
  insert into public.journal_entry_counters(matrix_organization_id, last_number)
  values (target_matrix_id, 1)
  on conflict (matrix_organization_id) do update
  set last_number = public.journal_entry_counters.last_number + 1
  returning last_number into next_number;
  return next_number;
end;
$$;

create or replace function public.finance_post_two_line_entry(
  target_tenant_id uuid,
  target_matrix_id uuid,
  source_type_input text,
  source_id_input uuid,
  description_input text,
  debit_account_code text,
  credit_account_code text,
  amount_cents_input bigint,
  agency_id_input uuid default null,
  actor_membership_input uuid default null,
  reversal_of_input uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  entry_id uuid;
  debit_account uuid;
  credit_account uuid;
  period uuid;
begin
  if amount_cents_input is null or amount_cents_input <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  perform public.ensure_matrix_chart(target_tenant_id, target_matrix_id);
  select id into period from public.accounting_periods
  where matrix_organization_id = target_matrix_id and status = 'open'
    and current_date between starts_on and ends_on
  order by starts_on desc limit 1;
  select id into debit_account from public.gl_accounts
  where matrix_organization_id = target_matrix_id and code = debit_account_code;
  select id into credit_account from public.gl_accounts
  where matrix_organization_id = target_matrix_id and code = credit_account_code;
  if debit_account is null or credit_account is null then raise exception 'GL_ACCOUNT_NOT_FOUND'; end if;
  insert into public.journal_entries (
    tenant_id, matrix_organization_id, period_id, entry_number, description,
    source_type, source_id, reversal_of_entry_id, created_by_membership_id
  ) values (
    target_tenant_id, target_matrix_id, period, public.finance_next_journal_number(target_matrix_id),
    description_input, source_type_input, source_id_input, reversal_of_input, actor_membership_input
  ) returning id into entry_id;
  insert into public.journal_lines (
    tenant_id, matrix_organization_id, journal_entry_id, line_number, account_id,
    agency_organization_id, description, debit_cents, credit_cents
  ) values
    (target_tenant_id, target_matrix_id, entry_id, 1, debit_account, agency_id_input, description_input, amount_cents_input, 0),
    (target_tenant_id, target_matrix_id, entry_id, 2, credit_account, agency_id_input, description_input, 0, amount_cents_input);
  return entry_id;
end;
$$;

create or replace function public.finance_assert_balanced_entry_id(target_entry uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  debit_total bigint;
  credit_total bigint;
  line_count integer;
begin
  select coalesce(sum(debit_cents), 0), coalesce(sum(credit_cents), 0), count(*)
  into debit_total, credit_total, line_count
  from public.journal_lines where journal_entry_id = target_entry;
  if line_count < 2 or debit_total <= 0 or debit_total <> credit_total then
    raise exception 'UNBALANCED_JOURNAL_ENTRY:% debit:% credit:% lines:%', target_entry, debit_total, credit_total, line_count;
  end if;
end;
$$;

create or replace function public.finance_assert_balanced_entry_row()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform public.finance_assert_balanced_entry_id(new.id);
  return null;
end;
$$;

create or replace function public.finance_assert_balanced_line_row()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform public.finance_assert_balanced_entry_id(
    case when tg_op = 'DELETE' then old.journal_entry_id else new.journal_entry_id end
  );
  return null;
end;
$$;

create constraint trigger journal_entry_balance_guard
  after insert on public.journal_entries
  deferrable initially deferred
  for each row execute function public.finance_assert_balanced_entry_row();

create constraint trigger journal_line_balance_guard
  after insert or update or delete on public.journal_lines
  deferrable initially deferred
  for each row execute function public.finance_assert_balanced_line_row();

create or replace function public.finance_post_agency_charge()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  revenue_code text := case when new.concept = 'empty_box' then '4010' else '4000' end;
  hold_id uuid;
begin
  perform public.finance_post_two_line_entry(
    new.tenant_id, new.matrix_organization_id, 'agency_charge', new.id,
    'Cargo a agencia: ' || new.concept, '1200', revenue_code, new.amount_cents,
    new.agency_organization_id, new.created_by_membership_id
  );
  if new.shipment_id is not null or new.package_id is not null then
    insert into public.financial_holds (
      tenant_id, matrix_organization_id, agency_organization_id, sale_id,
      shipment_id, package_id, agency_charge_id
    ) values (
      new.tenant_id, new.matrix_organization_id, new.agency_organization_id, new.sale_id,
      new.shipment_id, new.package_id, new.id
    ) returning id into hold_id;
    insert into public.financial_hold_events(tenant_id, hold_id, status, reason, actor_membership_id)
    values (new.tenant_id, hold_id, 'active', 'Cargo interno pendiente vinculado a la operación', new.created_by_membership_id);
  end if;
  return new;
end;
$$;

create trigger agency_charge_posting
  after insert on public.agency_charges
  for each row execute function public.finance_post_agency_charge();

create or replace function public.finance_post_agency_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.finance_post_two_line_entry(
    new.tenant_id, new.matrix_organization_id, 'agency_payment', new.id,
    'Pago recibido de agencia', '1100', '1200', new.amount_cents,
    new.agency_organization_id, new.created_by_membership_id
  );
  return new;
end;
$$;

create trigger agency_payment_posting
  after insert on public.agency_payments
  for each row execute function public.finance_post_agency_payment();

create or replace function public.finance_sync_hold_for_charge(
  target_charge_id uuid,
  actor_membership uuid,
  reason_input text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_hold public.financial_holds;
  current_status text;
  remaining bigint;
begin
  select * into target_hold from public.financial_holds where agency_charge_id = target_charge_id;
  if target_hold.id is null then return; end if;
  select status into current_status from public.current_financial_holds where id = target_hold.id;
  select outstanding_cents into remaining from public.agency_charge_balances where id = target_charge_id;
  if remaining = 0 and current_status = 'active' then
    insert into public.financial_hold_events(tenant_id, hold_id, status, reason, actor_membership_id)
    values (target_hold.tenant_id, target_hold.id, 'released_automatically', reason_input, actor_membership);
  elsif remaining > 0 and current_status = 'released_automatically' then
    insert into public.financial_hold_events(tenant_id, hold_id, status, reason, actor_membership_id)
    values (target_hold.tenant_id, target_hold.id, 'active', reason_input, actor_membership);
  end if;
end;
$$;

create or replace function public.finance_post_agency_credit_or_adjustment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  charge_row public.agency_charges;
  revenue_code text;
  event_amount bigint;
begin
  select * into charge_row from public.agency_charges where id = new.charge_id;
  revenue_code := case when charge_row.concept = 'empty_box' then '4010' else '4000' end;
  event_amount := abs(new.amount_cents);
  if tg_table_name = 'agency_credits' or new.amount_cents < 0 then
    perform public.finance_post_two_line_entry(
      new.tenant_id, new.matrix_organization_id,
      case when tg_table_name = 'agency_credits' then 'agency_credit' else 'agency_adjustment' end,
      new.id, new.reason, revenue_code, '1200', event_amount,
      new.agency_organization_id, new.created_by_membership_id
    );
  else
    perform public.finance_post_two_line_entry(
      new.tenant_id, new.matrix_organization_id, 'agency_adjustment', new.id,
      new.reason, '1200', revenue_code, event_amount,
      new.agency_organization_id, new.created_by_membership_id
    );
  end if;
  perform public.finance_sync_hold_for_charge(new.charge_id, new.created_by_membership_id, new.reason);
  return new;
end;
$$;

create trigger agency_credit_posting
  after insert on public.agency_credits
  for each row execute function public.finance_post_agency_credit_or_adjustment();
create trigger agency_adjustment_posting
  after insert on public.agency_adjustments
  for each row execute function public.finance_post_agency_credit_or_adjustment();

create or replace function public.finance_release_paid_hold()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.finance_sync_hold_for_charge(new.charge_id, new.applied_by_membership_id, 'Saldo vinculado pagado');
  return new;
end;
$$;

create trigger agency_application_release_hold
  after insert on public.agency_payment_applications
  for each row execute function public.finance_release_paid_hold();

create or replace function public.finance_guard_international_release()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from 'handed_to_carrier' and new.status = 'handed_to_carrier'
     and exists (
       select 1 from public.current_financial_holds h
       where h.status = 'active'
         and (h.package_id = new.id or (h.package_id is null and h.shipment_id = new.shipment_id))
     ) then
    raise exception 'FINANCIAL_HOLD_ACTIVE';
  end if;
  return new;
end;
$$;

create trigger shipment_package_financial_release_guard
  before update of status on public.shipment_packages
  for each row execute function public.finance_guard_international_release();

-- ---------------------------------------------------------------------------
-- Shared RPC envelope and immutable audit
-- ---------------------------------------------------------------------------

create or replace function public.finance_begin_operation(
  target_tenant_id uuid,
  operation_type_input text,
  idempotency_key_input text
)
returns public.idempotency_operations
language plpgsql
security definer
set search_path = public
as $$
declare
  operation public.idempotency_operations;
begin
  if btrim(coalesce(idempotency_key_input, '')) = '' then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
  select * into operation from public.idempotency_operations
  where tenant_id = target_tenant_id and operation_type = operation_type_input
    and idempotency_key = idempotency_key_input
  for update;
  if operation.id is not null then return operation; end if;
  insert into public.idempotency_operations(
    tenant_id, operation_type, idempotency_key, actor_membership_id, status
  ) values (
    target_tenant_id, operation_type_input, idempotency_key_input, public.current_membership_id(), 'executing'
  ) returning * into operation;
  return operation;
end;
$$;

create or replace function public.finance_complete_operation(operation_id uuid, result_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.idempotency_operations
  set status = 'completed', result = result_input, completed_at = now(), error_code = null
  where id = operation_id and status = 'executing';
  if not found then raise exception 'IDEMPOTENCY_OPERATION_NOT_EXECUTING'; end if;
  return result_input;
end;
$$;

create or replace function public.finance_audit(
  target_tenant_id uuid,
  target_organization_id uuid,
  action_input text,
  entity_type_input text,
  entity_id_input uuid,
  after_state_input jsonb,
  reason_input text,
  idempotency_key_input text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.immutable_audit_events(
    tenant_id, organization_id, actor_user_id, actor_membership_id, action,
    entity_type, entity_id, after_state, reason, idempotency_key
  ) values (
    target_tenant_id, target_organization_id, auth.uid(), public.current_membership_id(), action_input,
    entity_type_input, entity_id_input, after_state_input, coalesce(reason_input, ''), idempotency_key_input
  );
end;
$$;

create or replace function public.finance_next_invoice_number(target_organization_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_number bigint;
begin
  insert into public.commercial_invoice_counters(organization_id, last_number)
  values (target_organization_id, 1)
  on conflict (organization_id) do update
  set last_number = public.commercial_invoice_counters.last_number + 1
  returning last_number into next_number;
  return 'INV-' || lpad(next_number::text, 8, '0');
end;
$$;

create or replace function public.create_agency_sale(command jsonb, idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tenant_id_value uuid := public.current_tenant_id();
  agency_org_id uuid := public.current_business_organization_id();
  membership_id_value uuid := public.current_membership_id();
  agency_row public.agencies;
  operation public.idempotency_operations;
  sale_id_value uuid;
  invoice_id_value uuid;
  shipment_id_value uuid := nullif(command->>'shipmentId', '')::uuid;
  customer_id_value uuid := nullif(command->>'customerId', '')::uuid;
  customer_name_value text := btrim(coalesce(command->>'customerName', ''));
  item jsonb;
  quantity_value integer;
  price_line public.agency_price_list_lines;
  rate_line public.internal_rate_lines;
  line_id_value uuid;
  total_cents_value bigint := 0;
  internal_total_cents bigint := 0;
  line_number_value integer := 0;
  captor_assignment uuid;
  result_value jsonb;
begin
  if tenant_id_value is null or agency_org_id is null or membership_id_value is null then raise exception 'UNAUTHENTICATED'; end if;
  operation := public.finance_begin_operation(tenant_id_value, 'create_agency_sale', idempotency_key);
  if operation.status = 'completed' then
    return jsonb_set(operation.result, '{replayed}', 'true'::jsonb, true);
  elsif operation.actor_membership_id is distinct from membership_id_value then
    raise exception 'IDEMPOTENCY_KEY_IN_USE';
  end if;
  if not public.current_membership_has_permission('agency.sales.create', tenant_id_value, agency_org_id) then
    raise exception 'FORBIDDEN';
  end if;
  select * into agency_row from public.agencies
  where tenant_id = tenant_id_value and organization_id = agency_org_id
    and status = 'active' and archived_at is null;
  if agency_row.id is null then raise exception 'ACTIVE_AGENCY_REQUIRED'; end if;
  if customer_name_value = '' then raise exception 'CUSTOMER_NAME_REQUIRED'; end if;
  if jsonb_typeof(command->'lines') <> 'array' or jsonb_array_length(command->'lines') = 0 then
    raise exception 'SALE_LINES_REQUIRED';
  end if;
  if customer_id_value is not null and not exists (
    select 1 from public.customers c where c.id = customer_id_value and c.organization_id = agency_org_id
  ) then raise exception 'CUSTOMER_SCOPE_MISMATCH'; end if;
  if shipment_id_value is not null and not exists (
    select 1 from public.shipments s
    where s.id = shipment_id_value and s.organization_id = agency_row.matrix_organization_id
  ) then raise exception 'SHIPMENT_SCOPE_MISMATCH'; end if;

  for item in select value from jsonb_array_elements(command->'lines') loop
    quantity_value := coalesce((item->>'quantity')::integer, 0);
    if quantity_value <= 0 then raise exception 'INVALID_QUANTITY'; end if;
    select line.* into price_line
    from public.agency_price_list_lines line
    join public.agency_price_list_versions version on version.id = line.price_list_version_id
    where line.id = (item->>'publicPriceLineId')::uuid
      and line.tenant_id = tenant_id_value and version.agency_organization_id = agency_org_id
      and version.status = 'active' and version.valid_from <= now()
      and (version.valid_until is null or version.valid_until > now());
    if price_line.id is null then raise exception 'PUBLIC_PRICE_NOT_ACTIVE'; end if;
    select line.* into rate_line
    from public.internal_rate_lines line
    join public.internal_rate_versions version on version.id = line.rate_version_id
    where line.tenant_id = tenant_id_value
      and version.matrix_organization_id = agency_row.matrix_organization_id
      and (version.agency_organization_id is null or version.agency_organization_id = agency_org_id)
      and version.status = 'active' and version.valid_from <= now()
      and (version.valid_until is null or version.valid_until > now())
      and line.destination_code = price_line.destination_code
      and line.product_code = price_line.product_code and line.concept = price_line.concept
    order by (version.agency_organization_id is not null) desc, version.valid_from desc
    limit 1;
    if rate_line.id is null then raise exception 'INTERNAL_RATE_NOT_ACTIVE'; end if;
    total_cents_value := total_cents_value + price_line.amount_cents * quantity_value;
    internal_total_cents := internal_total_cents + rate_line.amount_cents * quantity_value;
  end loop;

  select assignment.id into captor_assignment
  from public.agency_captor_assignments assignment
  where assignment.agency_id = agency_row.id and assignment.ended_at is null
  order by assignment.started_at desc limit 1;
  insert into public.sales(
    tenant_id, selling_organization_id, matrix_organization_id, agency_organization_id,
    shipment_id, legacy_distribution_partner_id, sale_kind, customer_id, customer_name_snapshot,
    subtotal_cents, total_cents, captor_assignment_id, seller_membership_id,
    attribution_snapshot, idempotency_key
  ) values (
    tenant_id_value, agency_org_id, agency_row.matrix_organization_id, agency_org_id,
    shipment_id_value, agency_row.legacy_distribution_partner_id, 'agency_retail', customer_id_value,
    customer_name_value, total_cents_value, total_cents_value, captor_assignment, membership_id_value,
    jsonb_build_object('captorAssignmentId', captor_assignment, 'sellerMembershipId', membership_id_value),
    idempotency_key
  ) returning id into sale_id_value;
  insert into public.customer_invoices(
    tenant_id, organization_id, sale_id, customer_id, invoice_number, due_at,
    amount_cents, created_by_membership_id
  ) values (
    tenant_id_value, agency_org_id, sale_id_value, customer_id_value,
    public.finance_next_invoice_number(agency_org_id), nullif(command->>'dueAt', '')::timestamptz,
    total_cents_value, membership_id_value
  ) returning id into invoice_id_value;

  for item in select value from jsonb_array_elements(command->'lines') loop
    line_number_value := line_number_value + 1;
    quantity_value := (item->>'quantity')::integer;
    select line.* into price_line from public.agency_price_list_lines line
    where line.id = (item->>'publicPriceLineId')::uuid;
    select line.* into rate_line
    from public.internal_rate_lines line
    join public.internal_rate_versions version on version.id = line.rate_version_id
    where line.tenant_id = tenant_id_value
      and version.matrix_organization_id = agency_row.matrix_organization_id
      and (version.agency_organization_id is null or version.agency_organization_id = agency_org_id)
      and version.status = 'active' and version.valid_from <= now()
      and (version.valid_until is null or version.valid_until > now())
      and line.destination_code = price_line.destination_code
      and line.product_code = price_line.product_code and line.concept = price_line.concept
    order by (version.agency_organization_id is not null) desc, version.valid_from desc limit 1;
    insert into public.sale_lines(
      tenant_id, organization_id, sale_id, line_number, concept, description, quantity,
      unit_amount_cents, internal_rate_line_id, public_price_line_id, box_source, rate_snapshot
    ) values (
      tenant_id_value, agency_org_id, sale_id_value, line_number_value, price_line.concept,
      coalesce(nullif(btrim(item->>'description'), ''), price_line.product_code), quantity_value,
      price_line.amount_cents, rate_line.id, price_line.id,
      case when price_line.concept = 'international_shipping' then coalesce(nullif(item->>'boxSource', ''), 'matrix_purchased') else null end,
      jsonb_build_object(
        'publicPriceLineId', price_line.id, 'publicAmountCents', price_line.amount_cents,
        'internalRateLineId', rate_line.id, 'internalAmountCents', rate_line.amount_cents,
        'destinationCode', price_line.destination_code, 'productCode', price_line.product_code,
        'inventoryItemId', nullif(item->>'inventoryItemId', ''),
        'productKey', coalesce(nullif(item->>'productKey', ''), price_line.product_code),
        'boxSize', nullif(item->>'boxSize', ''), 'quantity', quantity_value
      )
    ) returning id into line_id_value;
    insert into public.customer_invoice_lines(
      tenant_id, organization_id, invoice_id, sale_line_id, line_number,
      description, quantity, unit_amount_cents
    ) values (
      tenant_id_value, agency_org_id, invoice_id_value, line_id_value, line_number_value,
      coalesce(nullif(btrim(item->>'description'), ''), price_line.product_code), quantity_value, price_line.amount_cents
    );
    if rate_line.amount_cents > 0 then
      insert into public.agency_charges(
        tenant_id, matrix_organization_id, agency_organization_id, sale_id, shipment_id,
        concept, source_operation_type, source_operation_id, amount_cents,
        created_by_membership_id, idempotency_key, metadata
      ) values (
        tenant_id_value, agency_row.matrix_organization_id, agency_org_id, sale_id_value, shipment_id_value,
        rate_line.concept, 'sale_line', line_id_value, rate_line.amount_cents * quantity_value,
        membership_id_value, idempotency_key || ':charge:' || line_number_value,
        jsonb_build_object('quantity', quantity_value, 'unitAmountCents', rate_line.amount_cents)
      );
    end if;
  end loop;
  perform public.finance_audit(
    tenant_id_value, agency_org_id, 'agency_sale.created', 'sale', sale_id_value,
    jsonb_build_object('invoiceId', invoice_id_value, 'totalCents', total_cents_value, 'internalTotalCents', internal_total_cents),
    '', idempotency_key
  );
  result_value := jsonb_build_object(
    'operationId', operation.id, 'replayed', false, 'version', 1,
    'entities', jsonb_build_object('saleId', sale_id_value, 'invoiceId', invoice_id_value)
  );
  return public.finance_complete_operation(operation.id, result_value);
end;
$$;

create or replace function public.record_agency_payment(command jsonb, idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tenant_id_value uuid := public.current_tenant_id();
  matrix_org_id uuid := public.current_business_organization_id();
  membership_id_value uuid := public.current_membership_id();
  agency_org_id uuid := nullif(command->>'agencyOrganizationId', '')::uuid;
  amount_value bigint := coalesce((command->>'amountCents')::bigint, 0);
  operation public.idempotency_operations;
  payment_id_value uuid;
  item jsonb;
  application_total bigint := 0;
  result_value jsonb;
begin
  if tenant_id_value is null or matrix_org_id is null then raise exception 'UNAUTHENTICATED'; end if;
  operation := public.finance_begin_operation(tenant_id_value, 'record_agency_payment', idempotency_key);
  if operation.status = 'completed' then return jsonb_set(operation.result, '{replayed}', 'true'::jsonb, true); end if;
  if operation.actor_membership_id is distinct from membership_id_value then raise exception 'IDEMPOTENCY_KEY_IN_USE'; end if;
  if not public.current_membership_has_permission('agency.account.payment', tenant_id_value, matrix_org_id) then
    raise exception 'FORBIDDEN';
  end if;
  if amount_value <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  if not exists (
    select 1 from public.agencies
    where tenant_id = tenant_id_value and matrix_organization_id = matrix_org_id
      and organization_id = agency_org_id and archived_at is null
  ) then raise exception 'AGENCY_SCOPE_MISMATCH'; end if;
  insert into public.agency_payments(
    tenant_id, matrix_organization_id, agency_organization_id, amount_cents,
    method, reference, received_at, created_by_membership_id, idempotency_key, metadata
  ) values (
    tenant_id_value, matrix_org_id, agency_org_id, amount_value,
    coalesce(nullif(btrim(command->>'method'), ''), 'unspecified'), coalesce(command->>'reference', ''),
    coalesce(nullif(command->>'receivedAt', '')::timestamptz, now()), membership_id_value,
    idempotency_key, coalesce(command->'metadata', '{}'::jsonb)
  ) returning id into payment_id_value;
  if command ? 'applications' and jsonb_typeof(command->'applications') = 'array' then
    if not public.current_membership_has_permission('agency.account.apply', tenant_id_value, matrix_org_id) then
      raise exception 'FORBIDDEN';
    end if;
    for item in select value from jsonb_array_elements(command->'applications') loop
      application_total := application_total + coalesce((item->>'amountCents')::bigint, 0);
      insert into public.agency_payment_applications(
        tenant_id, matrix_organization_id, agency_organization_id, payment_id,
        charge_id, amount_cents, applied_by_membership_id
      ) values (
        tenant_id_value, matrix_org_id, agency_org_id, payment_id_value,
        (item->>'chargeId')::uuid, (item->>'amountCents')::bigint, membership_id_value
      );
    end loop;
  end if;
  if application_total > amount_value then raise exception 'PAYMENT_OVERAPPLIED'; end if;
  perform public.finance_audit(
    tenant_id_value, matrix_org_id, 'agency_payment.recorded', 'agency_payment', payment_id_value,
    jsonb_build_object('agencyOrganizationId', agency_org_id, 'amountCents', amount_value, 'appliedCents', application_total),
    '', idempotency_key
  );
  result_value := jsonb_build_object(
    'operationId', operation.id, 'replayed', false, 'version', 1,
    'entities', jsonb_build_object('paymentId', payment_id_value, 'appliedCents', application_total, 'unappliedCents', amount_value - application_total)
  );
  return public.finance_complete_operation(operation.id, result_value);
end;
$$;

create or replace function public.record_customer_payment(command jsonb, idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tenant_id_value uuid := public.current_tenant_id();
  organization_id_value uuid := public.current_business_organization_id();
  membership_id_value uuid := public.current_membership_id();
  customer_id_value uuid := nullif(command->>'customerId', '')::uuid;
  amount_value bigint := coalesce((command->>'amountCents')::bigint, 0);
  operation public.idempotency_operations;
  payment_id_value uuid;
  item jsonb;
  application_total bigint := 0;
  result_value jsonb;
begin
  if tenant_id_value is null or organization_id_value is null then raise exception 'UNAUTHENTICATED'; end if;
  operation := public.finance_begin_operation(tenant_id_value, 'record_customer_payment', idempotency_key);
  if operation.status = 'completed' then return jsonb_set(operation.result, '{replayed}', 'true'::jsonb, true); end if;
  if operation.actor_membership_id is distinct from membership_id_value then raise exception 'IDEMPOTENCY_KEY_IN_USE'; end if;
  if not public.current_membership_has_permission('agency.customer_finance.collect', tenant_id_value, organization_id_value) then
    raise exception 'FORBIDDEN';
  end if;
  if amount_value <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  if not exists (
    select 1 from public.organizations where id = organization_id_value and tenant_id = tenant_id_value and organization_type = 'agency'
  ) then raise exception 'AGENCY_ORGANIZATION_REQUIRED'; end if;
  if customer_id_value is not null and not exists (
    select 1 from public.customers where id = customer_id_value and organization_id = organization_id_value
  ) then raise exception 'CUSTOMER_SCOPE_MISMATCH'; end if;
  insert into public.customer_payments(
    tenant_id, organization_id, customer_id, amount_cents, method, reference,
    received_at, created_by_membership_id, idempotency_key, metadata
  ) values (
    tenant_id_value, organization_id_value, customer_id_value, amount_value,
    coalesce(nullif(btrim(command->>'method'), ''), 'unspecified'), coalesce(command->>'reference', ''),
    coalesce(nullif(command->>'receivedAt', '')::timestamptz, now()), membership_id_value,
    idempotency_key, coalesce(command->'metadata', '{}'::jsonb)
  ) returning id into payment_id_value;
  if command ? 'applications' and jsonb_typeof(command->'applications') = 'array' then
    for item in select value from jsonb_array_elements(command->'applications') loop
      application_total := application_total + coalesce((item->>'amountCents')::bigint, 0);
      insert into public.customer_payment_applications(
        tenant_id, organization_id, payment_id, invoice_id, amount_cents, applied_by_membership_id
      ) values (
        tenant_id_value, organization_id_value, payment_id_value,
        (item->>'invoiceId')::uuid, (item->>'amountCents')::bigint, membership_id_value
      );
    end loop;
  end if;
  if application_total > amount_value then raise exception 'PAYMENT_OVERAPPLIED'; end if;
  perform public.finance_audit(
    tenant_id_value, organization_id_value, 'customer_payment.recorded', 'customer_payment', payment_id_value,
    jsonb_build_object('amountCents', amount_value, 'appliedCents', application_total), '', idempotency_key
  );
  result_value := jsonb_build_object(
    'operationId', operation.id, 'replayed', false, 'version', 1,
    'entities', jsonb_build_object('paymentId', payment_id_value, 'appliedCents', application_total, 'unappliedCents', amount_value - application_total)
  );
  return public.finance_complete_operation(operation.id, result_value);
end;
$$;

create or replace function public.finance_reverse_journal(
  p_original_source_type text,
  p_original_source_id uuid,
  p_reversal_source_id uuid,
  p_reason text,
  p_actor_membership uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  original public.journal_entries;
  reversing_entry uuid;
  source_line public.journal_lines;
begin
  select entry.* into original from public.journal_entries entry
  where entry.source_type = p_original_source_type and entry.source_id = p_original_source_id;
  if original.id is null then raise exception 'ORIGINAL_JOURNAL_NOT_FOUND'; end if;
  insert into public.journal_entries(
    tenant_id, matrix_organization_id, period_id, entry_number, description,
    source_type, source_id, reversal_of_entry_id, created_by_membership_id
  ) values (
    original.tenant_id, original.matrix_organization_id, original.period_id,
    public.finance_next_journal_number(original.matrix_organization_id), p_reason,
    'financial_reversal', p_reversal_source_id, original.id, p_actor_membership
  ) returning id into reversing_entry;
  for source_line in select * from public.journal_lines where journal_entry_id = original.id order by line_number loop
    insert into public.journal_lines(
      tenant_id, matrix_organization_id, journal_entry_id, line_number, account_id,
      agency_organization_id, description, debit_cents, credit_cents
    ) values (
      source_line.tenant_id, source_line.matrix_organization_id, reversing_entry, source_line.line_number,
      source_line.account_id, source_line.agency_organization_id, p_reason,
      source_line.credit_cents, source_line.debit_cents
    );
  end loop;
  return reversing_entry;
end;
$$;

create or replace function public.finance_reactivate_hold_after_application_reversal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  application public.agency_payment_applications;
  target_hold public.financial_holds;
begin
  select * into application from public.agency_payment_applications where id = new.application_id;
  select * into target_hold from public.financial_holds where agency_charge_id = application.charge_id;
  if target_hold.id is not null and exists (
    select 1 from public.current_financial_holds where id = target_hold.id and status = 'released_automatically'
  ) then
    insert into public.financial_hold_events(tenant_id, hold_id, status, reason, actor_membership_id)
    values (new.tenant_id, target_hold.id, 'active', 'Aplicación de pago revertida', new.created_by_membership_id);
  end if;
  return new;
end;
$$;

create trigger agency_application_reversal_reactivates_hold
  after insert on public.agency_payment_application_reversals
  for each row execute function public.finance_reactivate_hold_after_application_reversal();

create or replace function public.reverse_financial_event(command jsonb, idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tenant_id_value uuid := public.current_tenant_id();
  matrix_org_id uuid := public.current_business_organization_id();
  membership_id_value uuid := public.current_membership_id();
  target_type_value text := command->>'targetType';
  target_id_value uuid := nullif(command->>'targetId', '')::uuid;
  reason_value text := btrim(coalesce(command->>'reason', ''));
  operation public.idempotency_operations;
  charge_row public.agency_charges;
  payment_row public.agency_payments;
  customer_payment_row public.customer_payments;
  credit_row public.agency_credits;
  adjustment_row public.agency_adjustments;
  settlement_row public.driver_settlements;
  reversal_id_value uuid;
  application public.agency_payment_applications;
  customer_application public.customer_payment_applications;
  result_value jsonb;
begin
  if tenant_id_value is null or matrix_org_id is null then raise exception 'UNAUTHENTICATED'; end if;
  operation := public.finance_begin_operation(tenant_id_value, 'reverse_financial_event', idempotency_key);
  if operation.status = 'completed' then return jsonb_set(operation.result, '{replayed}', 'true'::jsonb, true); end if;
  if operation.actor_membership_id is distinct from membership_id_value then raise exception 'IDEMPOTENCY_KEY_IN_USE'; end if;
  if reason_value = '' then raise exception 'REVERSAL_REASON_REQUIRED'; end if;
  if target_type_value = 'charge' then
    if not public.current_membership_has_permission('accounting.reverse', tenant_id_value, matrix_org_id) then raise exception 'FORBIDDEN'; end if;
    select * into charge_row from public.agency_charges
    where id = target_id_value and tenant_id = tenant_id_value and matrix_organization_id = matrix_org_id for update;
    if charge_row.id is null then raise exception 'CHARGE_NOT_FOUND'; end if;
    if exists (
      select 1 from public.agency_payment_applications application
      where application.charge_id = charge_row.id
        and not exists (select 1 from public.agency_payment_application_reversals reversal where reversal.application_id = application.id)
    ) then raise exception 'REVERSE_APPLICATIONS_FIRST'; end if;
    if exists (
      select 1 from public.agency_credits credit where credit.charge_id = charge_row.id
        and not exists (select 1 from public.agency_financial_reversals reversal where reversal.target_type = 'credit' and reversal.target_id = credit.id)
    ) or exists (
      select 1 from public.agency_adjustments adjustment where adjustment.charge_id = charge_row.id
        and not exists (select 1 from public.agency_financial_reversals reversal where reversal.target_type = 'adjustment' and reversal.target_id = adjustment.id)
    ) then raise exception 'REVERSE_CHILD_EVENTS_FIRST'; end if;
    insert into public.agency_financial_reversals(
      tenant_id, matrix_organization_id, agency_organization_id, target_type, target_id,
      amount_cents, reason, created_by_membership_id, idempotency_key
    ) values (
      tenant_id_value, matrix_org_id, charge_row.agency_organization_id, 'charge', charge_row.id,
      charge_row.amount_cents, reason_value, membership_id_value, idempotency_key
    ) returning id into reversal_id_value;
    perform public.finance_reverse_journal('agency_charge', charge_row.id, reversal_id_value, reason_value, membership_id_value);
    insert into public.financial_hold_events(tenant_id, hold_id, status, reason, actor_membership_id)
    select tenant_id_value, hold.id, 'cancelled', reason_value, membership_id_value
    from public.financial_holds hold
    join public.current_financial_holds current_hold on current_hold.id = hold.id and current_hold.status = 'active'
    where hold.agency_charge_id = charge_row.id;
  elsif target_type_value = 'credit' then
    if not public.current_membership_has_permission('accounting.reverse', tenant_id_value, matrix_org_id) then raise exception 'FORBIDDEN'; end if;
    select * into credit_row from public.agency_credits
    where id = target_id_value and tenant_id = tenant_id_value and matrix_organization_id = matrix_org_id for update;
    if credit_row.id is null then raise exception 'CREDIT_NOT_FOUND'; end if;
    insert into public.agency_financial_reversals(
      tenant_id, matrix_organization_id, agency_organization_id, target_type, target_id,
      amount_cents, reason, created_by_membership_id, idempotency_key
    ) values (
      tenant_id_value, matrix_org_id, credit_row.agency_organization_id, 'credit', credit_row.id,
      credit_row.amount_cents, reason_value, membership_id_value, idempotency_key
    ) returning id into reversal_id_value;
    perform public.finance_reverse_journal('agency_credit', credit_row.id, reversal_id_value, reason_value, membership_id_value);
    perform public.finance_sync_hold_for_charge(credit_row.charge_id, membership_id_value, reason_value);
  elsif target_type_value = 'adjustment' then
    if not public.current_membership_has_permission('accounting.reverse', tenant_id_value, matrix_org_id) then raise exception 'FORBIDDEN'; end if;
    select * into adjustment_row from public.agency_adjustments
    where id = target_id_value and tenant_id = tenant_id_value and matrix_organization_id = matrix_org_id for update;
    if adjustment_row.id is null then raise exception 'ADJUSTMENT_NOT_FOUND'; end if;
    insert into public.agency_financial_reversals(
      tenant_id, matrix_organization_id, agency_organization_id, target_type, target_id,
      amount_cents, reason, created_by_membership_id, idempotency_key
    ) values (
      tenant_id_value, matrix_org_id, adjustment_row.agency_organization_id, 'adjustment', adjustment_row.id,
      abs(adjustment_row.amount_cents), reason_value, membership_id_value, idempotency_key
    ) returning id into reversal_id_value;
    perform public.finance_reverse_journal('agency_adjustment', adjustment_row.id, reversal_id_value, reason_value, membership_id_value);
    perform public.finance_sync_hold_for_charge(adjustment_row.charge_id, membership_id_value, reason_value);
  elsif target_type_value = 'payment' then
    if not public.current_membership_has_permission('accounting.reverse', tenant_id_value, matrix_org_id) then raise exception 'FORBIDDEN'; end if;
    select * into payment_row from public.agency_payments
    where id = target_id_value and tenant_id = tenant_id_value and matrix_organization_id = matrix_org_id for update;
    if payment_row.id is null then raise exception 'PAYMENT_NOT_FOUND'; end if;
    for application in
      select a.* from public.agency_payment_applications a
      where a.payment_id = payment_row.id
        and not exists (select 1 from public.agency_payment_application_reversals r where r.application_id = a.id)
    loop
      insert into public.agency_payment_application_reversals(
        tenant_id, application_id, reason, created_by_membership_id
      ) values (tenant_id_value, application.id, reason_value, membership_id_value);
    end loop;
    insert into public.agency_financial_reversals(
      tenant_id, matrix_organization_id, agency_organization_id, target_type, target_id,
      amount_cents, reason, created_by_membership_id, idempotency_key
    ) values (
      tenant_id_value, matrix_org_id, payment_row.agency_organization_id, 'payment', payment_row.id,
      payment_row.amount_cents, reason_value, membership_id_value, idempotency_key
    ) returning id into reversal_id_value;
    perform public.finance_reverse_journal('agency_payment', payment_row.id, reversal_id_value, reason_value, membership_id_value);
  elsif target_type_value = 'customer_payment' then
    if not public.current_membership_has_permission('agency.customer_finance.collect', tenant_id_value, matrix_org_id) then raise exception 'FORBIDDEN'; end if;
    select * into customer_payment_row from public.customer_payments
    where id = target_id_value and tenant_id = tenant_id_value and organization_id = matrix_org_id for update;
    if customer_payment_row.id is null then raise exception 'CUSTOMER_PAYMENT_NOT_FOUND'; end if;
    for customer_application in
      select a.* from public.customer_payment_applications a
      where a.payment_id = customer_payment_row.id
        and not exists (select 1 from public.customer_payment_application_reversals r where r.application_id = a.id)
    loop
      insert into public.customer_payment_application_reversals(
        tenant_id, organization_id, application_id, reason, created_by_membership_id
      ) values (tenant_id_value, matrix_org_id, customer_application.id, reason_value, membership_id_value);
    end loop;
    insert into public.customer_payment_reversals(
      tenant_id, organization_id, payment_id, reason, created_by_membership_id
    ) values (
      tenant_id_value, matrix_org_id, customer_payment_row.id, reason_value, membership_id_value
    ) returning id into reversal_id_value;
  elsif target_type_value = 'driver_settlement' then
    if not public.current_membership_has_permission('accounting.reverse', tenant_id_value, matrix_org_id) then raise exception 'FORBIDDEN'; end if;
    select * into settlement_row from public.driver_settlements
    where id = target_id_value and tenant_id = tenant_id_value and matrix_organization_id = matrix_org_id for update;
    if settlement_row.id is null then raise exception 'DRIVER_SETTLEMENT_NOT_FOUND'; end if;
    insert into public.driver_settlement_reversals(
      tenant_id, matrix_organization_id, settlement_id, reason,
      reversed_by_membership_id, idempotency_key
    ) values (
      tenant_id_value, matrix_org_id, settlement_row.id, reason_value,
      membership_id_value, idempotency_key
    ) returning id into reversal_id_value;
    perform public.finance_reverse_journal('driver_settlement', settlement_row.id, reversal_id_value, reason_value, membership_id_value);
  else
    raise exception 'UNSUPPORTED_REVERSAL_TARGET';
  end if;
  perform public.finance_audit(
    tenant_id_value, matrix_org_id, 'financial_event.reversed', target_type_value, target_id_value,
    jsonb_build_object('reversalId', reversal_id_value), reason_value, idempotency_key
  );
  result_value := jsonb_build_object(
    'operationId', operation.id, 'replayed', false, 'version', 1,
    'entities', jsonb_build_object('reversalId', reversal_id_value, 'targetType', target_type_value, 'targetId', target_id_value)
  );
  return public.finance_complete_operation(operation.id, result_value);
end;
$$;

create or replace function public.finance_post_driver_cash_custody()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  credit_code text := case when new.source_type = 'agency_customer_receivable' then '2100' else '1210' end;
begin
  perform public.finance_post_two_line_entry(
    new.tenant_id, new.matrix_organization_id, 'driver_cash_custody', new.id,
    case when new.source_type = 'agency_customer_receivable'
      then 'Efectivo en tránsito por pagar a agencia' else 'Efectivo en tránsito de la matriz' end,
    '1120', credit_code, new.amount_cents,
    case when new.source_type = 'agency_customer_receivable' then new.beneficiary_organization_id else null end,
    new.driver_membership_id
  );
  return new;
end;
$$;

create trigger driver_cash_custody_posting
  after insert on public.driver_cash_custody_events
  for each row execute function public.finance_post_driver_cash_custody();

create or replace function public.reconcile_driver_settlement(command jsonb, idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tenant_id_value uuid := public.current_tenant_id();
  matrix_org_id uuid := public.current_business_organization_id();
  membership_id_value uuid := public.current_membership_id();
  driver_membership_value uuid := nullif(command->>'driverMembershipId', '')::uuid;
  counted_value bigint := coalesce((command->>'countedCents')::bigint, -1);
  reason_value text := btrim(coalesce(command->>'reason', ''));
  operation public.idempotency_operations;
  settlement_id_value uuid;
  expected_value bigint := 0;
  item jsonb;
  event_row public.driver_cash_custody_events;
  entry_id_value uuid;
  cash_account uuid;
  transit_account uuid;
  difference_account uuid;
  result_value jsonb;
begin
  if tenant_id_value is null or matrix_org_id is null then raise exception 'UNAUTHENTICATED'; end if;
  operation := public.finance_begin_operation(tenant_id_value, 'reconcile_driver_settlement', idempotency_key);
  if operation.status = 'completed' then return jsonb_set(operation.result, '{replayed}', 'true'::jsonb, true); end if;
  if operation.actor_membership_id is distinct from membership_id_value then raise exception 'IDEMPOTENCY_KEY_IN_USE'; end if;
  if not public.current_membership_has_permission('accounting.reconcile', tenant_id_value, matrix_org_id) then raise exception 'FORBIDDEN'; end if;
  if counted_value < 0 then raise exception 'INVALID_COUNTED_AMOUNT'; end if;
  if jsonb_typeof(command->'custodyEventIds') <> 'array' or jsonb_array_length(command->'custodyEventIds') = 0 then
    raise exception 'CUSTODY_EVENTS_REQUIRED';
  end if;
  for item in select value from jsonb_array_elements(command->'custodyEventIds') loop
    select * into event_row from public.driver_cash_custody_events
    where id = (item #>> '{}')::uuid and tenant_id = tenant_id_value
      and matrix_organization_id = matrix_org_id and driver_membership_id = driver_membership_value
    for update;
    if event_row.id is null then raise exception 'CUSTODY_EVENT_NOT_FOUND'; end if;
    if exists (
      select 1 from public.driver_settlement_lines settlement_line
      where settlement_line.custody_event_id = event_row.id
        and not exists (
          select 1 from public.driver_settlement_reversals reversal
          where reversal.settlement_id = settlement_line.settlement_id
        )
    ) then
      raise exception 'CUSTODY_EVENT_ALREADY_SETTLED';
    end if;
    expected_value := expected_value + event_row.amount_cents;
  end loop;
  if counted_value <> expected_value and reason_value = '' then raise exception 'DIFFERENCE_REASON_REQUIRED'; end if;
  insert into public.driver_settlements(
    tenant_id, matrix_organization_id, driver_membership_id, expected_cents, counted_cents,
    status, reason, evidence, reconciled_by_membership_id, idempotency_key
  ) values (
    tenant_id_value, matrix_org_id, driver_membership_value, expected_value, counted_value,
    case when counted_value = expected_value then 'reconciled' else 'difference' end,
    reason_value, coalesce(command->'evidence', '{}'::jsonb), membership_id_value, idempotency_key
  ) returning id into settlement_id_value;
  for item in select value from jsonb_array_elements(command->'custodyEventIds') loop
    select * into event_row from public.driver_cash_custody_events where id = (item #>> '{}')::uuid;
    insert into public.driver_settlement_lines(tenant_id, settlement_id, custody_event_id, amount_cents)
    values (tenant_id_value, settlement_id_value, event_row.id, event_row.amount_cents);
  end loop;

  perform public.ensure_matrix_chart(tenant_id_value, matrix_org_id);
  select id into cash_account from public.gl_accounts where matrix_organization_id = matrix_org_id and code = '1100';
  select id into transit_account from public.gl_accounts where matrix_organization_id = matrix_org_id and code = '1120';
  select id into difference_account from public.gl_accounts where matrix_organization_id = matrix_org_id and code = '6990';
  insert into public.journal_entries(
    tenant_id, matrix_organization_id, entry_number, description, source_type, source_id, created_by_membership_id
  ) values (
    tenant_id_value, matrix_org_id, public.finance_next_journal_number(matrix_org_id),
    'Liquidación de efectivo del conductor', 'driver_settlement', settlement_id_value, membership_id_value
  ) returning id into entry_id_value;
  if counted_value > 0 then
    insert into public.journal_lines(
      tenant_id, matrix_organization_id, journal_entry_id, line_number, account_id, description, debit_cents, credit_cents
    ) values (tenant_id_value, matrix_org_id, entry_id_value, 1, cash_account, 'Efectivo contado', counted_value, 0);
  end if;
  insert into public.journal_lines(
    tenant_id, matrix_organization_id, journal_entry_id, line_number, account_id, description, debit_cents, credit_cents
  ) values (
    tenant_id_value, matrix_org_id, entry_id_value, 2, transit_account, 'Efectivo entregado', 0, expected_value
  );
  if counted_value < expected_value then
    insert into public.journal_lines(
      tenant_id, matrix_organization_id, journal_entry_id, line_number, account_id, description, debit_cents, credit_cents
    ) values (
      tenant_id_value, matrix_org_id, entry_id_value, 3, difference_account, 'Faltante de caja', expected_value - counted_value, 0
    );
  elsif counted_value > expected_value then
    insert into public.journal_lines(
      tenant_id, matrix_organization_id, journal_entry_id, line_number, account_id, description, debit_cents, credit_cents
    ) values (
      tenant_id_value, matrix_org_id, entry_id_value, 3, difference_account, 'Sobrante de caja', 0, counted_value - expected_value
    );
  end if;
  perform public.finance_audit(
    tenant_id_value, matrix_org_id, 'driver_settlement.reconciled', 'driver_settlement', settlement_id_value,
    jsonb_build_object('expectedCents', expected_value, 'countedCents', counted_value, 'differenceCents', counted_value - expected_value),
    reason_value, idempotency_key
  );
  result_value := jsonb_build_object(
    'operationId', operation.id, 'replayed', false, 'version', 1,
    'entities', jsonb_build_object('settlementId', settlement_id_value, 'journalEntryId', entry_id_value, 'differenceCents', counted_value - expected_value)
  );
  return public.finance_complete_operation(operation.id, result_value);
end;
$$;

create or replace function public.authorize_international_release(command jsonb, idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tenant_id_value uuid := public.current_tenant_id();
  matrix_org_id uuid := public.current_business_organization_id();
  membership_id_value uuid := public.current_membership_id();
  shipment_id_value uuid := nullif(command->>'shipmentId', '')::uuid;
  package_id_value uuid := nullif(command->>'packageId', '')::uuid;
  request_id_value uuid := nullif(command->>'releaseRequestId', '')::uuid;
  manual_value boolean := coalesce((command->>'manual')::boolean, false);
  reason_value text := btrim(coalesce(command->>'reason', ''));
  evidence_value jsonb := coalesce(command->'evidence', '{}'::jsonb);
  second_approval boolean := false;
  operation public.idempotency_operations;
  hold_row public.current_financial_holds;
  release_request public.financial_hold_release_requests;
  released_count integer := 0;
  pending_request_id uuid;
  result_value jsonb;
begin
  if tenant_id_value is null or matrix_org_id is null then raise exception 'UNAUTHENTICATED'; end if;
  operation := public.finance_begin_operation(tenant_id_value, 'authorize_international_release', idempotency_key);
  if operation.status = 'completed' then return jsonb_set(operation.result, '{replayed}', 'true'::jsonb, true); end if;
  if operation.actor_membership_id is distinct from membership_id_value then raise exception 'IDEMPOTENCY_KEY_IN_USE'; end if;
  if shipment_id_value is null and package_id_value is null and request_id_value is null then
    raise exception 'RELEASE_TARGET_REQUIRED';
  end if;
  select coalesce((
    select policy.manual_release_requires_second_approval
    from public.financial_hold_policies policy where policy.tenant_id = tenant_id_value
  ), false) into second_approval;
  if request_id_value is not null then
    select * into release_request from public.financial_hold_release_requests
    where id = request_id_value and tenant_id = tenant_id_value;
    if release_request.id is null then raise exception 'RELEASE_REQUEST_NOT_FOUND'; end if;
    if release_request.requested_by_membership_id = membership_id_value then raise exception 'SECOND_APPROVER_MUST_DIFFER'; end if;
    if not public.current_membership_has_permission('financial_hold.release_manual', tenant_id_value, matrix_org_id) then raise exception 'FORBIDDEN'; end if;
    if exists (select 1 from public.financial_hold_release_approvals where request_id = release_request.id) then
      raise exception 'RELEASE_REQUEST_ALREADY_APPROVED';
    end if;
    insert into public.financial_hold_release_approvals(tenant_id, request_id, approved_by_membership_id)
    values (tenant_id_value, release_request.id, membership_id_value);
    insert into public.financial_hold_events(tenant_id, hold_id, status, reason, evidence, actor_membership_id)
    values (tenant_id_value, release_request.hold_id, 'released_manually', release_request.reason, release_request.evidence, membership_id_value);
    released_count := 1;
  else
    if not manual_value and not public.current_membership_has_permission('financial_hold.release', tenant_id_value, matrix_org_id) then
      raise exception 'FORBIDDEN';
    end if;
    for hold_row in
      select * from public.current_financial_holds hold
      where hold.tenant_id = tenant_id_value and hold.matrix_organization_id = matrix_org_id
        and hold.status = 'active'
        and ((package_id_value is not null and hold.package_id = package_id_value)
          or (shipment_id_value is not null and hold.shipment_id = shipment_id_value))
    loop
      if exists (select 1 from public.agency_charge_balances where id = hold_row.agency_charge_id and outstanding_cents > 0) then
        if not manual_value then raise exception 'FINANCIAL_HOLD_ACTIVE'; end if;
        if not public.current_membership_has_permission('financial_hold.release_manual', tenant_id_value, matrix_org_id) then raise exception 'FORBIDDEN'; end if;
        if reason_value = '' or evidence_value = '{}'::jsonb then raise exception 'MANUAL_RELEASE_EVIDENCE_REQUIRED'; end if;
        if second_approval then
          insert into public.financial_hold_release_requests(
            tenant_id, hold_id, reason, evidence, requested_by_membership_id, idempotency_key
          ) values (
            tenant_id_value, hold_row.id, reason_value, evidence_value, membership_id_value,
            idempotency_key || ':' || hold_row.id
          ) returning id into pending_request_id;
        else
          insert into public.financial_hold_events(tenant_id, hold_id, status, reason, evidence, actor_membership_id)
          values (tenant_id_value, hold_row.id, 'released_manually', reason_value, evidence_value, membership_id_value);
          released_count := released_count + 1;
        end if;
      else
        insert into public.financial_hold_events(tenant_id, hold_id, status, reason, actor_membership_id)
        values (tenant_id_value, hold_row.id, 'released_automatically', 'Saldo vinculado en cero', membership_id_value);
        released_count := released_count + 1;
      end if;
    end loop;
  end if;
  perform public.finance_audit(
    tenant_id_value, matrix_org_id,
    case when pending_request_id is null then 'financial_hold.released' else 'financial_hold.release_requested' end,
    'financial_hold', coalesce(request_id_value, pending_request_id),
    jsonb_build_object('releasedCount', released_count, 'releaseRequestId', pending_request_id), reason_value, idempotency_key
  );
  result_value := jsonb_build_object(
    'operationId', operation.id, 'replayed', false, 'version', 1,
    'entities', jsonb_build_object(
      'releasedCount', released_count, 'releaseRequestId', pending_request_id,
      'status', case when pending_request_id is null then 'released' else 'pending_second_approval' end
    )
  );
  return public.finance_complete_operation(operation.id, result_value);
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS: tenant and organization are both checked. Financial writes use RPCs.
-- ---------------------------------------------------------------------------

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'internal_rate_versions', 'internal_rate_lines', 'agency_price_list_versions', 'agency_price_list_lines',
    'sales', 'sale_lines', 'commercial_invoice_counters', 'customer_invoices', 'customer_invoice_lines',
    'customer_payments', 'customer_payment_applications', 'customer_payment_application_reversals', 'customer_credit_notes', 'customer_payment_reversals',
    'agency_charges', 'agency_payments', 'agency_payment_applications', 'agency_payment_application_reversals',
    'agency_credits', 'agency_adjustments', 'agency_financial_reversals',
    'gl_accounts', 'accounting_periods', 'journal_entries', 'journal_lines', 'journal_entry_counters',
    'driver_cash_custody_events', 'driver_settlements', 'driver_settlement_lines', 'driver_settlement_reversals',
    'financial_holds', 'financial_hold_events', 'financial_hold_policies',
    'financial_hold_release_requests', 'financial_hold_release_approvals'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

create policy internal_rate_versions_read on public.internal_rate_versions for select to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_membership_has_permission('agency.pricing.view', tenant_id, matrix_organization_id)
);
create policy internal_rate_versions_write on public.internal_rate_versions for all to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_membership_has_permission('agency.pricing.manage', tenant_id, matrix_organization_id)
)
with check (
  tenant_id = public.current_tenant_id()
  and public.current_membership_has_permission('agency.pricing.manage', tenant_id, matrix_organization_id)
);
create policy internal_rate_lines_read on public.internal_rate_lines for select to authenticated
using (exists (
  select 1 from public.internal_rate_versions version
  where version.id = internal_rate_lines.rate_version_id and version.tenant_id = internal_rate_lines.tenant_id
    and public.current_membership_has_permission('agency.pricing.view', internal_rate_lines.tenant_id, version.matrix_organization_id)
));
create policy internal_rate_lines_write on public.internal_rate_lines for all to authenticated
using (exists (
  select 1 from public.internal_rate_versions version
  where version.id = internal_rate_lines.rate_version_id and version.tenant_id = internal_rate_lines.tenant_id
    and public.current_membership_has_permission('agency.pricing.manage', internal_rate_lines.tenant_id, version.matrix_organization_id)
))
with check (exists (
  select 1 from public.internal_rate_versions version
  where version.id = internal_rate_lines.rate_version_id and version.tenant_id = internal_rate_lines.tenant_id
    and public.current_membership_has_permission('agency.pricing.manage', internal_rate_lines.tenant_id, version.matrix_organization_id)
));

create policy agency_price_versions_read on public.agency_price_list_versions for select to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_membership_has_permission('agency.pricing.view', tenant_id, agency_organization_id)
);
create policy agency_price_versions_write on public.agency_price_list_versions for all to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_membership_has_permission('agency.pricing.manage', tenant_id, agency_organization_id)
)
with check (
  tenant_id = public.current_tenant_id()
  and public.current_membership_has_permission('agency.pricing.manage', tenant_id, agency_organization_id)
);
create policy agency_price_lines_read on public.agency_price_list_lines for select to authenticated
using (exists (
  select 1 from public.agency_price_list_versions version
  where version.id = agency_price_list_lines.price_list_version_id and version.tenant_id = agency_price_list_lines.tenant_id
    and public.current_membership_has_permission('agency.pricing.view', agency_price_list_lines.tenant_id, version.agency_organization_id)
));
create policy agency_price_lines_write on public.agency_price_list_lines for all to authenticated
using (exists (
  select 1 from public.agency_price_list_versions version
  where version.id = agency_price_list_lines.price_list_version_id and version.tenant_id = agency_price_list_lines.tenant_id
    and public.current_membership_has_permission('agency.pricing.manage', agency_price_list_lines.tenant_id, version.agency_organization_id)
))
with check (exists (
  select 1 from public.agency_price_list_versions version
  where version.id = agency_price_list_lines.price_list_version_id and version.tenant_id = agency_price_list_lines.tenant_id
    and public.current_membership_has_permission('agency.pricing.manage', agency_price_list_lines.tenant_id, version.agency_organization_id)
));

create policy sales_scoped_read on public.sales for select to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_membership_has_permission('agency.sales.view', tenant_id, selling_organization_id)
);
create policy sale_lines_scoped_read on public.sale_lines for select to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_membership_has_permission('agency.sales.view', tenant_id, organization_id)
);

create policy customer_invoices_scoped_read on public.customer_invoices for select to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_membership_has_permission('agency.customer_finance.view', tenant_id, organization_id)
);
create policy customer_invoice_lines_scoped_read on public.customer_invoice_lines for select to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_membership_has_permission('agency.customer_finance.view', tenant_id, organization_id)
);
create policy customer_payments_scoped_read on public.customer_payments for select to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_membership_has_permission('agency.customer_finance.view', tenant_id, organization_id)
);
create policy customer_applications_scoped_read on public.customer_payment_applications for select to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_membership_has_permission('agency.customer_finance.view', tenant_id, organization_id)
);
create policy customer_application_reversals_scoped_read on public.customer_payment_application_reversals for select to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_membership_has_permission('agency.customer_finance.view', tenant_id, organization_id)
);
create policy customer_credits_scoped_read on public.customer_credit_notes for select to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_membership_has_permission('agency.customer_finance.view', tenant_id, organization_id)
);
create policy customer_reversals_scoped_read on public.customer_payment_reversals for select to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_membership_has_permission('agency.customer_finance.view', tenant_id, organization_id)
);

create or replace function public.finance_agency_account_visible(
  target_tenant uuid,
  target_matrix uuid,
  target_agency uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin()
    or (
      target_tenant = public.current_tenant_id()
      and (
        public.current_membership_has_permission('agency.account.view', target_tenant, target_matrix)
        or public.current_membership_has_permission('agency.account.view', target_tenant, target_agency)
      )
    );
$$;

create policy agency_charges_scoped_read on public.agency_charges for select to authenticated
using (public.finance_agency_account_visible(tenant_id, matrix_organization_id, agency_organization_id));
create policy agency_payments_scoped_read on public.agency_payments for select to authenticated
using (public.finance_agency_account_visible(tenant_id, matrix_organization_id, agency_organization_id));
create policy agency_applications_scoped_read on public.agency_payment_applications for select to authenticated
using (public.finance_agency_account_visible(tenant_id, matrix_organization_id, agency_organization_id));
create policy agency_application_reversals_scoped_read on public.agency_payment_application_reversals for select to authenticated
using (exists (
  select 1 from public.agency_payment_applications application
  where application.id = agency_payment_application_reversals.application_id
    and application.tenant_id = agency_payment_application_reversals.tenant_id
    and public.finance_agency_account_visible(application.tenant_id, application.matrix_organization_id, application.agency_organization_id)
));
create policy agency_credits_scoped_read on public.agency_credits for select to authenticated
using (public.finance_agency_account_visible(tenant_id, matrix_organization_id, agency_organization_id));
create policy agency_adjustments_scoped_read on public.agency_adjustments for select to authenticated
using (public.finance_agency_account_visible(tenant_id, matrix_organization_id, agency_organization_id));
create policy agency_reversals_scoped_read on public.agency_financial_reversals for select to authenticated
using (public.finance_agency_account_visible(tenant_id, matrix_organization_id, agency_organization_id));

create policy gl_accounts_scoped_read on public.gl_accounts for select to authenticated
using (tenant_id = public.current_tenant_id() and public.current_membership_has_permission('accounting.view', tenant_id, matrix_organization_id));
create policy accounting_periods_scoped_read on public.accounting_periods for select to authenticated
using (tenant_id = public.current_tenant_id() and public.current_membership_has_permission('accounting.view', tenant_id, matrix_organization_id));
create policy journal_entries_scoped_read on public.journal_entries for select to authenticated
using (tenant_id = public.current_tenant_id() and public.current_membership_has_permission('accounting.view', tenant_id, matrix_organization_id));
create policy journal_lines_scoped_read on public.journal_lines for select to authenticated
using (tenant_id = public.current_tenant_id() and public.current_membership_has_permission('accounting.view', tenant_id, matrix_organization_id));

create policy driver_cash_events_scoped_read on public.driver_cash_custody_events for select to authenticated
using (
  tenant_id = public.current_tenant_id()
  and (driver_membership_id = public.current_membership_id()
    or public.current_membership_has_permission('accounting.reconcile', tenant_id, matrix_organization_id))
);
create policy driver_settlements_scoped_read on public.driver_settlements for select to authenticated
using (
  tenant_id = public.current_tenant_id()
  and (driver_membership_id = public.current_membership_id()
    or public.current_membership_has_permission('accounting.reconcile', tenant_id, matrix_organization_id))
);
create policy driver_settlement_lines_scoped_read on public.driver_settlement_lines for select to authenticated
using (exists (
  select 1 from public.driver_settlements settlement
  where settlement.id = driver_settlement_lines.settlement_id
    and settlement.tenant_id = driver_settlement_lines.tenant_id
    and (settlement.driver_membership_id = public.current_membership_id()
      or public.current_membership_has_permission('accounting.reconcile', driver_settlement_lines.tenant_id, settlement.matrix_organization_id))
));
create policy driver_settlement_reversals_scoped_read on public.driver_settlement_reversals for select to authenticated
using (
  driver_settlement_reversals.tenant_id = public.current_tenant_id()
  and public.current_membership_has_permission(
    'accounting.reconcile',
    driver_settlement_reversals.tenant_id,
    driver_settlement_reversals.matrix_organization_id
  )
);

create policy financial_holds_scoped_read on public.financial_holds for select to authenticated
using (
  tenant_id = public.current_tenant_id()
  and (public.current_membership_has_permission('financial_hold.view', tenant_id, matrix_organization_id)
    or public.current_membership_has_permission('financial_hold.view', tenant_id, agency_organization_id))
);
create policy financial_hold_events_scoped_read on public.financial_hold_events for select to authenticated
using (exists (
  select 1 from public.financial_holds hold
  where hold.id = financial_hold_events.hold_id and hold.tenant_id = financial_hold_events.tenant_id
    and (public.current_membership_has_permission('financial_hold.view', financial_hold_events.tenant_id, hold.matrix_organization_id)
      or public.current_membership_has_permission('financial_hold.view', financial_hold_events.tenant_id, hold.agency_organization_id))
));
create policy financial_hold_requests_scoped_read on public.financial_hold_release_requests for select to authenticated
using (exists (
  select 1 from public.financial_holds hold
  where hold.id = financial_hold_release_requests.hold_id
    and hold.tenant_id = financial_hold_release_requests.tenant_id
    and public.current_membership_has_permission('financial_hold.view', financial_hold_release_requests.tenant_id, hold.matrix_organization_id)
));
create policy financial_hold_approvals_scoped_read on public.financial_hold_release_approvals for select to authenticated
using (exists (
  select 1 from public.financial_hold_release_requests request
  join public.financial_holds hold on hold.id = request.hold_id
  where request.id = financial_hold_release_approvals.request_id
    and request.tenant_id = financial_hold_release_approvals.tenant_id
    and public.current_membership_has_permission('financial_hold.view', financial_hold_release_approvals.tenant_id, hold.matrix_organization_id)
));
create policy financial_hold_policies_scoped_read on public.financial_hold_policies for select to authenticated
using (tenant_id = public.current_tenant_id());

revoke execute on function public.ensure_matrix_chart(uuid, uuid) from public;
revoke execute on function public.finance_next_journal_number(uuid) from public;
revoke execute on function public.finance_post_two_line_entry(uuid, uuid, text, uuid, text, text, text, bigint, uuid, uuid, uuid) from public;
revoke execute on function public.finance_begin_operation(uuid, text, text) from public;
revoke execute on function public.finance_complete_operation(uuid, jsonb) from public;
revoke execute on function public.finance_audit(uuid, uuid, text, text, uuid, jsonb, text, text) from public;
revoke execute on function public.finance_next_invoice_number(uuid) from public;
revoke execute on function public.finance_reverse_journal(text, uuid, uuid, text, uuid) from public;

revoke execute on function public.create_agency_sale(jsonb, text) from public;
revoke execute on function public.record_agency_payment(jsonb, text) from public;
revoke execute on function public.record_customer_payment(jsonb, text) from public;
revoke execute on function public.reconcile_driver_settlement(jsonb, text) from public;
revoke execute on function public.reverse_financial_event(jsonb, text) from public;
revoke execute on function public.authorize_international_release(jsonb, text) from public;
grant execute on function public.create_agency_sale(jsonb, text) to authenticated;
grant execute on function public.record_agency_payment(jsonb, text) to authenticated;
grant execute on function public.record_customer_payment(jsonb, text) to authenticated;
grant execute on function public.reconcile_driver_settlement(jsonb, text) to authenticated;
grant execute on function public.reverse_financial_event(jsonb, text) to authenticated;
grant execute on function public.authorize_international_release(jsonb, text) to authenticated;

comment on table public.sales is 'Venta comercial separada de la factura y de la operación logística.';
comment on table public.agency_charges is 'Cargo inmutable devengado por la matriz a una agencia; el estado se deriva en agency_charge_balances.';
comment on table public.journal_entries is 'Cabecera inmutable de asiento por devengado; toda corrección usa un asiento reverso enlazado.';
comment on table public.driver_cash_custody_events is 'Efectivo recibido por conductor. Cobros de agencia generan obligación, nunca ingreso de matriz.';
comment on table public.financial_holds is 'Retención vinculada exclusivamente a cargos internos de la misma operación.';
