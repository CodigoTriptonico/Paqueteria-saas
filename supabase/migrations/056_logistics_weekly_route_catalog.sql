-- Reusable route names are organized by the delivery weekdays enabled for an organization.

create table if not exists public.logistics_route_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  name text not null check (char_length(btrim(name)) > 0),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists logistics_route_templates_org_weekday_idx
  on public.logistics_route_templates (organization_id, weekday, created_at);

create unique index if not exists logistics_route_templates_org_weekday_name_uidx
  on public.logistics_route_templates (organization_id, weekday, lower(btrim(name)));

alter table public.logistics_route_templates enable row level security;

drop policy if exists logistics_route_templates_select on public.logistics_route_templates;
create policy logistics_route_templates_select on public.logistics_route_templates for select
  using (
    organization_id = public.current_organization_id()
    and public.user_has_permission('routes.view')
  );

drop policy if exists logistics_route_templates_write on public.logistics_route_templates;
create policy logistics_route_templates_write on public.logistics_route_templates for all
  using (
    organization_id = public.current_organization_id()
    and (public.user_has_permission('routes.update_status') or public.user_has_permission('sales.manage'))
  )
  with check (
    organization_id = public.current_organization_id()
    and (public.user_has_permission('routes.update_status') or public.user_has_permission('sales.manage'))
  );

create or replace function public.list_logistics_route_weekdays(target_org_id uuid)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  configured_days text[];
begin
  if target_org_id is null then
    raise exception 'Organizacion invalida';
  end if;

  if target_org_id is distinct from public.current_organization_id()
     and auth.role() <> 'service_role' then
    raise exception 'Forbidden';
  end if;

  if auth.role() <> 'service_role' and not public.user_has_permission('routes.view') then
    raise exception 'Forbidden';
  end if;

  select array_agg(day order by array_position(array['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'], day))
  into configured_days
  from public.organization_route_settings settings
  cross join lateral (
    select distinct day
    from unnest(coalesce(settings.delivery_days, '{}'::text[]) || coalesce(settings.pickup_days, '{}'::text[])) as day
    where day = any(array['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'])
  ) normalized
  where settings.organization_id = target_org_id;

  return coalesce(configured_days, '{}'::text[]);
end;
$$;

create or replace function public.set_logistics_route_weekday_enabled(
  target_org_id uuid,
  target_day text,
  target_enabled boolean
)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_days text[];
begin
  if target_org_id is null or target_day not in ('Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom') then
    raise exception 'Dia de ruta invalido';
  end if;

  if target_org_id is distinct from public.current_organization_id()
     and auth.role() <> 'service_role' then
    raise exception 'Forbidden';
  end if;

  if auth.role() <> 'service_role'
     and not (public.user_has_permission('routes.update_status') or public.user_has_permission('sales.manage')) then
    raise exception 'Forbidden';
  end if;

  select array_agg(day order by array_position(array['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'], day))
  into normalized_days
  from (
    select distinct day
    from unnest(
      coalesce((select delivery_days from public.organization_route_settings where organization_id = target_org_id), '{}'::text[])
      || coalesce((select pickup_days from public.organization_route_settings where organization_id = target_org_id), '{}'::text[])
    ) as day
    where day = any(array['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'])
      and (target_enabled or day <> target_day)
    union
    select target_day where target_enabled
  ) normalized;

  normalized_days := coalesce(normalized_days, '{}'::text[]);

  insert into public.organization_route_settings (
    organization_id, delivery_days, pickup_days, linked_route_schedules, updated_at
  ) values (
    target_org_id, normalized_days, normalized_days, true, now()
  )
  on conflict (organization_id) do update set
    delivery_days = excluded.delivery_days,
    pickup_days = excluded.pickup_days,
    linked_route_schedules = true,
    updated_at = now();

  return normalized_days;
end;
$$;
