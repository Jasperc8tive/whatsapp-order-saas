-- 008_job_queue.sql
-- Durable job queue for async processing: AI parsing, outbound notifications, retries.
-- This replaces any direct synchronous processing in webhook routes.

create table if not exists public.job_queue (
  id           uuid primary key default gen_random_uuid(),
  queue_name   text not null,
  payload      jsonb not null default '{}',
  status       text not null default 'queued'
               check (status in ('queued','running','done','failed','dead')),
  attempts     int not null default 0,
  max_attempts int not null default 8,
  run_at       timestamptz not null default now(),
  last_error   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists job_queue_status_run_at_idx on public.job_queue(status, run_at)
  where status in ('queued', 'failed');

create index if not exists job_queue_queue_name_idx on public.job_queue(queue_name, status);

-- ─── Helper: enqueue a job ────────────────────────────────────────────────────
create or replace function public.enqueue_job(
  p_queue_name   text,
  p_payload      jsonb,
  p_run_at       timestamptz default now(),
  p_max_attempts int         default 8
) returns uuid language plpgsql security definer as $$
declare
  v_id uuid;
begin
  insert into public.job_queue (queue_name, payload, run_at, max_attempts)
  values (p_queue_name, p_payload, p_run_at, p_max_attempts)
  returning id into v_id;
  return v_id;
end;
$$;

-- ─── Helper: claim next job (atomic, for worker polling) ──────────────────────
create or replace function public.claim_next_job(p_queue_name text)
returns setof public.job_queue language plpgsql security definer as $$
begin
  return query
  update public.job_queue
  set
    status       = 'running',
    attempts     = attempts + 1,
    updated_at   = now()
  where id = (
    select id from public.job_queue
    where queue_name = p_queue_name
      and status     in ('queued', 'failed')
      and run_at     <= now()
      and attempts   < max_attempts
    order by run_at asc
    limit 1
    for update skip locked
  )
  returning *;
end;
$$;

-- ─── Helper: mark job done ────────────────────────────────────────────────────
create or replace function public.complete_job(p_job_id uuid)
returns void language sql security definer as $$
  update public.job_queue
  set status = 'done', updated_at = now()
  where id = p_job_id;
$$;

-- ─── Helper: mark job failed with exponential backoff ─────────────────────────
create or replace function public.fail_job(p_job_id uuid, p_error text)
returns void language plpgsql security definer as $$
declare
  v_attempts int;
  v_max_attempts int;
  v_backoff interval;
begin
  select attempts, max_attempts into v_attempts, v_max_attempts
  from public.job_queue where id = p_job_id;

  -- Exponential backoff: 30s, 2m, 10m, 30m, 2h, 6h, 24h, 48h
  v_backoff := case v_attempts
    when 1 then interval '30 seconds'
    when 2 then interval '2 minutes'
    when 3 then interval '10 minutes'
    when 4 then interval '30 minutes'
    when 5 then interval '2 hours'
    when 6 then interval '6 hours'
    when 7 then interval '24 hours'
    else       interval '48 hours'
  end;

  update public.job_queue
  set
    status     = case when v_attempts >= v_max_attempts then 'dead' else 'failed' end,
    last_error = p_error,
    run_at     = now() + v_backoff,
    updated_at = now()
  where id = p_job_id;
end;
$$;

-- No RLS on job_queue — service role only (webhook routes use createAdminClient)
