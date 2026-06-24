-- Returns companions that are due for a proactive check-in: opted in, and
-- either never contacted proactively or older than their cadence.
-- Called by the cron route using the service-role key.
create or replace function public.due_proactive_companions()
returns setof public.companions
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.companions
  where proactive_enabled
    and (
      last_proactive_at is null
      or now() - last_proactive_at > proactive_cadence
    );
$$;
