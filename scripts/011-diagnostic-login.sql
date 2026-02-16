-- ============================================================
-- DIAGNOSTIC: Complete Login Flow Verification
-- ============================================================
-- Run this script to verify all components are in place
-- for the authentication and redirect fix to work
-- ============================================================

\echo '=========================================='
\echo 'JuaAfya Authentication Diagnostic'
\echo '=========================================='

-- 1. Check if auth.users exists
\echo ''
\echo '1. Checking Supabase Auth Users...'
SELECT 
  COUNT(*) as total_auth_users,
  COUNT(*) FILTER (WHERE email LIKE '%superadmin%') as super_admin_count
FROM auth.users;

-- 2. Check if public.users table exists and has data
\echo ''
\echo '2. Checking public.users table...'
SELECT 
  COUNT(*) as total_users,
  COUNT(*) FILTER (WHERE role = 'super_admin') as super_admin_profiles,
  COUNT(*) FILTER (WHERE status = 'active') as active_users,
  COUNT(*) FILTER (WHERE clinic_id IS NULL) as clinic_less_users
FROM public.users;

-- 3. Check super admin specifically
\echo ''
\echo '3. Super Admin User Details...'
SELECT 
  u.id,
  u.email,
  u.full_name,
  u.role,
  u.status,
  u.clinic_id,
  u.created_at,
  u.updated_at,
  EXISTS(SELECT 1 FROM auth.users au WHERE au.id = u.id) as exists_in_auth
FROM public.users u
WHERE u.role = 'super_admin' OR u.email LIKE '%superadmin%'
LIMIT 5;

-- 4. Check RLS policies on users table
\echo ''
\echo '4. RLS Policies on users table...'
SELECT 
  policyname,
  permissive,
  qual as policy_condition
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;

-- 5. Check if SECURITY DEFINER functions exist
\echo ''
\echo '5. Security Definer Functions...'
SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
WHERE p.proname IN ('is_super_admin', 'get_user_clinic_id', 'is_admin_or_super_admin', 'get_user_role')
AND p.pronamespace = 'public'::regnamespace;

-- 6. Check clinics table
\echo ''
\echo '6. Clinics Table Status...'
SELECT 
  COUNT(*) as total_clinics,
  COUNT(*) FILTER (WHERE status = 'active') as active_clinics,
  COUNT(*) FILTER (WHERE owner_id IS NULL) as clinics_without_owner
FROM public.clinics;

-- 7. Check RLS status on all tables
\echo ''
\echo '7. RLS Status on All Tables...'
SELECT 
  t.tablename,
  CASE WHEN t.tablename = 'users' THEN 'ENABLED' ELSE 
    CASE WHEN EXISTS(SELECT 1 FROM pg_tables pt WHERE pt.tablename = t.tablename AND pt.schemaname = 'public') 
      AND EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid WHERE n.nspname = 'public' AND c.relname = t.tablename AND c.relrowsecurity = true) 
    THEN 'ENABLED' ELSE 'DISABLED' END 
  END as rls_status
FROM pg_tables t
WHERE t.schemaname = 'public'
AND t.tablename IN ('users', 'clinics', 'patients', 'appointments', 'visits', 'inventory', 'suppliers', 'audit_logs', 'activities')
ORDER BY t.tablename;

-- 8. Check session validity
\echo ''
\echo '8. Current Session Info...'
SELECT 
  auth.uid() as current_user_id,
  (SELECT email FROM auth.users WHERE id = auth.uid()) as current_user_email,
  (SELECT role FROM public.users WHERE id = auth.uid()) as current_user_role;

-- 9. Test RLS policy - can current user read themselves?
\echo ''
\echo '9. Testing RLS Read Permission (self)...'
SELECT 
  COUNT(*) as accessible_users
FROM public.users u
WHERE u.id = auth.uid();

-- 10. Summary
\echo ''
\echo '=========================================='
\echo 'Diagnostic Summary:'
\echo '=========================================='
\echo ''
\echo 'If you see data in sections 1-6, authentication setup is complete.'
\echo ''
\echo 'Critical Items to Check:'
\echo '  ✓ Section 3: Super admin user exists in both auth.users and public.users'
\echo '  ✓ Section 4: At least 4 RLS policies visible for users table'
\echo '  ✓ Section 5: At least 3 SECURITY DEFINER functions exist'
\echo '  ✓ Section 7: users table has ENABLED RLS'
\echo ''
\echo 'Next Steps:'
\echo '  1. If Super Admin missing from Section 3, run: scripts/010-init-super-admin.sql'
\echo '  2. If RLS missing from Section 4, run: scripts/008-emergency-rls-fix.sql'
\echo '  3. Try logging in again with full browser cache clear'
\echo ''
\echo '=========================================='
