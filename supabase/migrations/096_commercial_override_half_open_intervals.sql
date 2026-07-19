-- Commercial override validity uses half-open intervals: [valid_from, valid_until).
-- PostgreSQL now() is stable for the whole transaction. Allowing both bounds to
-- be equal makes save -> restore and save -> replace safe when they occur in one
-- transaction. The active unique index still permits only one open override.

alter table public.commercial_pricing_overrides
  drop constraint if exists commercial_pricing_overrides_check;

alter table public.commercial_pricing_overrides
  add constraint commercial_pricing_overrides_validity_check
  check (valid_until is null or valid_until >= valid_from);

comment on constraint commercial_pricing_overrides_validity_check
  on public.commercial_pricing_overrides is
  'Half-open interval [valid_from, valid_until). Equal bounds represent an override superseded within the same transaction.';
