-- ============================================================
-- COMPLETE FIX FOR RLS INFINITE RECURSION
-- ============================================================
-- This script creates security definer functions and fixes all RLS policies
-- to prevent infinite recursion on the users table.
-- 
-- INSTRUCTIONS:
-- 1. Go to your Supabase Dashboard: https://supabase.com/dashboard
-- 2. Select your project (tlraaxpemekmjpcbwpny)
-- 3. Navigate to SQL Editor
-- 4. Paste this entire script
-- 5. Click "Run" to execute
-- ============================================================

-- ============================================================
-- STEP 1: Create Security Definer Functions
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

-- Function to get user role (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM public.users
  WHERE id = auth.uid()
  LIMIT 1;
  
  RETURN user_role;
END;
$$;

-- ============================================================
-- STEP 2: Fix Users Table Policies (Remove ALL Recursion)
-- ============================================================

-- Drop ALL existing policies on users table
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Super admins can read all users" ON public.users;
DROP POLICY IF EXISTS "Clinic admins can read clinic users" ON public.users;
DROP POLICY IF EXISTS "Users can view clinic members" ON public.users;
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Clinic admins can manage users" ON public.users;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.users;

-- Allow users to read their own profile (simple, no recursion)
CREATE POLICY "Users can read own profile" ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow users to insert their own profile (for signup)
CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Super admins can read all users (using security definer function - NO recursion)
CREATE POLICY "Super admins can read all users" ON public.users
  FOR SELECT
  USING (public.is_super_admin());

-- Super admins can update any user
CREATE POLICY "Super admins can update all users" ON public.users
  FOR UPDATE
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Clinic admins can read users in their clinic (using security definer functions)
CREATE POLICY "Clinic admins can read clinic users" ON public.users
  FOR SELECT
  USING (
    -- User must be in the same clinic
    clinic_id IS NOT NULL 
    AND clinic_id = public.get_user_clinic_id()
    -- And current user must be admin or super_admin
    AND public.is_admin_or_super_admin()
  );

-- ============================================================
-- STEP 3: Fix Clinics Table Policies
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own clinic" ON public.clinics;
DROP POLICY IF EXISTS "Users can update own clinic" ON public.clinics;
DROP POLICY IF EXISTS "Super admins can read all clinics" ON public.clinics;
DROP POLICY IF EXISTS "Super admins can manage all clinics" ON public.clinics;

-- Users can read their own clinic
CREATE POLICY "Users can read own clinic" ON public.clinics
  FOR SELECT
  USING (
    owner_id = auth.uid()
    OR id = public.get_user_clinic_id()
  );

-- Clinic owners/admins can update their clinic
CREATE POLICY "Users can update own clinic" ON public.clinics
  FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR (id = public.get_user_clinic_id() AND public.is_admin_or_super_admin())
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR (id = public.get_user_clinic_id() AND public.is_admin_or_super_admin())
  );

-- Super admins can read all clinics
CREATE POLICY "Super admins can read all clinics" ON public.clinics
  FOR SELECT
  USING (public.is_super_admin());

-- Super admins can manage all clinics
CREATE POLICY "Super admins can manage all clinics" ON public.clinics
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ============================================================
-- STEP 4: Fix Patients Table Policies
-- ============================================================

DROP POLICY IF EXISTS "Users can read clinic patients" ON public.patients;
DROP POLICY IF EXISTS "Users can manage clinic patients" ON public.patients;

CREATE POLICY "Users can read clinic patients" ON public.patients
  FOR SELECT
  USING (
    clinic_id = public.get_user_clinic_id()
    OR public.is_super_admin()
  );

CREATE POLICY "Users can manage clinic patients" ON public.patients
  FOR ALL
  USING (
    clinic_id = public.get_user_clinic_id()
    OR public.is_super_admin()
  )
  WITH CHECK (
    clinic_id = public.get_user_clinic_id()
    OR public.is_super_admin()
  );

-- ============================================================
-- STEP 5: Fix Appointments Table Policies
-- ============================================================

DROP POLICY IF EXISTS "Users can read clinic appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users can manage clinic appointments" ON public.appointments;

CREATE POLICY "Users can read clinic appointments" ON public.appointments
  FOR SELECT
  USING (
    clinic_id = public.get_user_clinic_id()
    OR public.is_super_admin()
  );

