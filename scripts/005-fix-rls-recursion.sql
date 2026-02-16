-- Fix RLS Infinite Recursion Issue
-- This script creates helper functions and fixes policies to prevent recursion
-- Run this AFTER running scripts/003-setup-rls-policies.sql

-- ============================================================
-- STEP 1: Create Security Definer Functions
-- These functions bypass RLS to check user roles
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

-- ============================================================
-- STEP 2: Drop and Recreate Users Policies (No Recursion)
-- ============================================================

-- Drop existing problematic policies (from both 003 and 001 scripts)
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Super admins can read all users" ON public.users;
DROP POLICY IF EXISTS "Clinic admins can read clinic users" ON public.users;
DROP POLICY IF EXISTS "Users can view clinic members" ON public.users;
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Clinic admins can manage users" ON public.users;

-- Allow users to read their own profile (simple, no recursion)
CREATE POLICY "Users can read own profile" ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE
  USING (auth.uid() = id);

-- Allow users to insert their own profile (for signup)
CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Super admins can read all users (using security definer function - no recursion)
CREATE POLICY "Super admins can read all users" ON public.users
  FOR SELECT
  USING (public.is_super_admin());

-- Clinic admins can read users in their clinic (using security definer function)
CREATE POLICY "Clinic admins can read clinic users" ON public.users
  FOR SELECT
  USING (
    -- User must be in the same clinic
    clinic_id IS NOT NULL 
    AND clinic_id = public.get_user_clinic_id()
    -- And must be admin or super_admin
    AND public.is_admin_or_super_admin()
  );

-- ============================================================
-- STEP 3: Fix Clinics Policies
-- ============================================================

DROP POLICY IF EXISTS "Users can read own clinic" ON public.clinics;
DROP POLICY IF EXISTS "Users can update own clinic" ON public.clinics;
DROP POLICY IF EXISTS "Super admins can read all clinics" ON public.clinics;

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
  );

-- Super admins can read all clinics
CREATE POLICY "Super admins can read all clinics" ON public.clinics
  FOR SELECT
  USING (public.is_super_admin());

-- ============================================================
-- STEP 4: Fix Other Table Policies (Use Helper Functions)
-- ============================================================

-- Patients
DROP POLICY IF EXISTS "Users can read clinic patients" ON public.patients;
DROP POLICY IF EXISTS "Users can manage clinic patients" ON public.patients;

CREATE POLICY "Users can read clinic patients" ON public.patients
  FOR SELECT
  USING (clinic_id = public.get_user_clinic_id());

CREATE POLICY "Users can manage clinic patients" ON public.patients
  FOR ALL
  USING (clinic_id = public.get_user_clinic_id())
  WITH CHECK (clinic_id = public.get_user_clinic_id());

-- Appointments
DROP POLICY IF EXISTS "Users can read clinic appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users can manage clinic appointments" ON public.appointments;

CREATE POLICY "Users can read clinic appointments" ON public.appointments
  FOR SELECT
  USING (clinic_id = public.get_user_clinic_id());

CREATE POLICY "Users can manage clinic appointments" ON public.appointments
  FOR ALL
  USING (clinic_id = public.get_user_clinic_id())
  WITH CHECK (clinic_id = public.get_user_clinic_id());

-- Visits
DROP POLICY IF EXISTS "Users can read clinic visits" ON public.visits;
DROP POLICY IF EXISTS "Users can manage clinic visits" ON public.visits;

CREATE POLICY "Users can read clinic visits" ON public.visits
  FOR SELECT
  USING (clinic_id = public.get_user_clinic_id());

CREATE POLICY "Users can manage clinic visits" ON public.visits
  FOR ALL
  USING (clinic_id = public.get_user_clinic_id())
  WITH CHECK (clinic_id = public.get_user_clinic_id());

-- Inventory
DROP POLICY IF EXISTS "Users can read clinic inventory" ON public.inventory;
DROP POLICY IF EXISTS "Users can manage clinic inventory" ON public.inventory;

CREATE POLICY "Users can read clinic inventory" ON public.inventory
  FOR SELECT
  USING (clinic_id = public.get_user_clinic_id());

CREATE POLICY "Users can manage clinic inventory" ON public.inventory
  FOR ALL
  USING (clinic_id = public.get_user_clinic_id())
  WITH CHECK (clinic_id = public.get_user_clinic_id());

-- Audit Logs
DROP POLICY IF EXISTS "Users can read clinic audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Super admins can read all audit logs" ON public.audit_logs;

CREATE POLICY "Users can read clinic audit logs" ON public.audit_logs
  FOR SELECT
  USING (
    clinic_id = public.get_user_clinic_id()
    OR clinic_id IS NULL
  );

CREATE POLICY "Super admins can read all audit logs" ON public.audit_logs
  FOR SELECT
  USING (public.is_super_admin());

-- Activities
DROP POLICY IF EXISTS "Users can read clinic activities" ON public.activities;

CREATE POLICY "Users can read clinic activities" ON public.activities
  FOR SELECT
  USING (clinic_id = public.get_user_clinic_id());

-- ============================================================
-- Grant Execute Permissions
-- ============================================================

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_clinic_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_super_admin() TO authenticated;
