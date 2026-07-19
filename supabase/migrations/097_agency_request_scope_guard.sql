create or replace function public.assert_agency_request_line_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  request_scope_value text;
begin
  select request_scope into request_scope_value
  from public.agency_service_requests
  where id = new.request_id;

  if request_scope_value = 'agency_customer'
     and new.service_code not in ('customer_home_delivery', 'customer_empty_box_delivery', 'customer_full_box_pickup') then
    raise exception 'REQUEST_SCOPE_MIXED';
  end if;

  if request_scope_value = 'agency_office'
     and new.service_code not in ('agency_office_empty_box_delivery', 'agency_office_full_box_pickup') then
    raise exception 'REQUEST_SCOPE_MIXED';
  end if;

  return new;
end;
$$;

drop trigger if exists agency_request_line_scope_guard on public.agency_service_request_lines;
create trigger agency_request_line_scope_guard
before insert or update of request_id, service_code
on public.agency_service_request_lines
for each row execute function public.assert_agency_request_line_scope();

comment on function public.assert_agency_request_line_scope() is
  'Prevents one request from mixing an agency office stop with an agency customer stop, regardless of line order or caller.';
