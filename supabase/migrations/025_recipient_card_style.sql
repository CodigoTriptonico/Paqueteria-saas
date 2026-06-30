-- Estilo visual de tarjeta por destinatario (venta).

alter table public.customer_recipients
  add column if not exists card_style text not null default 'amber-warm';

alter table public.customer_recipients
  drop constraint if exists customer_recipients_card_style_check;

alter table public.customer_recipients
  add constraint customer_recipients_card_style_check
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
