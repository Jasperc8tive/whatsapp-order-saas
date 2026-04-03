-- ============================================================
--  Migration 019 — Analytics Trigger on Orders
-- ============================================================
--  Installs a PostgreSQL trigger on public.orders so that ANY
--  insert or update (regardless of whether it came through the
--  Next.js API or directly from the Supabase client) automatically
--  enqueues an analytics_queue job.
--
--  The job is processed by the Next.js worker (/api/jobs/worker)
--  which calls upsert_daily_metrics(vendor_id, date) — added
--  in migration 018 — to keep the daily_metrics table current.
--
--  Deduplication: if a queued/running analytics job for the same
--  vendor + date already exists, a new one is NOT inserted.
--  This prevents queue flooding on bulk-update scenarios.
--
--  Dependencies: 008_job_queue.sql (job_queue table + enqueue_job RPC)
--               018_scale_architecture.sql (daily_metrics + upsert_daily_metrics)
-- ============================================================


-- ── Trigger function ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trigger_analytics_refresh()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor_id  uuid;
  v_date       date;
BEGIN
  v_vendor_id := COALESCE(NEW.vendor_id, OLD.vendor_id);
  v_date      := COALESCE((NEW.created_at)::date, (OLD.created_at)::date, CURRENT_DATE);

  -- Skip cancelled orders — they don't contribute to revenue metrics
  IF TG_OP = 'UPDATE' AND NEW.order_status = 'cancelled' AND OLD.order_status = 'cancelled' THEN
    RETURN NULL;
  END IF;

  -- Deduplicate: only enqueue if no queued/running job exists for this vendor+date
  INSERT INTO public.job_queue (queue_name, payload, status, run_at, max_attempts)
  SELECT
    'analytics_queue',
    jsonb_build_object(
      'vendorId', v_vendor_id::text,
      'date',     v_date::text
    ),
    'queued',
    -- Small delay: batches rapid successive changes (e.g. bulk status updates)
    -- into a single worker invocation rather than refreshing on every row.
    now() + interval '2 minutes',
    3   -- analytics refresh is low-stakes; 3 attempts is plenty
  WHERE NOT EXISTS (
    SELECT 1
    FROM   public.job_queue
    WHERE  queue_name = 'analytics_queue'
      AND  status     IN ('queued', 'running')
      AND  payload->>'vendorId' = v_vendor_id::text
      AND  payload->>'date'     = v_date::text
  );

  RETURN NULL;  -- AFTER trigger; return value is ignored
END;
$$;

COMMENT ON FUNCTION public.trigger_analytics_refresh() IS
  'AFTER INSERT/UPDATE trigger on orders. Deduplicates and enqueues an '
  'analytics_queue job to refresh daily_metrics for the affected vendor+date. '
  'SECURITY DEFINER ensures the insert into job_queue always succeeds regardless '
  'of RLS policies on the caller.';


-- ── Attach trigger ────────────────────────────────────────────────────────────

-- Drop if it already exists (idempotent re-runs)
DROP TRIGGER IF EXISTS trg_orders_analytics_refresh ON public.orders;

CREATE TRIGGER trg_orders_analytics_refresh
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_analytics_refresh();
