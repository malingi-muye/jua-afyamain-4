-- ============================================================
-- SECURE OPERATIONAL TABLES - Multitenancy RLS
-- This migration ensures all clinic data is isolated by clinic_id
-- ============================================================

-- Enable RLS on all operational tables
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;

-- 1. PATIENTS - Isolation by clinic_id
DROP POLICY IF EXISTS "Clinic users can view their patients" ON public.patients;
CREATE POLICY "Clinic users can view their patients" ON public.patients
  FOR SELECT USING (clinic_id = public.get_user_clinic_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Clinic users can insert their patients" ON public.patients;
CREATE POLICY "Clinic users can insert their patients" ON public.patients
  FOR INSERT WITH CHECK (clinic_id = public.get_user_clinic_id());

DROP POLICY IF EXISTS "Clinic users can update their patients" ON public.patients;
CREATE POLICY "Clinic users can update their patients" ON public.patients
  FOR UPDATE USING (clinic_id = public.get_user_clinic_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Clinic users can delete their patients" ON public.patients;
CREATE POLICY "Clinic users can delete their patients" ON public.patients
  FOR DELETE USING (clinic_id = public.get_user_clinic_id() OR public.is_super_admin());

-- 2. APPOINTMENTS - Isolation by clinic_id
DROP POLICY IF EXISTS "Clinic users can view their appointments" ON public.appointments;
CREATE POLICY "Clinic users can view their appointments" ON public.appointments
  FOR SELECT USING (clinic_id = public.get_user_clinic_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Clinic users can manage their appointments" ON public.appointments;
CREATE POLICY "Clinic users can manage their appointments" ON public.appointments
  FOR ALL USING (clinic_id = public.get_user_clinic_id() OR public.is_super_admin());

-- 3. VISITS - Isolation by clinic_id
DROP POLICY IF EXISTS "Clinic users can view their visits" ON public.visits;
CREATE POLICY "Clinic users can view their visits" ON public.visits
  FOR SELECT USING (clinic_id = public.get_user_clinic_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Clinic users can manage their visits" ON public.visits;
CREATE POLICY "Clinic users can manage their visits" ON public.visits
  FOR ALL USING (clinic_id = public.get_user_clinic_id() OR public.is_super_admin());

-- 4. INVENTORY - Isolation by clinic_id
DROP POLICY IF EXISTS "Clinic users can view their inventory" ON public.inventory;
CREATE POLICY "Clinic users can view their inventory" ON public.inventory
  FOR SELECT USING (clinic_id = public.get_user_clinic_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Clinic users can manage their inventory" ON public.inventory;
CREATE POLICY "Clinic users can manage their inventory" ON public.inventory
  FOR ALL USING (clinic_id = public.get_user_clinic_id() OR public.is_super_admin());

-- 5. SUPPLIERS - Isolation by clinic_id
DROP POLICY IF EXISTS "Clinic users can view their suppliers" ON public.suppliers;
CREATE POLICY "Clinic users can view their suppliers" ON public.suppliers
  FOR SELECT USING (clinic_id = public.get_user_clinic_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Clinic users can manage their suppliers" ON public.suppliers;
CREATE POLICY "Clinic users can manage their suppliers" ON public.suppliers
  FOR ALL USING (clinic_id = public.get_user_clinic_id() OR public.is_super_admin());

-- 6. INVENTORY LOGS - Isolation by clinic_id
DROP POLICY IF EXISTS "Clinic users can view their inventory logs" ON public.inventory_logs;
CREATE POLICY "Clinic users can view their inventory logs" ON public.inventory_logs
  FOR SELECT USING (clinic_id = public.get_user_clinic_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "System can insert inventory logs" ON public.inventory_logs;
CREATE POLICY "System can insert inventory logs" ON public.inventory_logs
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- VERIFICATION
-- ============================================================
SELECT 
  tablename, 
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('patients', 'appointments', 'visits', 'inventory', 'suppliers', 'inventory_logs');
