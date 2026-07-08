-- Fix: ON CONFLICT (window_start) was ambiguous with the PL/pgSQL variable of the same name.

create or replace function public.consume_rate_limit(
  p_bucket text,
  p_key text,
  p_window_seconds int,
  p_max_attempts int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  current_count int;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Forbidden';
  end if;

  if p_bucket is null or btrim(p_bucket) = ''
     or p_key is null or btrim(p_key) = ''
     or p_window_seconds is null or p_window_seconds <= 0
     or p_max_attempts is null or p_max_attempts <= 0 then
    raise exception 'Parametros de rate limit invalidos';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.security_rate_limits (bucket, key, window_start, attempt_count)
  values (p_bucket, p_key, v_window_start, 1)
  on conflict (bucket, key, window_start)
  do update set attempt_count = public.security_rate_limits.attempt_count + 1
  returning attempt_count into current_count;

  return current_count <= p_max_attempts;
end;
$$;
