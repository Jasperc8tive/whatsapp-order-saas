-- ============================================================
-- Migration 012: Add order_items, payments, deliveries tables
-- These three tables are defined in schema.sql but were never
-- applied to the remote database.
-- ============================================================

-- ============================================================
-- TABLE: order_items
-- ============================================================

create table if not exists public.order_items (
  id           uuid          primary key default gen_random_uuid(),
  order_id     uuid          not null references public.orders(id) on delete cascade,
  product_id   uuid          references public.products(id) on delete set null,
  product_name text          not null,
  quantity     integer       not null check (quantity > 0),
  price        numeric(12,2) not null check (price >= 0),
  subtotal     numeric(12,2) generated always as (quantity * price) stored
);

comment on table public.order_items is
  'Line items for each order. product_name/price are snapshotted so catalogue changes do not mutate history.';

create index if not exists order_items_order_id_idx   on public.order_items(order_id);
create index if not exists order_items_product_id_idx on public.order_items(product_id);

-- ============================================================
-- TABLE: payments
-- ============================================================

create table if not exists public.payments (
  id                  uuid                    primary key default gen_random_uuid(),
  order_id            uuid                    not null references public.orders(id) on delete cascade,
  provider            text                    not null default 'paystack',
  paystack_reference  text                    unique,
  amount              numeric(12,2)           not null check (amount >= 0),
  currency            text                    not null default 'NGN',
  status              text                    not null default 'pending',
  paid_at             timestamptz,
  meta                jsonb                   default '{}',
  created_at          timestamptz             not null default now()
);

comment on table public.payments is
  'Payment attempts. One order can have multiple attempts (retries).';

create index if not exists payments_order_id_idx       on public.payments(order_id);
create index if not exists payments_paystack_ref_idx   on public.payments(paystack_reference);

-- ============================================================
-- TABLE: deliveries
-- ============================================================

create table if not exists public.deliveries (
  id              uuid                   primary key default gen_random_uuid(),
  order_id        uuid                   not null references public.orders(id) on delete cascade,
  courier         text,
  tracking_id     text,
  delivery_status text                   not null default 'not_dispatched',
  dispatched_at   timestamptz,
  delivered_at    timestamptz,
  notes           text,
  created_at      timestamptz            not null default now(),
  updated_at      timestamptz            not null default now()
);

comment on table public.deliveries is
  'Delivery tracking per order. Typically one row per order.';

create index if not exists deliveries_order_id_idx on public.deliveries(order_id);
create index if not exists deliveries_status_idx   on public.deliveries(delivery_status);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- deliveries: keep updated_at current
drop trigger if exists trg_deliveries_updated_at on public.deliveries;
create trigger trg_deliveries_updated_at
  before update on public.deliveries
  for each row execute function public.set_updated_at();

-- order_items: keep orders.total_amount in sync
create or replace function public.sync_order_total()
returns trigger language plpgsql as $$
begin
  update public.orders
  set total_amount = (
    select coalesce(sum(subtotal), 0)
    from public.order_items
    where order_id = coalesce(new.order_id, old.order_id)
  )
  where id = coalesce(new.order_id, old.order_id);
  return null;
end;
$$;

drop trigger if exists trg_sync_order_total on public.order_items;
create trigger trg_sync_order_total
  after insert or update or delete on public.order_items
  for each row execute function public.sync_order_total();

-- payments: mark order as paid when a payment lands
create or replace function public.sync_payment_status()
returns trigger language plpgsql as $$
begin
  if new.status = 'paid' then
    update public.orders
    set payment_status = 'paid',
        updated_at     = now()
    where id = new.order_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_sync_payment_status on public.payments;
create trigger trg_sync_payment_status
  after insert or update on public.payments
  for each row execute function public.sync_payment_status();

-- deliveries: mirror delivery_status → order_status
create or replace function public.sync_delivery_to_order()
returns trigger language plpgsql as $$
begin
  if new.delivery_status = 'delivered' then
    update public.orders
    set order_status = 'delivered',
        updated_at   = now()
    where id = new.order_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_sync_delivery_to_order on public.deliveries;
create trigger trg_sync_delivery_to_order
  after insert or update on public.deliveries
  for each row execute function public.sync_delivery_to_order();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.order_items enable row level security;
alter table public.payments    enable row level security;
alter table public.deliveries  enable row level security;

-- ── order_items ──────────────────────────────────────────────────────────────

drop policy if exists "order_items: vendor scope" on public.order_items;
create policy "order_items: vendor scope" on public.order_items
  for all using (
    order_id in (
      select id from public.orders where vendor_id = public.my_vendor_id()
    )
  );

drop policy if exists "order_items: public insert" on public.order_items;
create policy "order_items: public insert" on public.order_items
  for insert with check (true);

-- ── payments ─────────────────────────────────────────────────────────────────

drop policy if exists "payments: vendor scope" on public.payments;
create policy "payments: vendor scope" on public.payments
  for all using (
    order_id in (
      select id from public.orders where vendor_id = public.my_vendor_id()
    )
  );

-- ── deliveries ───────────────────────────────────────────────────────────────

drop policy if exists "deliveries: vendor scope" on public.deliveries;
create policy "deliveries: vendor scope" on public.deliveries
  for all using (
    order_id in (
      select id from public.orders where vendor_id = public.my_vendor_id()
    )
  );
