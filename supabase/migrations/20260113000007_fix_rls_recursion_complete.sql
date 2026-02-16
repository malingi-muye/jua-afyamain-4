-- Complete fix for RLS infinite recursion
-- This ensures all policies use SECURITY DEFINER functions to avoid recursion

-- ============================================================
-- STEP 1: Create/Update Security Definer Functions
-- These functions bypass RLS to safely check user roles
-- ============================================================

-- Function to check if current user is super admin (bypasses RLS)
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

-- Function to get current user's clinic_id (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_user_clinic_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  clinic_uuid UUID;
BEGIN
  SELECT clinic_id INTO clinic_uuid
  FROM public.users
  WHERE id = auth.uid()
  LIMIT 1;
  
  RETURN clinic_uuid;
END;
$$;

-- Function to check if current user is admin or super admin (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_admin_or_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin')
    LIMIT 1
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_clinic_id() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_or_super_admin() TO authenticated, anon, service_role;

-- ============================================================
-- STEP 2: Fix Users Table Policies (Remove ALL Recursion)
-- ============================================================

-- Drop ALL existing policies on users table that might cause recursion
DROP POLICY IF EXISTS "Super admins can read all users" ON public.users;
DROP POLICY IF EXISTS "super_admins_read_all_users" ON public.users;
DROP POLICY IF EXISTS "Clinic admins can read clinic users" ON public.users;
DROP POLICY IF EXISTS "admins_read_clinic_users" ON public.users;

-- Super admins can read all users (using SECURITY DEFINER function - NO recursion)
CREATE POLICY "Super admins can read all users" ON public.users
  FOR SELECT
  USING (public.is_super_admin());

-- Clinic admins can read users in their clinic (using SECURITY DEFINER functions)
CREATE POLICY "Clinic admins can read clinic users" ON public.users
  FOR SELECT
  USING (
    clinic_id IS NOT NULL 
    AND clinic_id = public.get_user_clinic_id()
    AND public.is_admin_or_super_admin()
  );

-- ============================================================
-- STEP 3: Fix Clinics Table Policies
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Super admins can read all clinics" ON public.clinics;
DROP POLICY IF EXISTS "clinics_read_all_super_admin" ON public.clinics;
DROP POLICY IF EXISTS "clinics_super_admin_all" ON public.clinics;

-- Super admins can read all clinics (using SECURITY DEFINER function)
CREATE POLICY "Super admins can read all clinics" ON public.clinics
  FOR SELECT
  USING (public.is_super_admin());

-- ============================================================
-- STEP 4: Verify Functions and Policies
-- ============================================================

-- Check functions exist
SELECT 
  'Functions' as check_type,
  proname as function_name,
  prosecdef as is_security_definer
FROM pg_proc 
WHERE proname IN ('is_super_admin', 'get_user_clinic_id', 'is_admin_or_super_admin')
ORDER BY proname;

-- Check policies exist
SELECT 
  'Policies' as check_type,
  tablename,
  policyname,
  cmd as operation
FROM pg_policies 
WHERE tablename IN ('clinics', 'users')
  AND (policyname LIKE '%super%admin%' OR policyname LIKE '%clinic%admin%')
ORDER BY tablename, policyname;
