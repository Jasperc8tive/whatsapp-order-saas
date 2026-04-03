-- ============================================================
--  Migration 018 — Scale Architecture for 100,000+ Vendors
-- ============================================================
--  What this adds:
--   1. orders.source column   — whatsapp | store_link | manual | ai_parsed
--   2. subscriptions table    — Paystack recurring billing records
--   3. daily_metrics table    — pre-aggregated analytics for fast dashboards
--   4. marketplace_listings   — vendor discovery by category / city
--   5. Composite indexes      — critical missing query-path indexes
--   6. upsert_daily_metrics() — server-side analytics refresh function
--   7. Realtime publications  — enables live UI with supabase-js .on()
--
--  Dependencies: schema.sql, 005_team_rbac.sql, 006_rbac_policies.sql
--  (set_updated_at, my_vendor_id, my_workspace_id all assumed present)
-- ============================================================


-- ── 1. orders.source ─────────────────────────────────────────────────────────
-- Tracks how each order originated so you can analyse
-- whatsapp vs. storefront vs. manual entry vs. AI-parsed

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('whatsapp', 'store_link', 'manual', 'ai_parsed'));

COMMENT ON COLUMN public.orders.source IS
  'Origin channel of the order: whatsapp | store_link | manual | ai_parsed';

-- Composite: vendor dashboard queries almost always filter by vendor + source
CREATE INDEX IF NOT EXISTS orders_vendor_source_idx
  ON public.orders(vendor_id, source);


-- ── 2. subscriptions ─────────────────────────────────────────────────────────
-- Stores Paystack subscription records per vendor.
-- The users.plan column remains the authoritative plan tier at query time;
-- this table is the billing audit trail and renewal tracker.

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id                  uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan                       text        NOT NULL
                               CHECK (plan IN ('starter', 'growth', 'pro')),
  status                     text        NOT NULL DEFAULT 'active'
                               CHECK (status IN ('active', 'cancelled', 'past_due', 'trialing', 'paused')),
  paystack_subscription_code text        UNIQUE,   -- e.g. SUB_xxxx from Paystack
  paystack_customer_code     text,                 -- CUS_xxxx from Paystack
  current_period_start       timestamptz NOT NULL DEFAULT now(),
  current_period_end         timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  cancel_at_period_end       boolean     NOT NULL DEFAULT false,
  cancelled_at               timestamptz,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.subscriptions IS
  'Billing subscription records. One active row per vendor. Synced via Paystack webhooks.';

-- Lookup by vendor (e.g. "what is my current plan?")
CREATE INDEX IF NOT EXISTS subscriptions_vendor_id_idx
  ON public.subscriptions(vendor_id);

-- Cron job: find subscriptions expiring in the next N days
CREATE INDEX IF NOT EXISTS subscriptions_status_period_idx
  ON public.subscriptions(status, current_period_end)
  WHERE status IN ('active', 'trialing');

CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Vendor and their team can read the subscription
CREATE POLICY "subscriptions: workspace read" ON public.subscriptions
  FOR SELECT USING (vendor_id = public.my_workspace_id());

-- Only the account owner (not team members) should insert/update billing records.
-- Service-role (Paystack webhook handler) bypasses RLS entirely.
CREATE POLICY "subscriptions: owner insert" ON public.subscriptions
  FOR INSERT WITH CHECK (vendor_id = auth.uid());

CREATE POLICY "subscriptions: owner update" ON public.subscriptions
  FOR UPDATE USING  (vendor_id = auth.uid())
  WITH CHECK        (vendor_id = auth.uid());


-- ── 3. daily_metrics ─────────────────────────────────────────────────────────
-- One row per (vendor, date). Pre-aggregated so dashboard queries never do
-- full table scans on orders.  Refreshed server-side by upsert_daily_metrics().

