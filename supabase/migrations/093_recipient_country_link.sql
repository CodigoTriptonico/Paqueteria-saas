-- A recipient belongs to one configured destination of the same organization.
-- Existing rows are preserved: exact country-name matches are linked now; the
-- NOT VALID check protects every new or edited recipient without deleting legacy data.

alter table public.customer_recipients
  add column if not exists country_id uuid references public.pricing_countries (id) on delete restrict;

update public.customer_recipients recipient
set country_id = country.id
from public.pricing_countries country
where recipient.organization_id = country.organization_id
  and recipient.country_id is null
  and lower(btrim(recipient.country)) = lower(btrim(country.name));

create index if not exists idx_customer_recipients_country_id
  on public.customer_recipients (country_id);

create or replace function public.assert_customer_recipient_country_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  configured_country_name text;
begin
  if new.country_id is null then
    raise exception 'RECIPIENT_COUNTRY_REQUIRED';
  end if;

  select country.name
  into configured_country_name
  from public.pricing_countries country
  where country.id = new.country_id
    and country.organization_id = new.organization_id;

  if configured_country_name is null then
    raise exception 'RECIPIENT_COUNTRY_NOT_CONFIGURED';
  end if;

  if lower(btrim(new.country)) <> lower(btrim(configured_country_name)) then
    raise exception 'RECIPIENT_COUNTRY_MISMATCH';
  end if;

  return new;
end;
$$;

drop trigger if exists customer_recipients_country_org_guard on public.customer_recipients;
create trigger customer_recipients_country_org_guard
before insert or update of organization_id, country_id, country on public.customer_recipients
for each row execute function public.assert_customer_recipient_country_org();

alter table public.customer_recipients
  drop constraint if exists customer_recipients_country_required;

alter table public.customer_recipients
  add constraint customer_recipients_country_required
  check (country_id is not null) not valid;
