-- Sprint 1 Fix: Secure security definer functions against search_path hijacking
-- Addresses Audit Finding #8 (HIGH) - Section 2b
-- Issue: my_workspace_id() and my_workspace_role() use SECURITY DEFINER without search_path restriction

-- Update my_workspace_id() to include search_path protection
CREATE OR REPLACE FUNCTION public.my_workspace_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public, pg_temp
STABLE
AS $$
  SELECT workspace_id
  FROM public.workspace_members
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- Update my_workspace_role() to include search_path protection  
CREATE OR REPLACE FUNCTION public.my_workspace_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public, pg_temp
STABLE
AS $$
  SELECT role
  FROM public.workspace_members
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- Grant execute to authenticated users (required for SECURITY DEFINER functions)
GRANT EXECUTE ON FUNCTION public.my_workspace_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_workspace_role() TO authenticated;

COMMENT ON FUNCTION public.my_workspace_id() IS 'Returns the current user''s workspace ID. Uses SECURITY DEFINER with fixed search_path to prevent hijacking.';
COMMENT ON FUNCTION public.my_workspace_role() IS 'Returns the current user''s role in their workspace. Uses SECURITY DEFINER with fixed search_path to prevent hijacking.';
