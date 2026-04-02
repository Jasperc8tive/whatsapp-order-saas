-- ============================================================
-- Migration 014: Campaign history persistence
-- ============================================================

create table if not exists public.campaign_history (
  id                     uuid primary key default gen_random_uuid(),
  vendor_id              uuid not null references public.users(id) on delete cascade,
  created_by             uuid references public.users(id) on delete set null,
  segment                text not null check (segment in ('all_customers', 'repeat_buyers')),
  message                text not null,
  recipient_count        integer not null default 0 check (recipient_count >= 0),
  sent_count             integer not null default 0 check (sent_count >= 0),
  failed_count           integer not null default 0 check (failed_count >= 0),
  delivery_status_report jsonb not null default '{}'::jsonb,
  created_at             timestamptz not null default now()
);

comment on table public.campaign_history is
  'Historical outbound campaign runs per workspace/vendor.';

create index if not exists campaign_history_vendor_created_idx
  on public.campaign_history(vendor_id, created_at desc);

alter table public.campaign_history enable row level security;

drop policy if exists "campaign_history: vendor scope" on public.campaign_history;
create policy "campaign_history: vendor scope" on public.campaign_history
  for all using (vendor_id = public.my_vendor_id())
  with check (vendor_id = public.my_vendor_id());
