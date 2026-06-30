-- Estilo visual de tarjeta por remitente (venta).

alter table public.customers
  add column if not exists card_style text not null default 'amber-warm';

alter table public.customers
  drop constraint if exists customers_card_style_check;

alter table public.customers
  add constraint customers_card_style_check
  check (
    card_style in (
      'emerald-classic',
      'slate-cold',
      'amber-warm',
      'forest-deep',
      'teal-mist',
      'rose-ops',
      'side-bar',
      'flat-minimal',
      'high-contrast',
      'violet-dusk'
    )
  );
