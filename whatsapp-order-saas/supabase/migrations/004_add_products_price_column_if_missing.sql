-- ============================================================
-- Migration 004 — Ensure products.price exists for dashboard/storefront
-- ============================================================

alter table public.products
  add column if not exists price numeric(12,2);

-- Backfill from known legacy columns when present.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'unit_price'
  ) then
    execute 'update public.products set price = coalesce(price, unit_price)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'amount'
  ) then
    execute 'update public.products set price = coalesce(price, amount)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'product_price'
  ) then
    execute 'update public.products set price = coalesce(price, product_price)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'selling_price'
  ) then
    execute 'update public.products set price = coalesce(price, selling_price)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'price_ngn'
  ) then
    execute 'update public.products set price = coalesce(price, price_ngn)';
  end if;
end $$;

update public.products
set price = 0
where price is null;

alter table public.products
  alter column price set default 0,
  alter column price set not null;

alter table public.products
  drop constraint if exists products_price_nonnegative_check;

alter table public.products
  add constraint products_price_nonnegative_check check (price >= 0);
