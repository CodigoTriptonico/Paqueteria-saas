-- Celulares adicionales del perfil (recuperación por SMS en cualquiera de ellos)

create table if not exists public.profile_phones (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  phone text not null default '',
  phone_digits text not null default '',
  phone_verified_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists profile_phones_digits_uidx
  on public.profile_phones (phone_digits)
  where phone_digits <> '';

create index if not exists profile_phones_profile_id_idx
  on public.profile_phones (profile_id);

alter table public.profile_phones enable row level security;

create policy profile_phones_select on public.profile_phones
  for select
  using (
    profile_id = auth.uid()
    or public.is_platform_admin()
  );

create policy profile_phones_service on public.profile_phones
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
