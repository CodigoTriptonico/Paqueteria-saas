create table if not exists public.app_schema_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);

alter table public.app_schema_migrations enable row level security;
