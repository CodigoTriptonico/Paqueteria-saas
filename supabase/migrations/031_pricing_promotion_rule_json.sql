-- Reglas flexibles de combos (JSON)

alter table public.pricing_promotions
  add column if not exists rule_json jsonb;

alter table public.pricing_promotions
  drop constraint if exists pricing_promotions_promotion_type_check;

alter table public.pricing_promotions
  add constraint pricing_promotions_promotion_type_check
  check (promotion_type in ('bundle_price', 'extra_discount', 'combo'));
