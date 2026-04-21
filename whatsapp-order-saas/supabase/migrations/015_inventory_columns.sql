-- ============================================================
-- Migration 015: Product inventory tracking columns
-- ============================================================

alter table if exists public.products
  add column if not exists track_inventory boolean not null default false,
  add column if not exists stock_quantity integer,
  add column if not exists low_stock_threshold integer not null default 5;

alter table if exists public.products
  drop constraint if exists products_stock_quantity_nonnegative,
  add constraint products_stock_quantity_nonnegative check (
    stock_quantity is null or stock_quantity >= 0
  );

alter table if exists public.products
  drop constraint if exists products_low_stock_threshold_nonnegative,
  add constraint products_low_stock_threshold_nonnegative check (
    low_stock_threshold >= 0
  );

create index if not exists products_vendor_track_inventory_idx
  on public.products(vendor_id, track_inventory);
