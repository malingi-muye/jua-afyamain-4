-- ============================================================
-- SECURE REMAINING TABLES - Multitenancy & Platform Security
-- This migration secures any tables missed in previous rounds
-- ============================================================

-- 1. Enable RLS on all remaining tables
ALTER TABLE IF EXISTS public.medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.inbound_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.outbound_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.platform_settings ENABLE ROW LEVEL SECURITY;

-- 2. MEDICAL RECORDS - Clinic Isolation
DROP POLICY IF EXISTS "Clinic users can view their records" ON public.medical_records;
CREATE POLICY "Clinic users can view their records" ON public.medical_records
  FOR SELECT USING (clinic_id = public.get_user_clinic_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Clinic users can manage their records" ON public.medical_records;
CREATE POLICY "Clinic users can manage their records" ON public.medical_records
  FOR ALL USING (clinic_id = public.get_user_clinic_id() OR public.is_super_admin());

-- 3. TRANSACTIONS - Clinic Isolation
DROP POLICY IF EXISTS "Clinics can view their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Super admins can view all transactions" ON public.transactions;
DROP POLICY IF EXISTS "Clinics can view own transactions" ON public.transactions;
CREATE POLICY "Clinics can view own transactions" ON public.transactions
  FOR SELECT USING (clinic_id = public.get_user_clinic_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "System can manage transactions" ON public.transactions;
CREATE POLICY "System can manage transactions" ON public.transactions
  FOR ALL USING (public.is_super_admin());

-- 4. SUPPORT TICKETS - Clinic Isolation
DROP POLICY IF EXISTS "Clinics can view their own support tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Super admins can view all support tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Clinics can view own tickets" ON public.support_tickets;
CREATE POLICY "Clinics can view own tickets" ON public.support_tickets
  FOR SELECT USING (clinic_id = public.get_user_clinic_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Clinics can create support tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Clinics can create tickets" ON public.support_tickets;
CREATE POLICY "Clinics can create tickets" ON public.support_tickets
  FOR INSERT WITH CHECK (clinic_id = public.get_user_clinic_id());

DROP POLICY IF EXISTS "Clinics can update their own support tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Clinics can update own tickets" ON public.support_tickets;
CREATE POLICY "Clinics can update own tickets" ON public.support_tickets
  FOR UPDATE USING (clinic_id = public.get_user_clinic_id() OR public.is_super_admin());

-- 5. AUDIT LOGS - Clinic Isolation
DROP POLICY IF EXISTS "Users can view clinic audit logs" ON public.audit_logs;
CREATE POLICY "Users can view clinic audit logs" ON public.audit_logs
  FOR SELECT USING (clinic_id = public.get_user_clinic_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "System can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (true);

-- 6. ACTIVITIES - Clinic Isolation
DROP POLICY IF EXISTS "Users can view clinic activities" ON public.activities;
CREATE POLICY "Users can view clinic activities" ON public.activities
  FOR SELECT USING (clinic_id = public.get_user_clinic_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "System can insert activities" ON public.activities;
CREATE POLICY "System can insert activities" ON public.activities
  FOR INSERT WITH CHECK (true);

-- 7. MESSAGES (SMS/WhatsApp) - Clinic Isolation
DROP POLICY IF EXISTS "Clinic users can view their inbound messages" ON public.inbound_messages;
CREATE POLICY "Clinic users can view their inbound messages" ON public.inbound_messages
  FOR SELECT USING (clinic_id = public.get_user_clinic_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Clinic users can view their outbound messages" ON public.outbound_messages;
CREATE POLICY "Clinic users can view their outbound messages" ON public.outbound_messages
  FOR SELECT USING (clinic_id = public.get_user_clinic_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "System can manage messages" ON public.inbound_messages;
CREATE POLICY "System can manage messages" ON public.inbound_messages
  FOR ALL USING (public.is_super_admin());

DROP POLICY IF EXISTS "System can manage outbound messages" ON public.outbound_messages;
CREATE POLICY "System can manage outbound messages" ON public.outbound_messages
  FOR ALL USING (public.is_super_admin());

-- 8. NOTIFICATIONS - User specific
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS "Users can manage own notifications" ON public.notifications;
CREATE POLICY "Users can manage own notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "System can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

-- 9. PLATFORM SETTINGS - Public View, Super Admin Edit
DROP POLICY IF EXISTS "Anyone can view platform settings" ON public.platform_settings;
CREATE POLICY "Anyone can view platform settings" ON public.platform_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Super admins can update platform settings" ON public.platform_settings;
CREATE POLICY "Super admins can update platform settings" ON public.platform_settings
  FOR UPDATE USING (public.is_super_admin());

-- ============================================================
-- VERIFICATION
-- ============================================================
SELECT 
  tablename, 
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'medical_records', 'transactions', 'support_tickets', 
    'audit_logs', 'activities', 'inbound_messages', 
    'outbound_messages', 'notifications', 'platform_settings'
  );
