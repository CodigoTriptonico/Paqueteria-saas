alter table public.commercial_pricing_overrides
  drop constraint if exists commercial_pricing_overrides_minimum_lte_amount_check;

alter table public.commercial_pricing_overrides
  add constraint commercial_pricing_overrides_minimum_lte_amount_check
  check (minimum_amount_cents is null or minimum_amount_cents <= amount_cents)
  not valid;

comment on constraint commercial_pricing_overrides_minimum_lte_amount_check
  on public.commercial_pricing_overrides is
  'New overrides cannot set a seller minimum above the configured public price. NOT VALID preserves any ambiguous historical row for review.';
