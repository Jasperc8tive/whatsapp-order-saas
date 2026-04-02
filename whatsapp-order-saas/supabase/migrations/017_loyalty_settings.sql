-- ============================================================
-- Migration 017: Workspace loyalty configuration
-- ============================================================

alter table if exists public.users
  add column if not exists loyalty_points_per_order integer not null default 10,
  add column if not exists loyalty_reward_threshold integer not null default 100;

alter table if exists public.users
  drop constraint if exists users_loyalty_points_positive,
  add constraint users_loyalty_points_positive check (loyalty_points_per_order > 0);

alter table if exists public.users
  drop constraint if exists users_loyalty_reward_threshold_positive,
  add constraint users_loyalty_reward_threshold_positive check (loyalty_reward_threshold > 0);
