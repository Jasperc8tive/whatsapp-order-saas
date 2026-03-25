-- ============================================================
--  WhatsOrder — Multi-tenant SaaS Schema
--  Database: Supabase / PostgreSQL
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";


-- ============================================================
-- 1. USERS  (extends Supabase auth.users)
-- ============================================================
create table public.users (
  id              uuid primary key references auth.users(id) on delete cascade,
  business_name   text        not null,
  email           text        not null unique,
  phone           text,
  plan            text        not null default 'starter'
                    check (plan in ('starter', 'growth', 'pro')),
  whatsapp_number text,
  logo_url        text,
  slug            text        unique,          -- public storefront slug e.g. /order/my-shop
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.users is
  'One row per vendor/business. id mirrors auth.users.id (1-to-1).';


-- ============================================================
-- 2. CUSTOMERS
-- ============================================================
create table public.customers (
  id          uuid        primary key default uuid_generate_v4(),
  vendor_id   uuid        not null references public.users(id) on delete cascade,
  name        text        not null,
  phone       text        not null,
  email       text,
  address     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- a vendor cannot have two customers with the same phone
  unique (vendor_id, phone)
);

comment on table public.customers is
  'Customers scoped per vendor. Phone is the primary contact identifier.';


-- ============================================================
-- 3. PRODUCTS
-- ============================================================
create table public.products (
  id          uuid        primary key default uuid_generate_v4(),
  vendor_id   uuid        not null references public.users(id) on delete cascade,
  name        text        not null,
  description text,
  price       numeric(12,2) not null check (price >= 0),
  image_url   text,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.products is
  'Product catalogue scoped per vendor.';


-- ============================================================
-- 4. ORDERS
-- ============================================================
create type public.order_status   as enum (
  'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'
);
create type public.payment_status as enum (
  'unpaid', 'pending', 'paid', 'refunded', 'failed'
);

create table public.orders (
  id              uuid               primary key default uuid_generate_v4(),
  vendor_id       uuid               not null references public.users(id) on delete cascade,
  customer_id     uuid               references public.customers(id) on delete set null,
  order_status    public.order_status   not null default 'pending',
  payment_status  public.payment_status not null default 'unpaid',
  total_amount    numeric(12,2)      not null default 0 check (total_amount >= 0),
  notes           text,
  whatsapp_msg_id text,               -- WhatsApp message ID that triggered this order
  created_at      timestamptz        not null default now(),
  updated_at      timestamptz        not null default now()
);

comment on table public.orders is
  'Order header. Line items live in order_items.';


-- ============================================================
-- 5. ORDER ITEMS
-- ============================================================
create table public.order_items (
  id          uuid          primary key default uuid_generate_v4(),
  order_id    uuid          not null references public.orders(id) on delete cascade,
  product_id  uuid          references public.products(id) on delete set null,
  product_name text         not null,   -- snapshot at time of order
  quantity    integer       not null check (quantity > 0),
  price       numeric(12,2) not null check (price >= 0),  -- unit price snapshot
  subtotal    numeric(12,2) generated always as (quantity * price) stored
);

comment on table public.order_items is
  'Line items for each order. product_name/price are snapshotted so catalogue changes do not mutate history.';


-- ============================================================
-- 6. PAYMENTS
-- ============================================================
create type public.payment_provider as enum ('paystack', 'flutterwave', 'manual');

create table public.payments (
  id                  uuid                    primary key default uuid_generate_v4(),
  order_id            uuid                    not null references public.orders(id) on delete cascade,
  provider            public.payment_provider not null default 'paystack',
  paystack_reference  text                    unique,      -- Paystack tx ref / idempotency key
  amount              numeric(12,2)           not null check (amount >= 0),
  currency            text                    not null default 'NGN',
  status              public.payment_status   not null default 'pending',
  paid_at             timestamptz,
  meta                jsonb                   default '{}',  -- raw webhook payload
  created_at          timestamptz             not null default now()
);

comment on table public.payments is
  'Payment attempts. One order can have multiple attempts (retries).';


-- ============================================================
-- 7. DELIVERIES
-- ============================================================
create type public.delivery_status as enum (
  'not_dispatched', 'dispatched', 'in_transit', 'delivered', 'returned', 'failed'
);

create table public.deliveries (
  id              uuid                    primary key default uuid_generate_v4(),
  order_id        uuid                    not null references public.orders(id) on delete cascade,
  courier         text,                   -- e.g. "GIG Logistics", "DHL"
  tracking_id     text,
  delivery_status public.delivery_status  not null default 'not_dispatched',
  dispatched_at   timestamptz,
  delivered_at    timestamptz,
  notes           text,
  created_at      timestamptz             not null default now(),
  updated_at      timestamptz             not null default now()
);

comment on table public.deliveries is
  'Delivery tracking per order. Typically one row per order.';


-- ============================================================
-- INDEXES  (all vendor_id lookups + hot query paths)
-- ============================================================

-- customers
create index customers_vendor_id_idx       on public.customers(vendor_id);
create index customers_phone_idx           on public.customers(phone);

-- products
create index products_vendor_id_idx        on public.products(vendor_id);
create index products_vendor_active_idx    on public.products(vendor_id) where is_active = true;

-- orders
create index orders_vendor_id_idx          on public.orders(vendor_id);
create index orders_customer_id_idx        on public.orders(customer_id);
create index orders_order_status_idx       on public.orders(order_status);
create index orders_payment_status_idx     on public.orders(payment_status);
create index orders_vendor_status_idx      on public.orders(vendor_id, order_status);  -- composite: list by vendor+status
create index orders_created_at_idx         on public.orders(created_at desc);

-- order_items
create index order_items_order_id_idx      on public.order_items(order_id);
create index order_items_product_id_idx    on public.order_items(product_id);

-- payments
create index payments_order_id_idx         on public.payments(order_id);
create index payments_paystack_ref_idx     on public.payments(paystack_reference);

-- deliveries
create index deliveries_order_id_idx       on public.deliveries(order_id);
create index deliveries_status_idx         on public.deliveries(delivery_status);


-- ============================================================
-- UPDATED_AT TRIGGER  (auto-maintain updated_at columns)
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create trigger trg_customers_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create trigger trg_deliveries_updated_at
  before update on public.deliveries
  for each row execute function public.set_updated_at();


-- ============================================================
-- AUTO-SYNC: keep orders.total_amount in step with order_items
-- ============================================================
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

create trigger trg_sync_order_total
  after insert or update or delete on public.order_items
  for each row execute function public.sync_order_total();


-- ============================================================
-- AUTO-SYNC: mark orders.payment_status = 'paid' when payment lands
-- ============================================================
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

create trigger trg_sync_payment_status
  after insert or update on public.payments
  for each row execute function public.sync_payment_status();


-- ============================================================
-- AUTO-SYNC: mirror delivery status → order status
-- ============================================================
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

create trigger trg_sync_delivery_to_order
  after insert or update on public.deliveries
  for each row execute function public.sync_delivery_to_order();


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.users       enable row level security;
alter table public.customers   enable row level security;
alter table public.products    enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;
alter table public.payments    enable row level security;
alter table public.deliveries  enable row level security;

-- Helper: returns the authenticated vendor's id (same as auth.uid())
-- Used to keep RLS policies DRY and avoid repeated subqueries.
create or replace function public.my_vendor_id()
returns uuid language sql stable security definer as $$
  select auth.uid()
$$;

-- USERS: each user sees only their own row
create policy "users: own row" on public.users
  for all using (id = auth.uid());

-- CUSTOMERS: scoped to owning vendor
create policy "customers: vendor scope" on public.customers
  for all using (vendor_id = public.my_vendor_id());

-- PRODUCTS: scoped to owning vendor
create policy "products: vendor scope" on public.products
  for all using (vendor_id = public.my_vendor_id());

-- ORDERS: scoped to owning vendor
create policy "orders: vendor scope" on public.orders
  for all using (vendor_id = public.my_vendor_id());

-- ORDER ITEMS: accessible if the parent order belongs to the vendor
create policy "order_items: vendor scope" on public.order_items
  for all using (
    order_id in (
      select id from public.orders where vendor_id = public.my_vendor_id()
    )
  );

-- PAYMENTS: accessible if the parent order belongs to the vendor
create policy "payments: vendor scope" on public.payments
  for all using (
    order_id in (
      select id from public.orders where vendor_id = public.my_vendor_id()
    )
  );

-- DELIVERIES: accessible if the parent order belongs to the vendor
create policy "deliveries: vendor scope" on public.deliveries
  for all using (
    order_id in (
      select id from public.orders where vendor_id = public.my_vendor_id()
    )
  );


-- ============================================================
-- PUBLIC STOREFRONT POLICY (read-only for anonymous users)
-- Allows customers to submit orders on /order/[vendor] without auth.
-- ============================================================

-- Vendors are publicly discoverable by slug (read-only)
create policy "users: public read by slug" on public.users
  for select using (slug is not null);

-- Allow anonymous inserts for orders & order_items via the storefront
create policy "orders: public insert" on public.orders
  for insert with check (true);

create policy "order_items: public insert" on public.order_items
  for insert with check (true);

-- Allow anonymous upsert of customers via the storefront.
-- INSERT and UPDATE are separate policies in Postgres RLS.
-- The server action uses the service-role client which bypasses RLS entirely,
-- so these policies are a belt-and-suspenders fallback for anon inserts.
create policy "customers: public insert" on public.customers
  for insert with check (true);

create policy "customers: public update own" on public.customers
  for update using (true) with check (true);
