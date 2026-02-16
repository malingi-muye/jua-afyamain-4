-- ============================================================
-- COMPREHENSIVE DATABASE VERIFICATION SCRIPT
-- Run this in Supabase SQL Editor to verify all critical components
-- ============================================================

-- ============================================================
-- 1. CHECK TRIGGER EXISTS AND IS ACTIVE
-- ============================================================
SELECT 
  'TRIGGER CHECK' as check_type,
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  tgenabled as is_enabled,
  CASE 
    WHEN tgenabled = 'O' THEN '✅ Enabled'
    WHEN tgenabled = 'D' THEN '❌ Disabled'
    ELSE '⚠️ Unknown'
  END as status
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';

-- Also check the function exists
SELECT 
  'FUNCTION CHECK' as check_type,
  proname as function_name,
  prokind as function_type,
  CASE 
    WHEN prosecdef THEN '✅ SECURITY DEFINER'
    ELSE '❌ Not SECURITY DEFINER'
  END as security_type
FROM pg_proc 
WHERE proname = 'handle_new_user_signup';

-- ============================================================
-- 2. CHECK RLS POLICIES ON CLINICS TABLE
-- ============================================================
SELECT 
  'CLINICS RLS POLICIES' as check_type,
  policyname,
  cmd as operation,
  roles,
  CASE 
    WHEN qual IS NOT NULL THEN '✅ Has USING clause'
    ELSE '⚠️ No USING clause'
  END as has_using,
  CASE 
    WHEN with_check IS NOT NULL THEN '✅ Has WITH CHECK'
    ELSE '⚠️ No WITH CHECK'
  END as has_with_check
FROM pg_policies 
WHERE tablename = 'clinics'
ORDER BY policyname;

-- ============================================================
-- 3. CHECK RLS POLICIES ON USERS TABLE
-- ============================================================
SELECT 
  'USERS RLS POLICIES' as check_type,
  policyname,
  cmd as operation,
  roles,
  CASE 
    WHEN qual IS NOT NULL THEN '✅ Has USING clause'
    ELSE '⚠️ No USING clause'
  END as has_using,
  CASE 
    WHEN with_check IS NOT NULL THEN '✅ Has WITH CHECK'
    ELSE '⚠️ No WITH CHECK'
  END as has_with_check
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY policyname;

-- ============================================================
-- 4. CHECK SUPER ADMIN HELPER FUNCTIONS
-- ============================================================
SELECT 
  'HELPER FUNCTIONS' as check_type,
  proname as function_name,
  CASE 
    WHEN prosecdef THEN '✅ SECURITY DEFINER'
    ELSE '❌ Not SECURITY DEFINER'
  END as security_type,
  proargnames as parameters
FROM pg_proc 
WHERE proname IN ('is_super_admin', 'get_user_clinic_id', 'is_admin_or_super_admin', 'get_user_role')
ORDER BY proname;

-- ============================================================
-- 5. CHECK PENDING CLINICS
-- ============================================================
SELECT 
  'PENDING CLINICS' as check_type,
  id,
  name,
  status,
  email,
  owner_id,
  created_at,
  CASE 
    WHEN status = 'pending' OR LOWER(status) = 'pending' THEN '✅ Pending status'
    ELSE '⚠️ Not pending: ' || status
  END as status_check
FROM public.clinics 
WHERE LOWER(status) = 'pending'
ORDER BY created_at DESC;

-- Count by status
SELECT 
  'CLINIC STATUS COUNT' as check_type,
  status,
  COUNT(*) as count,
  CASE 
    WHEN LOWER(status) = 'pending' THEN '✅ Should appear in approvals'
    WHEN LOWER(status) = 'active' THEN '✅ Active clinic'
    ELSE '⚠️ Other status'
  END as note
FROM public.clinics
GROUP BY status
ORDER BY status;

-- ============================================================
-- 6. CHECK RECENT SIGNUPS (Last 24 hours)
-- ============================================================
SELECT 
  'RECENT SIGNUPS' as check_type,
  au.id as auth_user_id,
  au.email,
  au.created_at as auth_created_at,
  pu.id as profile_user_id,
  pu.full_name,
  pu.role,
  pu.clinic_id,
  c.id as clinic_id,
  c.name as clinic_name,
  c.status as clinic_status,
  CASE 
    WHEN pu.id IS NULL THEN '❌ No user profile created'
    WHEN c.id IS NULL THEN '❌ No clinic created'
    WHEN c.status = 'pending' OR LOWER(c.status) = 'pending' THEN '✅ Complete - Pending approval'
    ELSE '⚠️ Complete - Status: ' || c.status
  END as signup_status
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
LEFT JOIN public.clinics c ON pu.clinic_id = c.id
WHERE au.created_at > NOW() - INTERVAL '24 hours'
ORDER BY au.created_at DESC;

-- ============================================================
-- 7. CHECK RLS IS ENABLED ON TABLES
-- ============================================================
SELECT 
  'RLS ENABLED CHECK' as check_type,
  schemaname,
  tablename,
  CASE 
    WHEN rowsecurity THEN '✅ RLS Enabled'
    ELSE '❌ RLS Disabled'
  END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('clinics', 'users', 'activities')
ORDER BY tablename;

-- ============================================================
-- 8. CHECK SUPER ADMIN USER EXISTS
-- ============================================================
SELECT 
  'SUPER ADMIN CHECK' as check_type,
  u.id,
  u.email,
  u.full_name,
  u.role,
  CASE 
    WHEN u.role = 'super_admin' OR u.role = 'SuperAdmin' THEN '✅ Super Admin found'
    ELSE '⚠️ Not Super Admin'
  END as admin_status
FROM public.users u
WHERE u.role IN ('super_admin', 'SuperAdmin')
LIMIT 5;

-- ============================================================
-- 9. TEST QUERY: Simulate getAllClinics() for Super Admin
-- ============================================================
-- This simulates what getAllClinics() should return
SELECT 
  'GETALLCLINICS TEST' as check_type,
  c.id,
  c.name,
  c.status,
  c.email,
  c.created_at,
  COUNT(DISTINCT u.id) as user_count,
  json_agg(
    json_build_object(
      'full_name', u.full_name,
      'role', u.role
    )
  ) FILTER (WHERE u.id IS NOT NULL) as users
FROM public.clinics c
LEFT JOIN public.users u ON u.clinic_id = c.id
GROUP BY c.id, c.name, c.status, c.email, c.created_at
ORDER BY c.created_at DESC
LIMIT 10;

-- ============================================================
-- 10. SUMMARY REPORT
-- ============================================================
SELECT 
  'SUMMARY' as check_type,
  'Total Clinics' as metric,
  COUNT(*)::text as value
FROM public.clinics
UNION ALL
SELECT 
  'SUMMARY' as check_type,
  'Pending Clinics' as metric,
  COUNT(*)::text as value
FROM public.clinics WHERE LOWER(status) = 'pending'
UNION ALL
SELECT 
  'SUMMARY' as check_type,
  'Active Clinics' as metric,
  COUNT(*)::text as value
FROM public.clinics WHERE LOWER(status) = 'active'
UNION ALL
SELECT 
  'SUMMARY' as check_type,
  'Total Users' as metric,
  COUNT(*)::text as value
FROM public.users
UNION ALL
SELECT 
  'SUMMARY' as check_type,
  'Super Admins' as metric,
  COUNT(*)::text as value
FROM public.users WHERE role IN ('super_admin', 'SuperAdmin');