CREATE TABLE IF NOT EXISTS public.daily_metrics (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id     uuid          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date          date          NOT NULL,
  orders_count  integer       NOT NULL DEFAULT 0 CHECK (orders_count  >= 0),
  revenue       numeric(14,2) NOT NULL DEFAULT 0  CHECK (revenue       >= 0),
  new_customers integer       NOT NULL DEFAULT 0  CHECK (new_customers >= 0),
  created_at    timestamptz   NOT NULL DEFAULT now(),
  updated_at    timestamptz   NOT NULL DEFAULT now(),

  -- UNIQUE also creates the primary composite index for all lookups
  UNIQUE (vendor_id, date)
);

COMMENT ON TABLE public.daily_metrics IS
  'Pre-aggregated daily KPIs per vendor. Refreshed by upsert_daily_metrics(). '
  'Never write to this table directly from the app — use the refresh function.';

CREATE TRIGGER trg_daily_metrics_updated_at
  BEFORE UPDATE ON public.daily_metrics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.daily_metrics ENABLE ROW LEVEL SECURITY;

-- All workspace members (owner + staff) can read metrics; no direct writes
CREATE POLICY "daily_metrics: workspace read" ON public.daily_metrics
  FOR SELECT USING (vendor_id = public.my_workspace_id());


-- ── 4. marketplace_listings ───────────────────────────────────────────────────
-- Public vendor discovery page: browse by category and city.
-- One listing per vendor (UNIQUE on vendor_id).
-- Anonymous users can read active listings without authentication.

CREATE TABLE IF NOT EXISTS public.marketplace_listings (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),

  -- One listing per vendor — UNIQUE creates the implicit lookup index
  vendor_id    uuid         NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,

  category     text         NOT NULL,
  city         text         NOT NULL,
  description  text,
  tags         text[]       NOT NULL DEFAULT '{}',  -- e.g. {'food','fashion','electronics'}
  rating       numeric(3,2) NOT NULL DEFAULT 0
                 CHECK (rating >= 0 AND rating <= 5),
  review_count integer      NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  is_active    boolean      NOT NULL DEFAULT true,
  is_verified  boolean      NOT NULL DEFAULT false,  -- set by platform admins
  created_at   timestamptz  NOT NULL DEFAULT now(),
  updated_at   timestamptz  NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.marketplace_listings IS
  'Public vendor discovery. One row per vendor. Anonymous reads allowed on active rows.';

-- Primary browse queries: "show food vendors in Lagos sorted by rating"
CREATE INDEX IF NOT EXISTS marketplace_category_city_idx
  ON public.marketplace_listings(category, city)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS marketplace_rating_idx
  ON public.marketplace_listings(rating DESC)
  WHERE is_active = true;

-- Array-containment tag queries: tags @> ARRAY['food','delivery']
CREATE INDEX IF NOT EXISTS marketplace_tags_gin_idx
  ON public.marketplace_listings USING GIN(tags);

CREATE TRIGGER trg_marketplace_listings_updated_at
  BEFORE UPDATE ON public.marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;

-- Anonymous / public: read active listings (no login required)
CREATE POLICY "marketplace_listings: public read" ON public.marketplace_listings
  FOR SELECT USING (is_active = true);

