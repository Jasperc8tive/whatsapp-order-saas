-- 009_automation_engine.sql
-- Rule-driven automation engine for order/payment/delivery lifecycle events.

DO $$ BEGIN
  CREATE TYPE public.automation_trigger AS ENUM (
    'order_created',
    'order_status_changed',
    'payment_pending',
    'payment_confirmed',
    'delivery_status_changed',
    'no_customer_response'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.automation_rules (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.users(id) on delete cascade,
  name             text not null,
  trigger          public.automation_trigger not null,
  conditions       jsonb not null default '{}',
  actions          jsonb not null default '[]',
  is_active        boolean not null default true,
  cooldown_seconds int not null default 0,
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS public.automation_runs (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.users(id) on delete cascade,
  rule_id      uuid references public.automation_rules(id) on delete set null,
  entity_type  text not null,
  entity_id    uuid,
  status       text not null check (status in ('queued','running','succeeded','failed','skipped')),
  error        text,
  meta         jsonb not null default '{}',
  created_at   timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS automation_rules_workspace_trigger_idx
  ON public.automation_rules(workspace_id, trigger);

CREATE INDEX IF NOT EXISTS automation_runs_workspace_created_idx
  ON public.automation_runs(workspace_id, created_at desc);

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "automation_rules: workspace read" ON public.automation_rules;
CREATE POLICY "automation_rules: workspace read" ON public.automation_rules
  FOR SELECT USING (workspace_id = public.my_workspace_id());

DROP POLICY IF EXISTS "automation_rules: owner write" ON public.automation_rules;
CREATE POLICY "automation_rules: owner write" ON public.automation_rules
  FOR ALL USING (
    workspace_id = public.my_workspace_id()
    AND public.my_workspace_role() = 'owner'
  ) WITH CHECK (workspace_id = public.my_workspace_id());

DROP POLICY IF EXISTS "automation_runs: workspace read" ON public.automation_runs;
CREATE POLICY "automation_runs: workspace read" ON public.automation_runs
  FOR SELECT USING (workspace_id = public.my_workspace_id());

-- Seed basic defaults for existing workspaces (idempotent per name + trigger)
INSERT INTO public.automation_rules (workspace_id, name, trigger, conditions, actions, cooldown_seconds)
SELECT
  u.id,
  'Order Received Confirmation',
  'order_created',
  '{}'::jsonb,
  '[{"type":"send_whatsapp_text","to":"customer","message":"Thanks for your order! Ref: {{order_ref}}. We are processing it now."}]'::jsonb,
  0
FROM public.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.automation_rules ar
  WHERE ar.workspace_id = u.id
    AND ar.name = 'Order Received Confirmation'
    AND ar.trigger = 'order_created'
);

INSERT INTO public.automation_rules (workspace_id, name, trigger, conditions, actions, cooldown_seconds)
SELECT
  u.id,
  'Delivery Dispatch Update',
  'order_status_changed',
  '{"status_in":["shipped"]}'::jsonb,
  '[{"type":"send_whatsapp_text","to":"customer","message":"Good news! Your order {{order_ref}} has been shipped."}]'::jsonb,
  300
FROM public.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.automation_rules ar
  WHERE ar.workspace_id = u.id
    AND ar.name = 'Delivery Dispatch Update'
    AND ar.trigger = 'order_status_changed'
);
