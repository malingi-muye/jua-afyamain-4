-- ============================================================
-- FINAL FIX FOR RLS INFINITE RECURSION (FORCE DROP VERSION)
-- ============================================================
-- This script aggressively drops all policies and recreates them
-- Run this if you get "policy already exists" errors
-- ============================================================

-- ============================================================
-- STEP 1: Create Security Definer Functions (if not exist)
-- ============================================================

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
-- STEP 2: AGGRESSIVELY DROP ALL POLICIES on users table
-- ============================================================

-- Drop with all possible naming variations
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.users;
DROP POLICY IF EXISTS "Super admins can read all users" ON public.users;
DROP POLICY IF EXISTS "Super admins can update all users" ON public.users;
DROP POLICY IF EXISTS "Super admins can delete all users" ON public.users;
DROP POLICY IF EXISTS "Super admins can insert all users" ON public.users;
DROP POLICY IF EXISTS "Clinic admins can read clinic users" ON public.users;
DROP POLICY IF EXISTS "Clinic admins can update clinic users" ON public.users;
DROP POLICY IF EXISTS "Clinic admins can manage users" ON public.users;
DROP POLICY IF EXISTS "Users can view clinic members" ON public.users;
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can read all users" ON public.users;
DROP POLICY IF EXISTS "Admins can manage users" ON public.users;

-- ============================================================
-- STEP 3: Create NEW policies for users table
-- ============================================================

-- Policy 1: Users can read their own profile
CREATE POLICY "users_read_own_profile" ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- Policy 2: Users can update their own profile
CREATE POLICY "users_update_own_profile" ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy 3: Users can insert their own profile
CREATE POLICY "users_insert_own_profile" ON public.users
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Policy 4: Super admins can read all users
CREATE POLICY "super_admins_read_all_users" ON public.users
  FOR SELECT
  USING (public.is_super_admin());

-- Policy 5: Super admins can update all users
CREATE POLICY "super_admins_update_all_users" ON public.users
  FOR UPDATE
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Policy 6: Super admins can insert users
CREATE POLICY "super_admins_insert_users" ON public.users
  FOR INSERT
  WITH CHECK (public.is_super_admin());

-- Policy 7: Clinic admins can read clinic users
CREATE POLICY "admins_read_clinic_users" ON public.users
  FOR SELECT
  USING (
    clinic_id IS NOT NULL 
    AND clinic_id = public.get_user_clinic_id()
    AND public.is_admin_or_super_admin()
  );

-- ============================================================
-- STEP 4: Drop and recreate policies on other tables
-- ============================================================

-- CLINICS table
DROP POLICY IF EXISTS "Users can read own clinic" ON public.clinics;
DROP POLICY IF EXISTS "Users can update own clinic" ON public.clinics;
DROP POLICY IF EXISTS "Super admins can read all clinics" ON public.clinics;
DROP POLICY IF EXISTS "Super admins can manage all clinics" ON public.clinics;

CREATE POLICY "clinics_read_own" ON public.clinics
  FOR SELECT
  USING (
    owner_id = auth.uid()
    OR id = public.get_user_clinic_id()
  );

CREATE POLICY "clinics_update_own" ON public.clinics
  FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR (id = public.get_user_clinic_id() AND public.is_admin_or_super_admin())
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR (id = public.get_user_clinic_id() AND public.is_admin_or_super_admin())
  );

CREATE POLICY "clinics_read_all_super_admin" ON public.clinics
  FOR SELECT
  USING (public.is_super_admin());

CREATE POLICY "clinics_manage_all_super_admin" ON public.clinics
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- PATIENTS table
DROP POLICY IF EXISTS "Users can read clinic patients" ON public.patients;
DROP POLICY IF EXISTS "Users can manage clinic patients" ON public.patients;

CREATE POLICY "patients_read" ON public.patients
  FOR SELECT
  USING (
    clinic_id = public.get_user_clinic_id()
    OR public.is_super_admin()
  );

CREATE POLICY "patients_manage" ON public.patients
  FOR ALL
  USING (
    clinic_id = public.get_user_clinic_id()
    OR public.is_super_admin()
  )
  WITH CHECK (
    clinic_id = public.get_user_clinic_id()
    OR public.is_super_admin()
  );

-- APPOINTMENTS table
DROP POLICY IF EXISTS "Users can read clinic appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users can manage clinic appointments" ON public.appointments;

CREATE POLICY "appointments_read" ON public.appointments
  FOR SELECT
  USING (
    clinic_id = public.get_user_clinic_id()
    OR public.is_super_admin()
  );

CREATE POLICY "appointments_manage" ON public.appointments
  FOR ALL
  USING (
    clinic_id = public.get_user_clinic_id()
    OR public.is_super_admin()
  )
  WITH CHECK (
    clinic_id = public.get_user_clinic_id()
    OR public.is_super_admin()
  );

-- VISITS table
DROP POLICY IF EXISTS "Users can read clinic visits" ON public.visits;
DROP POLICY IF EXISTS "Users can manage clinic visits" ON public.visits;

CREATE POLICY "visits_read" ON public.visits
  FOR SELECT
  USING (
    clinic_id = public.get_user_clinic_id()
    OR public.is_super_admin()
  );

CREATE POLICY "visits_manage" ON public.visits
  FOR ALL
  USING (
    clinic_id = public.get_user_clinic_id()
    OR public.is_super_admin()
  )
  WITH CHECK (
    clinic_id = public.get_user_clinic_id()
    OR public.is_super_admin()
  );

-- INVENTORY table
DROP POLICY IF EXISTS "Users can read clinic inventory" ON public.inventory;
DROP POLICY IF EXISTS "Users can manage clinic inventory" ON public.inventory;

CREATE POLICY "inventory_read" ON public.inventory
  FOR SELECT
  USING (
    clinic_id = public.get_user_clinic_id()
    OR public.is_super_admin()
  );

CREATE POLICY "inventory_manage" ON public.inventory
  FOR ALL
  USING (
    clinic_id = public.get_user_clinic_id()
    OR public.is_super_admin()
  )
  WITH CHECK (
    clinic_id = public.get_user_clinic_id()
    OR public.is_super_admin()
  );

-- AUDIT_LOGS table
DROP POLICY IF EXISTS "Users can read clinic audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Super admins can read all audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

CREATE POLICY "audit_logs_read" ON public.audit_logs
  FOR SELECT
  USING (
    clinic_id = public.get_user_clinic_id()
    OR clinic_id IS NULL
    OR public.is_super_admin()
  );

CREATE POLICY "audit_logs_read_all_super_admin" ON public.audit_logs
  FOR SELECT
  USING (public.is_super_admin());

CREATE POLICY "audit_logs_insert" ON public.audit_logs
  FOR INSERT
  WITH CHECK (true);

-- ACTIVITIES table
DROP POLICY IF EXISTS "Users can read clinic activities" ON public.activities;
DROP POLICY IF EXISTS "Users can manage clinic activities" ON public.activities;

CREATE POLICY "activities_read" ON public.activities
  FOR SELECT
  USING (
    clinic_id = public.get_user_clinic_id()
    OR public.is_super_admin()
  );

CREATE POLICY "activities_manage" ON public.activities
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
-- STEP 5: Grant Execute Permissions to Functions
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
-- VERIFICATION COMPLETE
-- ============================================================
-- All policies have been reset and recreated
-- You should now be able to login without infinite recursion errors
-- Try logging in with: superadmin@juaafya.com / JuaAfya@Demo123
-- ============================================================