-- Workspace members can manage their workspace's listing
-- (Multiple SELECT policies are OR'd — vendor sees their own even if is_active = false)
CREATE POLICY "marketplace_listings: workspace manage" ON public.marketplace_listings
  FOR ALL USING    (vendor_id = public.my_workspace_id())
  WITH CHECK       (vendor_id = public.my_workspace_id());


-- ── 5. Additional composite indexes ──────────────────────────────────────────
-- Complements existing indexes in schema.sql for the remaining hot query paths.
-- schema.sql already has: orders_vendor_status_idx(vendor_id, order_status)
--                         customers_phone_idx(phone)
--   and the unique constraint on customers(vendor_id, phone) as implicit index.

-- "Unpaid orders for this vendor" — billing/chasing dashboard
CREATE INDEX IF NOT EXISTS orders_vendor_payment_idx
  ON public.orders(vendor_id, payment_status);

-- "Recent orders for this vendor" — dashboard timeline / analytics
CREATE INDEX IF NOT EXISTS orders_vendor_created_idx
  ON public.orders(vendor_id, created_at DESC);

-- "Newest customers for this vendor" — CRM customer list, paginated
CREATE INDEX IF NOT EXISTS customers_vendor_created_idx
  ON public.customers(vendor_id, created_at DESC);

-- "Search active products by name within a vendor" — storefront autocomplete
-- (vendor_id + name for prefix scans when using LIKE 'term%')
CREATE INDEX IF NOT EXISTS products_vendor_active_name_idx
  ON public.products(vendor_id, name)
  WHERE is_active = true;


-- ── 6. upsert_daily_metrics() ────────────────────────────────────────────────
-- Recomputes one vendor's metrics for one date from raw order data.
-- SECURITY DEFINER so it runs with the function owner's privileges,
-- bypassing RLS on orders/customers (needed when called from a cron job
-- that is not authenticated as the vendor).
--
-- Typical call from a nightly Edge Function:
--   SELECT public.upsert_daily_metrics(id)
--   FROM   public.users;
--
-- Or per-vendor on demand after an order is placed:
--   SELECT public.upsert_daily_metrics('<vendor_id>', current_date);

CREATE OR REPLACE FUNCTION public.upsert_daily_metrics(
  p_vendor_id uuid,
  p_date      date DEFAULT current_date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.daily_metrics (
    vendor_id, date, orders_count, revenue, new_customers
  )
  SELECT
    p_vendor_id,
    p_date,
    COUNT(o.id)::integer                                        AS orders_count,
    COALESCE(SUM(o.total_amount), 0)                            AS revenue,
    COUNT(DISTINCT CASE
      WHEN c.created_at::date = p_date THEN o.customer_id
    END)::integer                                               AS new_customers
  FROM   public.orders    o
  LEFT   JOIN public.customers c ON o.customer_id = c.id
  WHERE  o.vendor_id        = p_vendor_id
    AND  o.created_at::date = p_date
    AND  o.order_status    != 'cancelled'
  ON CONFLICT (vendor_id, date) DO UPDATE SET
    orders_count  = EXCLUDED.orders_count,
    revenue       = EXCLUDED.revenue,
    new_customers = EXCLUDED.new_customers,
    updated_at    = now();
END;
$$;

COMMENT ON FUNCTION public.upsert_daily_metrics(uuid, date) IS
  'Recomputes daily KPIs for a vendor on a given date. '
  'SECURITY DEFINER — safe to call from Edge Functions / pg_cron without vendor auth. '
  'Nightly cron example: SELECT public.upsert_daily_metrics(id) FROM public.users;';

-- ── Optional pg_cron job (uncomment after enabling pg_cron extension) ─────────
-- SELECT cron.schedule(
--   'nightly-daily-metrics',
--   '5 0 * * *',   -- 00:05 UTC every night
--   $job$
--     SELECT public.upsert_daily_metrics(id, current_date - 1)
--     FROM   public.users;
--   $job$
-- );


-- ── 7. Supabase Realtime publications ────────────────────────────────────────
-- Enables realtime subscriptions in the browser/mobile client:
--   supabase.channel('orders').on('postgres_changes', ...).subscribe()
--
-- Idempotent: only ALTERs the publication when the table is not yet listed.

DO $$
DECLARE
  v_tables text[] := ARRAY[
    'orders',
    'customers',
    'deliveries',
    'order_drafts',
    'daily_metrics'
  ];
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    -- Guard: table must exist (some may not be present in all environments)
    IF to_regclass('public.' || v_table) IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname    = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename  = v_table
      )
    THEN
      EXECUTE format(
        'ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',
        v_table
      );
    END IF;
  END LOOP;
END;
$$;
