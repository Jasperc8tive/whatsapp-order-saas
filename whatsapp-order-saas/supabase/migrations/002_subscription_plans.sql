-- ============================================================
--  Migration 002 — SaaS subscription plans
--  Run once against your Supabase project.
-- ============================================================

-- 1. Drop the old check constraint on plan
alter table public.users
  drop constraint if exists users_plan_check;

-- 2. Migrate existing data to the nearest new plan
update public.users set plan = 'starter'   where plan = 'free';
update public.users set plan = 'pro'       where plan = 'enterprise';
-- 'pro' stays as-is

-- 3. Re-add constraint with new plan names and change default
alter table public.users
  alter column plan set default 'starter',
  add constraint users_plan_check
    check (plan in ('starter', 'growth', 'pro'));
