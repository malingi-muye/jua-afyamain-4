-- Fix Super Admin access to see all clinics including pending ones
-- This ensures Super Admins can see clinics in the dashboard

-- 1. Ensure Super Admin can read all users (needed for the join in getAllClinics)
-- Use SECURITY DEFINER function to avoid infinite recursion
DROP POLICY IF EXISTS "Super admins can read all users" ON public.users;

-- First ensure the is_super_admin() function exists and is SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'super_admin'
  );
END;
$$;

-- Now create the policy using the function (no recursion)
CREATE POLICY "Super admins can read all users" ON public.users
  FOR SELECT
  USING (public.is_super_admin());

-- 2. Ensure Super Admin can read all clinics (should already exist, but ensure it's there)
-- Use the SECURITY DEFINER function to avoid recursion
DROP POLICY IF EXISTS "Super admins can read all clinics" ON public.clinics;
DROP POLICY IF EXISTS "clinics_read_all_super_admin" ON public.clinics;
DROP POLICY IF EXISTS "clinics_super_admin_all" ON public.clinics;

CREATE POLICY "Super admins can read all clinics" ON public.clinics
  FOR SELECT
  USING (public.is_super_admin());

-- 4. Grant execute on the function
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, anon, service_role;

-- 5. Verify the policies exist
SELECT 
  'Verification' as check_type,
  policyname,
  tablename,
  cmd as operation
FROM pg_policies 
WHERE tablename IN ('clinics', 'users')
  AND policyname LIKE '%super%admin%'
ORDER BY tablename, policyname;
