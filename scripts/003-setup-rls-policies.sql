-- JuaAfya RLS Policies Setup
-- Run this script to set up Row Level Security policies
-- Safe to run multiple times - will drop and recreate policies

-- ============================================================
-- USERS TABLE POLICIES
-- ============================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Super admins can read all users" ON public.users;
DROP POLICY IF EXISTS "Clinic admins can read clinic users" ON public.users;

-- Allow users to read their own profile
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

-- Super admins can read all users
-- Use JWT claim to avoid recursion (role should be in user_metadata)
CREATE POLICY "Super admins can read all users" ON public.users
  FOR SELECT
  USING (
    (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'super_admin'
    OR id IN (
      SELECT id FROM public.users 
      WHERE id = auth.uid() 
      AND role = 'super_admin'
      LIMIT 1
    )
  );

-- Clinic admins can read users in their clinic
-- Simplified to avoid recursion - check own clinic_id directly
CREATE POLICY "Clinic admins can read clinic users" ON public.users
  FOR SELECT
  USING (
    -- User can read if they're in the same clinic
    clinic_id = (
      SELECT clinic_id FROM public.users 
      WHERE id = auth.uid() 
      LIMIT 1
    )
    -- And they're an admin or super_admin (check via JWT or direct query with limit)
    AND (
      (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' IN ('admin', 'super_admin')
      OR EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin')
        LIMIT 1
      )
    )
  );

-- ============================================================
-- CLINICS TABLE POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Users can read own clinic" ON public.clinics;
DROP POLICY IF EXISTS "Users can update own clinic" ON public.clinics;
DROP POLICY IF EXISTS "Super admins can read all clinics" ON public.clinics;

-- Users can read their own clinic
CREATE POLICY "Users can read own clinic" ON public.clinics
  FOR SELECT
  USING (
    id IN (
      SELECT clinic_id FROM public.users WHERE id = auth.uid()
    )
    OR owner_id = auth.uid()
  );

-- Clinic owners/admins can update their clinic
-- Simplified to avoid recursion
CREATE POLICY "Users can update own clinic" ON public.clinics
  FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR id IN (
      SELECT clinic_id FROM public.users 
      WHERE id = auth.uid() 
      AND clinic_id IS NOT NULL
      LIMIT 1
    )
  );

-- Super admins can read all clinics
-- Use JWT claim or direct query with LIMIT to avoid recursion
CREATE POLICY "Super admins can read all clinics" ON public.clinics
  FOR SELECT
  USING (
    (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'super_admin'
      LIMIT 1
    )
  );

-- ============================================================
-- PATIENTS TABLE POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Users can read clinic patients" ON public.patients;
DROP POLICY IF EXISTS "Users can manage clinic patients" ON public.patients;

-- Users can read patients in their clinic
-- Use LIMIT to avoid recursion
CREATE POLICY "Users can read clinic patients" ON public.patients
  FOR SELECT
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.users 
      WHERE id = auth.uid() 
      AND clinic_id IS NOT NULL
      LIMIT 1
    )
  );

-- Users can manage patients in their clinic
-- Use LIMIT to avoid recursion
CREATE POLICY "Users can manage clinic patients" ON public.patients
  FOR ALL
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.users 
      WHERE id = auth.uid() 
      AND clinic_id IS NOT NULL
      LIMIT 1
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM public.users 
      WHERE id = auth.uid() 
      AND clinic_id IS NOT NULL
      LIMIT 1
    )
  );

-- ============================================================
-- APPOINTMENTS TABLE POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Users can read clinic appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users can manage clinic appointments" ON public.appointments;

CREATE POLICY "Users can read clinic appointments" ON public.appointments
  FOR SELECT
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.users 
      WHERE id = auth.uid() 
      AND clinic_id IS NOT NULL
      LIMIT 1
    )
  );

CREATE POLICY "Users can manage clinic appointments" ON public.appointments
  FOR ALL
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.users 
      WHERE id = auth.uid() 
      AND clinic_id IS NOT NULL
      LIMIT 1
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM public.users 
      WHERE id = auth.uid() 
      AND clinic_id IS NOT NULL
      LIMIT 1
    )
  );

-- ============================================================
-- VISITS TABLE POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Users can read clinic visits" ON public.visits;
DROP POLICY IF EXISTS "Users can manage clinic visits" ON public.visits;

CREATE POLICY "Users can read clinic visits" ON public.visits
  FOR SELECT
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.users 
      WHERE id = auth.uid() 
      AND clinic_id IS NOT NULL
      LIMIT 1
    )
  );

CREATE POLICY "Users can manage clinic visits" ON public.visits
  FOR ALL
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.users 
      WHERE id = auth.uid() 
      AND clinic_id IS NOT NULL
      LIMIT 1
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM public.users 
      WHERE id = auth.uid() 
      AND clinic_id IS NOT NULL
      LIMIT 1
    )
  );

-- ============================================================
-- INVENTORY TABLE POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Users can read clinic inventory" ON public.inventory;
DROP POLICY IF EXISTS "Users can manage clinic inventory" ON public.inventory;

CREATE POLICY "Users can read clinic inventory" ON public.inventory
  FOR SELECT
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.users 
      WHERE id = auth.uid() 
      AND clinic_id IS NOT NULL
      LIMIT 1
    )
  );

CREATE POLICY "Users can manage clinic inventory" ON public.inventory
  FOR ALL
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.users 
      WHERE id = auth.uid() 
      AND clinic_id IS NOT NULL
      LIMIT 1
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM public.users 
      WHERE id = auth.uid() 
      AND clinic_id IS NOT NULL
      LIMIT 1
    )
  );

-- ============================================================
-- AUDIT LOGS TABLE POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Users can read clinic audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Super admins can read all audit logs" ON public.audit_logs;

CREATE POLICY "Users can read clinic audit logs" ON public.audit_logs
  FOR SELECT
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.users 
      WHERE id = auth.uid() 
      AND clinic_id IS NOT NULL
      LIMIT 1
    )
  );

CREATE POLICY "Super admins can read all audit logs" ON public.audit_logs
  FOR SELECT
  USING (
    (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'super_admin'
      LIMIT 1
    )
  );

-- ============================================================
-- ACTIVITIES TABLE POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Users can read clinic activities" ON public.activities;

CREATE POLICY "Users can read clinic activities" ON public.activities
  FOR SELECT
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.users 
      WHERE id = auth.uid() 
      AND clinic_id IS NOT NULL
      LIMIT 1
    )
  );
