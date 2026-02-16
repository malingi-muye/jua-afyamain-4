-- ============================================================
-- COMPLETE SYSTEM FIX - Implements all fixes from audit
-- This migration ensures everything is properly configured
-- ============================================================

-- ============================================================
-- PART 1: SIGNUP TRIGGER - Ensure it exists and works
-- ============================================================

-- Drop existing trigger if it exists (clean slate)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop and recreate the function to ensure it's correct
DROP FUNCTION IF EXISTS public.handle_new_user_signup();

-- Create the trigger function with comprehensive error handling
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_clinic_id UUID;
  v_clinic_name TEXT;
  v_full_name TEXT;
  v_role TEXT;
  v_slug TEXT;
BEGIN
  -- Extract metadata from auth.users
  v_clinic_name := NEW.raw_user_meta_data->>'clinic_name';
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  -- Use 'doctor' as default role (schema default) - 'admin' might not be in constraint
  -- Valid roles: 'super_admin', 'admin', 'doctor', 'nurse', 'receptionist', 'lab_tech', 'pharmacist', 'accountant'
  v_role := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'doctor');
  
  -- Normalize role to lowercase with underscore (matching constraint format)
  v_role := lower(replace(v_role, ' ', '_'));
  
  -- Validate role is in allowed list, fallback to 'doctor' if not
  IF v_role NOT IN ('super_admin', 'admin', 'doctor', 'nurse', 'receptionist', 'lab_tech', 'pharmacist', 'accountant') THEN
    v_role := 'doctor';
  END IF;

  -- Only process if clinic_name is provided (new clinic signup)
  IF v_clinic_name IS NOT NULL AND v_clinic_name != '' THEN
    -- Generate slug from clinic name
    v_slug := lower(regexp_replace(v_clinic_name, '[^a-zA-Z0-9]+', '-', 'g'));
    v_slug := trim(both '-' from v_slug);
    
    -- Ensure slug is not empty (fallback to user ID if needed)
    IF v_slug IS NULL OR v_slug = '' THEN
      v_slug := 'clinic-' || substring(NEW.id::text from 1 for 8);
    END IF;
    
    -- Make slug unique if it already exists
    WHILE EXISTS (SELECT 1 FROM public.clinics WHERE slug = v_slug) LOOP
      v_slug := v_slug || '-' || substring(gen_random_uuid()::text from 1 for 8);
    END LOOP;

    -- Create the clinic with 'pending' status (awaiting Super Admin approval)
    BEGIN
      INSERT INTO public.clinics (
        name,
        slug,
        owner_id,
        email,
        status,
        plan,
        country,
        currency,
        timezone,
        plan_seats,
        created_at,
        updated_at
      ) VALUES (
        v_clinic_name,
        v_slug,
        NEW.id,
        NEW.email,
        'pending',  -- New clinics start as pending
        'free',     -- Default plan
        'KE',       -- Default country
        'KES',      -- Default currency
        'Africa/Nairobi',  -- Default timezone
        5,          -- Default plan seats
        NOW(),
        NOW()
      ) RETURNING id INTO v_clinic_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Failed to create clinic: %', SQLERRM;
    END;

    -- Create user profile linked to the new clinic
    BEGIN
      INSERT INTO public.users (
        id,
        clinic_id,
        email,
        full_name,
        role,
        status,
        created_at,
        updated_at
      ) VALUES (
        NEW.id,
        v_clinic_id,
        NEW.email,
        v_full_name,
        v_role,
        'active',  -- User is active but clinic is pending
        NOW(),
        NOW()
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Failed to create user profile: %', SQLERRM;
    END;

    -- Log the signup activity (non-blocking - if this fails, signup still succeeds)
    BEGIN
      INSERT INTO public.activities (
        clinic_id,
        user_id,
        activity_type,
        title,
        description,
        created_at
      ) VALUES (
        v_clinic_id,
        NEW.id,
        'clinic_signup',
        'New Clinic Registration',
        'Clinic "' || v_clinic_name || '" registered and awaiting approval',
        NOW()
      );
    EXCEPTION WHEN OTHERS THEN
      -- Log warning but don't fail the signup
      RAISE WARNING 'Failed to create activity log for clinic signup: %', SQLERRM;
    END;

  ELSE
    -- If no clinic_name, this might be a user being added to an existing clinic
    -- Just create the user profile without a clinic
    BEGIN
      INSERT INTO public.users (
        id,
        email,
        full_name,
        role,
        status,
        created_at,
        updated_at
      ) VALUES (
        NEW.id,
        NEW.email,
        v_full_name,
        v_role,
        'active',
        NOW(),
        NOW()
      ) ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to create user profile: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure function owner has proper permissions
ALTER FUNCTION public.handle_new_user_signup() OWNER TO postgres;

-- Grant execute permission to all necessary roles
GRANT EXECUTE ON FUNCTION public.handle_new_user_signup() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user_signup() TO anon;
GRANT EXECUTE ON FUNCTION public.handle_new_user_signup() TO service_role;

-- Create trigger on auth.users table
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_signup();

-- ============================================================
-- PART 2: RLS HELPER FUNCTIONS - Ensure they exist and are SECURITY DEFINER
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
    WHERE id = auth.uid() AND (role = 'super_admin' OR role = 'SuperAdmin')
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
    AND role IN ('admin', 'super_admin', 'Admin', 'SuperAdmin')
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

-- Grant execute permissions on all helper functions
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_clinic_id() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_or_super_admin() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated, anon, service_role;

-- ============================================================
-- PART 3: RLS POLICIES - Ensure Super Admin can read everything
-- ============================================================

-- Enable RLS on tables if not already enabled
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Drop existing policies that might cause issues
DROP POLICY IF EXISTS "Super admins can read all users" ON public.users;
DROP POLICY IF EXISTS "super_admins_read_all_users" ON public.users;
DROP POLICY IF EXISTS "Clinic admins can read clinic users" ON public.users;
DROP POLICY IF EXISTS "admins_read_clinic_users" ON public.users;
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "users_read_own" ON public.users;

DROP POLICY IF EXISTS "Super admins can read all clinics" ON public.clinics;
DROP POLICY IF EXISTS "clinics_read_all_super_admin" ON public.clinics;
DROP POLICY IF EXISTS "clinics_super_admin_all" ON public.clinics;
DROP POLICY IF EXISTS "Users can read own clinic" ON public.clinics;
DROP POLICY IF EXISTS "clinics_users_read_own" ON public.clinics;
DROP POLICY IF EXISTS "Clinic admins can update own clinic" ON public.clinics;
DROP POLICY IF EXISTS "clinics_users_update_own" ON public.clinics;
DROP POLICY IF EXISTS "clinic_admins_update_own" ON public.clinics;

-- USERS TABLE POLICIES

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

-- Users can read their own profile
CREATE POLICY "Users can read own profile" ON public.users
  FOR SELECT
  USING (id = auth.uid());

-- CLINICS TABLE POLICIES

-- Super admins can read all clinics (using SECURITY DEFINER function)
CREATE POLICY "Super admins can read all clinics" ON public.clinics
  FOR SELECT
  USING (public.is_super_admin());

-- Users can read their own clinic
CREATE POLICY "Users can read own clinic" ON public.clinics
  FOR SELECT
  USING (id = public.get_user_clinic_id());

-- Clinic admins can update their own clinic
CREATE POLICY "Clinic admins can update own clinic" ON public.clinics
  FOR UPDATE
  USING (
    id = public.get_user_clinic_id() 
    AND public.is_admin_or_super_admin()
  )
  WITH CHECK (
    id = public.get_user_clinic_id() 
    AND public.is_admin_or_super_admin()
  );

-- ============================================================
-- PART 4: SYSTEM INSERT POLICIES - Allow trigger to insert
-- ============================================================

-- Allow system inserts to clinics (for the trigger)
DROP POLICY IF EXISTS "System can insert clinics" ON public.clinics;
CREATE POLICY "System can insert clinics" ON public.clinics
  FOR INSERT
  WITH CHECK (true);

-- Allow system inserts to users (for the trigger)
DROP POLICY IF EXISTS "System can insert users" ON public.users;
CREATE POLICY "System can insert users" ON public.users
  FOR INSERT
  WITH CHECK (true);

-- Allow system inserts to activities (for the trigger)
DROP POLICY IF EXISTS "System can insert activities" ON public.activities;
CREATE POLICY "System can insert activities" ON public.activities
  FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- PART 5: GRANT PERMISSIONS
-- ============================================================

-- Grant necessary schema permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;

-- ============================================================
-- PART 6: VERIFICATION QUERIES
-- ============================================================

-- Verify trigger exists
SELECT 
  '✅ TRIGGER CHECK' as status,
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  CASE WHEN tgenabled = 'O' THEN '✅ Enabled' ELSE '❌ Disabled' END as is_enabled
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';

-- Verify function exists and is SECURITY DEFINER
SELECT 
  '✅ FUNCTION CHECK' as status,
  proname as function_name,
  CASE WHEN prosecdef THEN '✅ SECURITY DEFINER' ELSE '❌ Not SECURITY DEFINER' END as security_type
FROM pg_proc 
WHERE proname = 'handle_new_user_signup';

-- Verify helper functions exist
SELECT 
  '✅ HELPER FUNCTIONS' as status,
  proname as function_name,
  CASE WHEN prosecdef THEN '✅ SECURITY DEFINER' ELSE '❌ Not SECURITY DEFINER' END as security_type
FROM pg_proc 
WHERE proname IN ('is_super_admin', 'get_user_clinic_id', 'is_admin_or_super_admin', 'get_user_role')
ORDER BY proname;

-- Verify RLS policies exist
SELECT 
  '✅ RLS POLICIES' as status,
  tablename,
  policyname,
  cmd as operation
FROM pg_policies 
WHERE tablename IN ('clinics', 'users')
  AND (policyname LIKE '%super%admin%' OR policyname LIKE '%clinic%admin%' OR policyname LIKE '%System%')
ORDER BY tablename, policyname;

-- ============================================================
-- COMPLETE
-- ============================================================
-- This migration ensures:
-- 1. ✅ Signup trigger exists and is properly configured
-- 2. ✅ RLS helper functions are SECURITY DEFINER (no recursion)
-- 3. ✅ Super Admin can read all clinics and users
-- 4. ✅ System can insert clinics/users/activities (for trigger)
-- 5. ✅ All permissions are properly granted
-- ============================================================
