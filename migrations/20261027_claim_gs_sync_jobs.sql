-- Claim Google Sheets outbox records atomically.  This prevents concurrent
-- serverless invocations from sending the same queue job twice.
alter table public.gs_sync_queue
    add column if not exists locked_at timestamptz;

create or replace function public.claim_gs_sync_jobs(p_limit integer default 10)
returns setof public.gs_sync_queue
language plpgsql
security definer
set search_path = public
as $$
begin
    return query
    with candidates as (
        select id
        from public.gs_sync_queue
        where status = 'pending'
           or (status = 'processing' and locked_at < now() - interval '15 minutes')
        order by created_at asc
        for update skip locked
        limit greatest(1, least(coalesce(p_limit, 10), 100))
    )
    update public.gs_sync_queue as queue
    set status = 'processing', locked_at = now()
    from candidates
    where queue.id = candidates.id
    returning queue.*;
end;
$$;

grant execute on function public.claim_gs_sync_jobs(integer) to anon, authenticated, service_role;
