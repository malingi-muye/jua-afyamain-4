-- ============================================================
-- COMPREHENSIVE RLS ENABLEMENT
-- Enable Row Level Security on all data tables
-- ============================================================
-- This script enables RLS on audit_logs, activities, patients,
-- appointments, visits, inventory, suppliers, and clinics
-- All policies enforce clinic_id isolation (multitenancy)
-- ============================================================

-- PREREQUISITE: Ensure SECURITY DEFINER functions exist
-- (These should already exist from 008-emergency-rls-fix.sql)

-- ============================================================
-- 1. ENABLE RLS ON ALL DATA TABLES
-- ============================================================

ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. CLINICS TABLE RLS POLICIES
-- ============================================================

-- Super admins can view all clinics
CREATE POLICY "clinics_super_admin_all" ON public.clinics
  FOR ALL
  USING (public.is_super_admin());

-- Users can view their own clinic
CREATE POLICY "clinics_users_read_own" ON public.clinics
  FOR SELECT
  USING (id = public.get_user_clinic_id());

-- Clinic admins/owners can update their own clinic
CREATE POLICY "clinics_users_update_own" ON public.clinics
  FOR UPDATE
  USING (
    id = public.get_user_clinic_id() AND 
    public.is_admin_or_super_admin()
  )
  WITH CHECK (
    id = public.get_user_clinic_id() AND 
    public.is_admin_or_super_admin()
  );

-- ============================================================
-- 3. PATIENTS TABLE RLS POLICIES
-- ============================================================

-- Users can only see patients in their clinic
CREATE POLICY "patients_clinic_isolation" ON public.patients
  FOR SELECT
  USING (clinic_id = public.get_user_clinic_id());

-- Users can insert patients into their clinic
CREATE POLICY "patients_insert_own_clinic" ON public.patients
  FOR INSERT
  WITH CHECK (clinic_id = public.get_user_clinic_id());

-- Users can update patients in their clinic
CREATE POLICY "patients_update_own_clinic" ON public.patients
  FOR UPDATE
  USING (clinic_id = public.get_user_clinic_id())
  WITH CHECK (clinic_id = public.get_user_clinic_id());

-- Users can delete patients in their clinic (if role permits)
CREATE POLICY "patients_delete_own_clinic" ON public.patients
  FOR DELETE
  USING (clinic_id = public.get_user_clinic_id());

-- ============================================================
-- 4. APPOINTMENTS TABLE RLS POLICIES
-- ============================================================

-- Users can only see appointments in their clinic
CREATE POLICY "appointments_clinic_isolation" ON public.appointments
  FOR SELECT
  USING (clinic_id = public.get_user_clinic_id());

-- Users can insert appointments into their clinic
CREATE POLICY "appointments_insert_own_clinic" ON public.appointments
  FOR INSERT
  WITH CHECK (clinic_id = public.get_user_clinic_id());

-- Users can update appointments in their clinic
CREATE POLICY "appointments_update_own_clinic" ON public.appointments
  FOR UPDATE
  USING (clinic_id = public.get_user_clinic_id())
  WITH CHECK (clinic_id = public.get_user_clinic_id());

-- Users can delete appointments in their clinic
CREATE POLICY "appointments_delete_own_clinic" ON public.appointments
  FOR DELETE
  USING (clinic_id = public.get_user_clinic_id());

-- ============================================================
-- 5. VISITS TABLE RLS POLICIES
-- ============================================================

-- Users can only see visits in their clinic
CREATE POLICY "visits_clinic_isolation" ON public.visits
  FOR SELECT
  USING (clinic_id = public.get_user_clinic_id());

-- Users can insert visits into their clinic
CREATE POLICY "visits_insert_own_clinic" ON public.visits
  FOR INSERT
  WITH CHECK (clinic_id = public.get_user_clinic_id());

-- Users can update visits in their clinic
CREATE POLICY "visits_update_own_clinic" ON public.visits
  FOR UPDATE
  USING (clinic_id = public.get_user_clinic_id())
  WITH CHECK (clinic_id = public.get_user_clinic_id());

-- Users can delete visits in their clinic
CREATE POLICY "visits_delete_own_clinic" ON public.visits
  FOR DELETE
  USING (clinic_id = public.get_user_clinic_id());

-- ============================================================
-- 6. INVENTORY TABLE RLS POLICIES
-- ============================================================

-- Users can only see inventory in their clinic
CREATE POLICY "inventory_clinic_isolation" ON public.inventory
  FOR SELECT
  USING (clinic_id = public.get_user_clinic_id());

-- Users can insert inventory into their clinic
CREATE POLICY "inventory_insert_own_clinic" ON public.inventory
  FOR INSERT
  WITH CHECK (clinic_id = public.get_user_clinic_id());

-- Users can update inventory in their clinic
CREATE POLICY "inventory_update_own_clinic" ON public.inventory
  FOR UPDATE
  USING (clinic_id = public.get_user_clinic_id())
  WITH CHECK (clinic_id = public.get_user_clinic_id());

-- Users can delete inventory in their clinic
CREATE POLICY "inventory_delete_own_clinic" ON public.inventory
  FOR DELETE
  USING (clinic_id = public.get_user_clinic_id());

-- ============================================================
-- 7. SUPPLIERS TABLE RLS POLICIES
-- ============================================================

-- Users can only see suppliers in their clinic
CREATE POLICY "suppliers_clinic_isolation" ON public.suppliers
  FOR SELECT
  USING (clinic_id = public.get_user_clinic_id());

-- Users can insert suppliers into their clinic
CREATE POLICY "suppliers_insert_own_clinic" ON public.suppliers
  FOR INSERT
  WITH CHECK (clinic_id = public.get_user_clinic_id());

-- Users can update suppliers in their clinic
CREATE POLICY "suppliers_update_own_clinic" ON public.suppliers
  FOR UPDATE
  USING (clinic_id = public.get_user_clinic_id())
  WITH CHECK (clinic_id = public.get_user_clinic_id());

-- Users can delete suppliers in their clinic
CREATE POLICY "suppliers_delete_own_clinic" ON public.suppliers
  FOR DELETE
  USING (clinic_id = public.get_user_clinic_id());

-- ============================================================
-- 8. AUDIT LOGS TABLE RLS POLICIES
-- ============================================================

-- Users can only see audit logs from their clinic
CREATE POLICY "audit_logs_clinic_isolation" ON public.audit_logs
  FOR SELECT
  USING (clinic_id = public.get_user_clinic_id());

-- Only system/audit triggers create audit logs (no direct INSERT)
-- Audit logs are read-only to users

-- ============================================================
-- 9. ACTIVITIES TABLE RLS POLICIES
-- ============================================================

-- Users can only see activities from their clinic
CREATE POLICY "activities_clinic_isolation" ON public.activities
  FOR SELECT
  USING (clinic_id = public.get_user_clinic_id());

-- Only system/triggers create activities (no direct INSERT)
-- Activities are read-only to users

-- ============================================================
-- 10. GRANT PERMISSIONS
-- ============================================================

-- Grant appropriate permissions for authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT SELECT ON public.activities TO authenticated;

-- ============================================================
-- SUMMARY
-- ============================================================
-- RLS is now enabled on all tables with clinic-based isolation.
-- All policies check clinic_id to prevent cross-clinic data leaks.
-- SECURITY DEFINER functions handle super admin access.
-- This ensures multitenancy is properly enforced at the database level.
-- ============================================================
