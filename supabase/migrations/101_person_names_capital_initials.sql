-- Correct the person-name format to capital initials, not all capitals.
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
    else initcap(lower(regexp_replace(btrim(value), '[[:space:]]+', ' ', 'g')))
  end
$$;

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
