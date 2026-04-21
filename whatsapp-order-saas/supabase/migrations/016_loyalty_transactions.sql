-- ============================================================
-- Migration 016: Loyalty transactions ledger
-- ============================================================

create table if not exists public.loyalty_transactions (
  id          uuid primary key default gen_random_uuid(),
  vendor_id   uuid not null references public.users(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  points      integer not null,
  reason      text,
  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

comment on table public.loyalty_transactions is
  'Immutable loyalty points ledger (positive for bonus, negative for redemption).';

create index if not exists loyalty_transactions_vendor_customer_idx
  on public.loyalty_transactions(vendor_id, customer_id, created_at desc);

alter table public.loyalty_transactions enable row level security;

drop policy if exists "loyalty_transactions: vendor scope" on public.loyalty_transactions;
create policy "loyalty_transactions: vendor scope" on public.loyalty_transactions
  for all using (vendor_id = public.my_vendor_id())
  with check (vendor_id = public.my_vendor_id());
