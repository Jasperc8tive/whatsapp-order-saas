-- Sprint 1 Fix: Remove dangerous anonymous insert policies and enforce tenant isolation
-- Addresses Audit Finding #1, #2, #4, #10 (CRITICAL) - Sections 2b, 12b
-- Issue: Anonymous insert policies on orders, order_items, customers allow cross-tenant data injection

-- Revoke the dangerous "public insert" policies that use WITH CHECK (true)
DROP POLICY IF EXISTS "public insert" ON public.orders;
DROP POLICY IF EXISTS "public insert" ON public.order_items;
DROP POLICY IF EXISTS "public insert" ON public.customers;
DROP POLICY IF EXISTS "public update" ON public.customers;

-- Create secure insert policy for orders - only authenticated workspace members can insert
CREATE POLICY "workspace_members_insert_orders"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (
  vendor_id IN (
    SELECT id FROM public.users 
    WHERE id IN (
      SELECT workspace_id FROM public.workspace_members 
      WHERE user_id = auth.uid()
    )
  )
);

-- Create secure insert policy for order_items - must belong to a valid order in user's workspace
CREATE POLICY "workspace_members_insert_order_items"
ON public.order_items
FOR INSERT
TO authenticated
WITH CHECK (
  order_id IN (
    SELECT id FROM public.orders 
    WHERE vendor_id IN (
      SELECT id FROM public.users 
      WHERE id IN (
        SELECT workspace_id FROM public.workspace_members 
        WHERE user_id = auth.uid()
      )
    )
  )
);

-- Create secure insert policy for customers - only for vendors in user's workspace
CREATE POLICY "workspace_members_insert_customers"
ON public.customers
FOR INSERT
TO authenticated
WITH CHECK (
  vendor_id IN (
    SELECT id FROM public.users 
    WHERE id IN (
      SELECT workspace_id FROM public.workspace_members 
      WHERE user_id = auth.uid()
    )
  )
);

-- Create secure update policy for customers - only for vendors in user's workspace
CREATE POLICY "workspace_members_update_customers"
ON public.customers
FOR UPDATE
TO authenticated
USING (
  vendor_id IN (
    SELECT id FROM public.users 
    WHERE id IN (
      SELECT workspace_id FROM public.workspace_members 
      WHERE user_id = auth.uid()
    )
  )
);

-- Ensure SELECT policies are also properly scoped (should already exist but reinforcing)
DROP POLICY IF EXISTS "workspace_members_select_orders" ON public.orders;
CREATE POLICY "workspace_members_select_orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  vendor_id IN (
    SELECT id FROM public.users 
    WHERE id IN (
      SELECT workspace_id FROM public.workspace_members 
      WHERE user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "workspace_members_select_order_items" ON public.order_items;
CREATE POLICY "workspace_members_select_order_items"
ON public.order_items
FOR SELECT
TO authenticated
USING (
  order_id IN (
    SELECT id FROM public.orders 
    WHERE vendor_id IN (
      SELECT id FROM public.users 
      WHERE id IN (
        SELECT workspace_id FROM public.workspace_members 
        WHERE user_id = auth.uid()
      )
    )
  )
);

DROP POLICY IF EXISTS "workspace_members_select_customers" ON public.customers;
CREATE POLICY "workspace_members_select_customers"
ON public.customers
FOR SELECT
TO authenticated
USING (
  vendor_id IN (
    SELECT id FROM public.users 
    WHERE id IN (
      SELECT workspace_id FROM public.workspace_members 
      WHERE user_id = auth.uid()
    )
  )
);

COMMENT ON POLICY "workspace_members_insert_orders" ON public.orders IS 'Sprint 1 Fix: Prevents cross-tenant order injection by validating vendor_id against user''s workspace';
COMMENT ON POLICY "workspace_members_insert_order_items" ON public.order_items IS 'Sprint 1 Fix: Prevents cross-tenant order item injection by validating order ownership';
COMMENT ON POLICY "workspace_members_insert_customers" ON public.customers IS 'Sprint 1 Fix: Prevents cross-tenant customer injection by validating vendor_id against user''s workspace';
