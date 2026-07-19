-- Human names use one canonical format across sales, users and time clock.
-- Emails, organization names and addresses intentionally keep their own casing.

create or replace function public.normalize_person_name(value text)
returns text
language sql
immutable
parallel safe
set search_path = public
as $$
  select case
    when value is null then null
    else upper(regexp_replace(btrim(value), '[[:space:]]+', ' ', 'g'))
  end
$$;

create or replace function public.normalize_person_name_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_table_name = 'customers' or tg_table_name = 'customer_recipients' then
    new.first_name := public.normalize_person_name(new.first_name);
    new.last_name := public.normalize_person_name(new.last_name);
  elsif tg_table_name = 'profiles' or tg_table_name = 'time_clock_employees' then
    new.full_name := public.normalize_person_name(new.full_name);
  elsif tg_table_name = 'shipments' then
    new.customer_name := public.normalize_person_name(new.customer_name);
    if jsonb_typeof(new.recipient_snapshot) = 'object' then
      if new.recipient_snapshot ? 'firstName' then
        new.recipient_snapshot := jsonb_set(
          new.recipient_snapshot,
          '{firstName}',
          coalesce(to_jsonb(public.normalize_person_name(new.recipient_snapshot->>'firstName')), 'null'::jsonb),
          true
        );
      end if;
      if new.recipient_snapshot ? 'lastName' then
        new.recipient_snapshot := jsonb_set(
          new.recipient_snapshot,
          '{lastName}',
          coalesce(to_jsonb(public.normalize_person_name(new.recipient_snapshot->>'lastName')), 'null'::jsonb),
          true
        );
      end if;
      if new.recipient_snapshot ? 'name' then
        new.recipient_snapshot := jsonb_set(
          new.recipient_snapshot,
          '{name}',
          coalesce(to_jsonb(public.normalize_person_name(new.recipient_snapshot->>'name')), 'null'::jsonb),
          true
        );
      end if;
    end if;
  elsif tg_table_name = 'sales' then
    new.customer_name_snapshot := public.normalize_person_name(new.customer_name_snapshot);
  end if;
  return new;
end;
$$;

drop trigger if exists normalize_customer_names on public.customers;
create trigger normalize_customer_names
  before insert or update on public.customers
  for each row execute function public.normalize_person_name_fields();

drop trigger if exists normalize_recipient_names on public.customer_recipients;
create trigger normalize_recipient_names
  before insert or update on public.customer_recipients
  for each row execute function public.normalize_person_name_fields();

drop trigger if exists normalize_profile_names on public.profiles;
create trigger normalize_profile_names
  before insert or update on public.profiles
  for each row execute function public.normalize_person_name_fields();

drop trigger if exists normalize_time_clock_employee_names on public.time_clock_employees;
create trigger normalize_time_clock_employee_names
  before insert or update on public.time_clock_employees
  for each row execute function public.normalize_person_name_fields();

drop trigger if exists normalize_shipment_person_names on public.shipments;
create trigger normalize_shipment_person_names
  before insert or update on public.shipments
  for each row execute function public.normalize_person_name_fields();

drop trigger if exists normalize_sale_person_names on public.sales;
create trigger normalize_sale_person_names
  before insert or update on public.sales
  for each row execute function public.normalize_person_name_fields();

update public.customers
set first_name = public.normalize_person_name(first_name),
    last_name = public.normalize_person_name(last_name)
where first_name is distinct from public.normalize_person_name(first_name)
   or last_name is distinct from public.normalize_person_name(last_name);

update public.customer_recipients
set first_name = public.normalize_person_name(first_name),
    last_name = public.normalize_person_name(last_name)
where first_name is distinct from public.normalize_person_name(first_name)
   or last_name is distinct from public.normalize_person_name(last_name);

update public.profiles
set full_name = public.normalize_person_name(full_name)
where full_name is distinct from public.normalize_person_name(full_name);

update public.time_clock_employees
set full_name = public.normalize_person_name(full_name)
where full_name is distinct from public.normalize_person_name(full_name);
