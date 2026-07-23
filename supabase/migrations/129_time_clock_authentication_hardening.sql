-- Tenant-scoped, second-factor authentication and auditable lockout for Time Clock.

drop index if exists public.idx_time_clock_employees_global_employee_id;

alter table public.time_clock_employees
  add column if not exists pin_hash text,
  add column if not exists failed_pin_attempts integer not null default 0
    check (failed_pin_attempts between 0 and 1000),
  add column if not exists pin_locked_until timestamptz,
  add column if not exists last_failed_pin_at timestamptz;

create table if not exists public.time_clock_auth_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid references public.time_clock_employees(id) on delete set null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  outcome text not null check (outcome in (
    'success', 'invalid_credentials', 'locked', 'rate_limited'
  )),
  lookup_hash text not null,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_time_clock_auth_events_org_created
  on public.time_clock_auth_events (organization_id, created_at desc);

alter table public.time_clock_auth_events enable row level security;
revoke all on table public.time_clock_auth_events from public, anon, authenticated;
revoke all on sequence public.time_clock_auth_events_id_seq from public, anon, authenticated;
grant all on table public.time_clock_auth_events to service_role;
grant all on sequence public.time_clock_auth_events_id_seq to service_role;

create or replace function public.reject_time_clock_auth_event_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Los intentos de autenticacion del reloj son inmutables';
end;
$$;

drop trigger if exists time_clock_auth_events_immutable on public.time_clock_auth_events;
create trigger time_clock_auth_events_immutable
before update or delete on public.time_clock_auth_events
for each row execute function public.reject_time_clock_auth_event_mutation();

revoke execute on function public.reject_time_clock_auth_event_mutation()
  from public, anon, authenticated;
grant execute on function public.reject_time_clock_auth_event_mutation()
  to service_role;

-- Existing employees remain unable to sign in until a manager assigns a PIN.
comment on column public.time_clock_employees.pin_hash is
  'Scrypt hash only. Null is a fail-closed legacy employee pending PIN enrollment.';
