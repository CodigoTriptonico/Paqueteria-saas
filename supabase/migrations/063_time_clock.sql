-- Time Clock: employee-only sessions, immutable punches, derived hours and admin alerts.

insert into public.permissions (key, name, description) values
  ('time_clock.view', 'Control de horario', 'Ver horas, historial y reportes'),
  ('time_clock.manage', 'Administrar horario', 'Gestionar empleados, reglas y alertas')
on conflict (key) do update
  set name = excluded.name,
      description = excluded.description;

insert into public.role_permissions (role_id, permission_id, granted)
select roles.id, permissions.id, true
from public.roles
join public.permissions on permissions.key in ('time_clock.view', 'time_clock.manage')
where roles.slug = 'administrador'
on conflict (role_id, permission_id) do update set granted = true;

create table if not exists public.time_clock_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  time_zone text not null default 'America/Los_Angeles',
  week_starts_on smallint not null default 0 check (week_starts_on between 0 and 6),
  daily_overtime_after_hours numeric(6, 2) not null default 8 check (daily_overtime_after_hours > 0),
  weekly_overtime_after_hours numeric(6, 2) not null default 40 check (weekly_overtime_after_hours > 0),
  max_daily_hours numeric(6, 2) not null default 12 check (max_daily_hours > 0),
  max_weekly_hours numeric(6, 2) not null default 48 check (max_weekly_hours > 0),
  overtime_alert_hours numeric(6, 2) not null default 12 check (overtime_alert_hours >= 0),
  pay_period_anchor_date date not null default current_date,
  pay_period_days smallint not null default 14 check (pay_period_days in (7, 14, 15, 30)),
  missing_clock_out_after_hours numeric(6, 2) not null default 16 check (missing_clock_out_after_hours > 0),
  incomplete_record_after_hours numeric(6, 2) not null default 4 check (incomplete_record_after_hours > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.time_clock_employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  employee_type text not null default 'clock' check (employee_type in ('clock', 'system')),
  employee_id text not null,
  employee_id_key text not null,
  full_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  unique (organization_id, employee_id_key)
);

create unique index if not exists idx_time_clock_employees_profile
  on public.time_clock_employees(profile_id)
  where profile_id is not null;

create index if not exists idx_time_clock_employees_org_active
  on public.time_clock_employees(organization_id, is_active, full_name);

-- El reloj no pide organización: Employee ID debe resolver una sola persona globalmente.
create unique index if not exists idx_time_clock_employees_global_employee_id
  on public.time_clock_employees(employee_id_key);

create table if not exists public.time_clock_sessions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.time_clock_employees(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_seen_at timestamptz not null default now()
);

create index if not exists idx_time_clock_sessions_active
  on public.time_clock_sessions(employee_id, expires_at)
  where revoked_at is null;

create table if not exists public.time_clock_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.time_clock_employees(id) on delete cascade,
  event_type text not null check (event_type in ('clock_in', 'clock_out', 'meal_start', 'meal_end')),
  occurred_at timestamptz not null default now(),
  source text not null default 'clock_user' check (source in ('clock_user', 'system')),
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_time_clock_events_employee_time
  on public.time_clock_events(employee_id, occurred_at, id);

create index if not exists idx_time_clock_events_org_time
  on public.time_clock_events(organization_id, occurred_at desc);

create or replace function public.reject_time_clock_event_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Las marcaciones de reloj son inmutables';
end;
$$;

drop trigger if exists time_clock_events_immutable on public.time_clock_events;
create trigger time_clock_events_immutable
before update or delete on public.time_clock_events
for each row execute function public.reject_time_clock_event_mutation();

create table if not exists public.time_clock_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.time_clock_employees(id) on delete cascade,
  alert_type text not null check (alert_type in (
    'daily_hours_exceeded', 'weekly_hours_exceeded', 'overtime_accumulated',
    'missing_clock_out', 'incomplete_record'
  )),
  dedupe_key text not null,
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  title text not null,
  description text not null,
  facts jsonb not null default '{}'::jsonb,
  raised_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  unique (organization_id, dedupe_key)
);

create index if not exists idx_time_clock_alerts_org_status
  on public.time_clock_alerts(organization_id, status, raised_at desc);

alter table public.time_clock_settings enable row level security;
alter table public.time_clock_employees enable row level security;
alter table public.time_clock_sessions enable row level security;
alter table public.time_clock_events enable row level security;
alter table public.time_clock_alerts enable row level security;

drop policy if exists time_clock_settings_select on public.time_clock_settings;
create policy time_clock_settings_select on public.time_clock_settings for select
  using (
    organization_id = public.current_organization_id()
    and public.user_has_permission('time_clock.view')
  );

drop policy if exists time_clock_settings_write on public.time_clock_settings;
create policy time_clock_settings_write on public.time_clock_settings for all
  using (
    organization_id = public.current_organization_id()
    and public.user_has_permission('time_clock.manage')
  )
  with check (
    organization_id = public.current_organization_id()
    and public.user_has_permission('time_clock.manage')
  );

drop policy if exists time_clock_employees_select on public.time_clock_employees;
create policy time_clock_employees_select on public.time_clock_employees for select
  using (
    organization_id = public.current_organization_id()
    and public.user_has_permission('time_clock.view')
  );

drop policy if exists time_clock_employees_write on public.time_clock_employees;
create policy time_clock_employees_write on public.time_clock_employees for all
  using (
    organization_id = public.current_organization_id()
    and public.user_has_permission('time_clock.manage')
  )
  with check (
    organization_id = public.current_organization_id()
    and public.user_has_permission('time_clock.manage')
  );

drop policy if exists time_clock_events_select on public.time_clock_events;
create policy time_clock_events_select on public.time_clock_events for select
  using (
    organization_id = public.current_organization_id()
    and public.user_has_permission('time_clock.view')
  );

drop policy if exists time_clock_alerts_select on public.time_clock_alerts;
create policy time_clock_alerts_select on public.time_clock_alerts for select
  using (
    organization_id = public.current_organization_id()
    and public.user_has_permission('time_clock.view')
  );

drop policy if exists time_clock_alerts_write on public.time_clock_alerts;
create policy time_clock_alerts_write on public.time_clock_alerts for all
  using (
    organization_id = public.current_organization_id()
    and public.user_has_permission('time_clock.manage')
  )
  with check (
    organization_id = public.current_organization_id()
    and public.user_has_permission('time_clock.manage')
  );
