-- ============================================================
--  Migration 006 — Workspace-Role RLS helpers
--  Updates existing table policies to support team members.
--  Run after 005_team_rbac.sql
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- Helper: resolves the workspace the current user belongs to.
--   • If the user is a top-level vendor they own their workspace.
--   • If the user is a team member they belong to their workspace_id.
-- ────────────────────────────────────────────────────────────
create or replace function public.my_workspace_id()
returns uuid language sql stable security definer as $$
  -- Owner case
  select id from public.users where id = auth.uid()
  union all
  -- Team member case
  select workspace_id
  from   public.workspace_members
  where  user_id   = auth.uid()
  and    is_active = true
  limit 1
$$;

-- Helper: returns the role of the current user in their workspace.
create or replace function public.my_workspace_role()
returns public.workspace_role language sql stable security definer as $$
  -- Owner of the users table row is always 'owner'
  select 'owner'::public.workspace_role
  where  exists (select 1 from public.users where id = auth.uid())
  union all
  -- Team member role
  select role
  from   public.workspace_members
  where  user_id   = auth.uid()
  and    is_active = true
  limit 1
$$;

-- ────────────────────────────────────────────────────────────
-- Upgrade existing table RLS to support team members
-- (drop old vendor-only policies, add workspace-aware ones)
-- ────────────────────────────────────────────────────────────

-- CUSTOMERS ──────────────────────────────────────────────────
drop policy if exists "customers: vendor scope" on public.customers;

create policy "customers: workspace read" on public.customers
  for select using (vendor_id = public.my_workspace_id());

create policy "customers: workspace write" on public.customers
  for insert with check (
    vendor_id = public.my_workspace_id()
    and public.my_workspace_role() in ('owner','staff')
  );

create policy "customers: workspace update" on public.customers
  for update using (vendor_id = public.my_workspace_id())
  with check   (vendor_id = public.my_workspace_id());

-- PRODUCTS ───────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'vendor_id'
  ) then
    alter table public.products add column vendor_id uuid;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'products'
        and column_name = 'user_id'
    ) then
      execute 'update public.products set vendor_id = user_id where vendor_id is null';
    end if;
  end if;
end
$$;

drop policy if exists "products: vendor scope" on public.products;

create policy "products: workspace read" on public.products
  for select using (vendor_id = public.my_workspace_id());

create policy "products: workspace write" on public.products
  for insert with check (
    vendor_id = public.my_workspace_id()
    and public.my_workspace_role() in ('owner','staff')
  );

create policy "products: workspace update" on public.products
  for update using (vendor_id = public.my_workspace_id())
  with check   (vendor_id = public.my_workspace_id()
                and public.my_workspace_role() in ('owner','staff'));

create policy "products: workspace delete" on public.products
  for delete using (
    vendor_id = public.my_workspace_id()
    and public.my_workspace_role() in ('owner','staff')
  );

-- ORDERS ──────────────────────────────────────────────────────
drop policy if exists "orders: vendor scope" on public.orders;

create policy "orders: workspace read" on public.orders
  for select using (vendor_id = public.my_workspace_id());

create policy "orders: workspace insert" on public.orders
  for insert with check (
    vendor_id = public.my_workspace_id()
    and public.my_workspace_role() in ('owner','staff')
  );

create policy "orders: workspace update" on public.orders
  for update using (vendor_id = public.my_workspace_id())
  with check   (vendor_id = public.my_workspace_id());

-- ORDER ITEMS ─────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.order_items') is not null then
    execute 'drop policy if exists "order_items: vendor scope" on public.order_items';
    execute '
      create policy "order_items: workspace access" on public.order_items
      for all using (
        order_id in (
          select id from public.orders
          where vendor_id = public.my_workspace_id()
        )
      )
    ';
  end if;
end
$$;

-- PAYMENTS ────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.payments') is not null then
    execute 'drop policy if exists "payments: vendor scope" on public.payments';
    execute '
      create policy "payments: workspace read" on public.payments
      for select using (
        order_id in (
          select id from public.orders
          where vendor_id = public.my_workspace_id()
        )
      )
    ';

    execute '
      create policy "payments: owner write" on public.payments
      for all using (
        public.my_workspace_role() = ''owner''
        and order_id in (
          select id from public.orders
          where vendor_id = public.my_workspace_id()
        )
      )
    ';
  end if;
end
$$;

-- DELIVERIES ──────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.deliveries') is not null then
    execute 'drop policy if exists "deliveries: vendor scope" on public.deliveries';
    execute '
      create policy "deliveries: workspace read" on public.deliveries
      for select using (
        order_id in (
          select id from public.orders
          where vendor_id = public.my_workspace_id()
        )
      )
    ';

    execute '
      create policy "deliveries: workspace write" on public.deliveries
      for all using (
        public.my_workspace_role() in (''owner'',''staff'',''delivery_manager'')
        and order_id in (
          select id from public.orders
          where vendor_id = public.my_workspace_id()
        )
      )
    ';
  end if;
end
$$;
