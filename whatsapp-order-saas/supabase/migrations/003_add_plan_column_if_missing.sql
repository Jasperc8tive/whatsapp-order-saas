-- ============================================================
-- Migration 003 — Ensure users.plan exists for billing upgrades
-- ============================================================

alter table public.users
  add column if not exists plan text;

update public.users
set plan = 'starter'
where plan is null or plan = '';

alter table public.users
  alter column plan set default 'starter';

-- Recreate constraint safely (idempotent)
alter table public.users
  drop constraint if exists users_plan_check;

alter table public.users
  add constraint users_plan_check
  check (plan in ('starter', 'growth', 'pro'));
