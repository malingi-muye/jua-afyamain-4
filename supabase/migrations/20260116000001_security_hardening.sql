-- SECURITY HARDENING MIGRATION
-- 1. Tighten RLS on clinics and users (Remove public INSERT)
-- 2. Prevent non-super_admins from inviting others as super_admins
-- 3. Secure Audit Logs and Activities

-- 1. HARDEN CLINICS RLS
-- Remove the weak "System can insert clinics" policy
DROP POLICY IF EXISTS "System can insert clinics" ON public.clinics;
-- The handle_new_user_signup trigger runs as SECURITY DEFINER (user: postgres)
-- and therefore DOES NOT NEED an RLS policy to insert.

-- 2. HARDEN USERS RLS
-- Remove the weak "System can insert users" policy
DROP POLICY IF EXISTS "System can insert users" ON public.users;

-- Users can update their own profile (limited fields should be checked at application level, but RLS covers the 'who')
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Super admins can update any user
DROP POLICY IF EXISTS "Super admins can update all users" ON public.users;
CREATE POLICY "Super admins can update all users" ON public.users
    FOR UPDATE USING (public.is_super_admin());

-- 3. HARDEN INVITATIONS
-- Prevent non-super-admins from creating/updating invitations with the 'super_admin' role
DROP POLICY IF EXISTS "Admins can create invitations" ON public.invitations;
CREATE POLICY "Admins can create invitations" ON public.invitations
    FOR INSERT WITH CHECK (
        clinic_id = (SELECT clinic_id FROM public.users WHERE id = auth.uid())
        AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'super_admin', 'Admin', 'SuperAdmin')
        AND (
            role NOT IN ('super_admin', 'SuperAdmin') 
            OR (SELECT role FROM public.users WHERE id = auth.uid()) IN ('super_admin', 'SuperAdmin')
        )
    );

DROP POLICY IF EXISTS "Admins can update invitations" ON public.invitations;
CREATE POLICY "Admins can update invitations" ON public.invitations
    FOR UPDATE USING (
        clinic_id = (SELECT clinic_id FROM public.users WHERE id = auth.uid())
        AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'super_admin', 'Admin', 'SuperAdmin')
    ) WITH CHECK (
        role NOT IN ('super_admin', 'SuperAdmin') 
        OR (SELECT role FROM public.users WHERE id = auth.uid()) IN ('super_admin', 'SuperAdmin')
    );

-- 4. SECURE AUDIT LOGS
-- Only allow service_role or trigger (which is service_role/postgres) to insert audit logs
-- Users should never be able to insert their own audit logs directly via client
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
-- No replacement needed if we want to block client-side inserts.
-- The trigger/backend will still work.

-- 5. SECURE ACTIVITIES
DROP POLICY IF EXISTS "System can insert activities" ON public.activities;
-- No replacement needed.

-- 6. ENSURE NO ANON ACCESS TO SENSITIVE TABLES
-- (Generally handled by lack of anon policies, but let's be explicit for critical ones)
REVOKE ALL ON public.medical_records FROM anon;
REVOKE ALL ON public.patients FROM anon;
REVOKE ALL ON public.transactions FROM anon;
REVOKE ALL ON public.audit_logs FROM anon;

-- Grant authenticated users only what they need (managed by RLS from here)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medical_records TO authenticated;