CREATE POLICY "Users can manage clinic appointments" ON public.appointments
  FOR ALL
  USING (
    clinic_id = public.get_user_clinic_id()
    OR public.is_super_admin()
  )
  WITH CHECK (
    clinic_id = public.get_user_clinic_id()
    OR public.is_super_admin()
  );

-- ============================================================
-- STEP 6: Fix Visits Table Policies
-- ============================================================

DROP POLICY IF EXISTS "Users can read clinic visits" ON public.visits;
DROP POLICY IF EXISTS "Users can manage clinic visits" ON public.visits;

CREATE POLICY "Users can read clinic visits" ON public.visits
  FOR SELECT
  USING (
    clinic_id = public.get_user_clinic_id()
    OR public.is_super_admin()
  );

CREATE POLICY "Users can manage clinic visits" ON public.visits
  FOR ALL
  USING (
    clinic_id = public.get_user_clinic_id()
    OR public.is_super_admin()
  )
  WITH CHECK (
    clinic_id = public.get_user_clinic_id()
    OR public.is_super_admin()
  );

-- ============================================================
-- STEP 7: Fix Inventory Table Policies
-- ============================================================

DROP POLICY IF EXISTS "Users can read clinic inventory" ON public.inventory;
DROP POLICY IF EXISTS "Users can manage clinic inventory" ON public.inventory;

CREATE POLICY "Users can read clinic inventory" ON public.inventory
  FOR SELECT
  USING (
    clinic_id = public.get_user_clinic_id()
    OR public.is_super_admin()
  );

CREATE POLICY "Users can manage clinic inventory" ON public.inventory
  FOR ALL
  USING (
    clinic_id = public.get_user_clinic_id()
    OR public.is_super_admin()
  )
  WITH CHECK (
    clinic_id = public.get_user_clinic_id()
    OR public.is_super_admin()
  );

-- ============================================================
-- STEP 8: Fix Audit Logs Table Policies
-- ============================================================

DROP POLICY IF EXISTS "Users can read clinic audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Super admins can read all audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

CREATE POLICY "Users can read clinic audit logs" ON public.audit_logs
  FOR SELECT
  USING (
    clinic_id = public.get_user_clinic_id()
    OR clinic_id IS NULL
    OR public.is_super_admin()
  );

CREATE POLICY "Super admins can read all audit logs" ON public.audit_logs
  FOR SELECT
  USING (public.is_super_admin());

-- Allow inserting audit logs (for system operations)
CREATE POLICY "System can insert audit logs" ON public.audit_logs
  FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- STEP 9: Fix Activities Table Policies
-- ============================================================

DROP POLICY IF EXISTS "Users can read clinic activities" ON public.activities;
DROP POLICY IF EXISTS "Users can manage clinic activities" ON public.activities;

CREATE POLICY "Users can read clinic activities" ON public.activities
  FOR SELECT
  USING (
    clinic_id = public.get_user_clinic_id()
    OR public.is_super_admin()
  );

CREATE POLICY "Users can manage clinic activities" ON public.activities
  FOR ALL
  USING (
    clinic_id = public.get_user_clinic_id()
    OR public.is_super_admin()
  )
  WITH CHECK (
    clinic_id = public.get_user_clinic_id()
    OR public.is_super_admin()
  );

-- ============================================================
-- STEP 10: Grant Execute Permissions
-- ============================================================

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO anon;
GRANT EXECUTE ON FUNCTION public.get_user_clinic_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_clinic_id() TO anon;
GRANT EXECUTE ON FUNCTION public.is_admin_or_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_super_admin() TO anon;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO anon;

-- ============================================================
-- VERIFICATION: Check if functions are working
-- ============================================================

-- Test the functions (run these separately after the main script)
-- SELECT public.is_super_admin();
-- SELECT public.get_user_clinic_id();
-- SELECT public.is_admin_or_super_admin();
-- SELECT public.get_user_role();

-- ============================================================
-- SUCCESS!
-- ============================================================
-- The infinite recursion issue should now be fixed.
-- Try logging in again with: superadmin@juaafya.com / JuaAfya@Demo123
-- ============================================================
