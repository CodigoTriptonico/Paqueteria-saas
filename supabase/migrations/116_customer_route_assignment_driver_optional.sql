-- Sellers propose day+route without choosing a driver; logistics owns drivers.
alter table public.customer_route_assignment_requests
  alter column driver_id drop not null;
