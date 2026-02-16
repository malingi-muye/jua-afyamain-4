-- Check if the clinic was actually created and verify the data
-- Run this to see what's in the database

-- 1. Check recent clinics
SELECT 
  'Recent Clinics' as check_type,
  id,
  name,
  slug,
  status,
  owner_id,
  email,
  created_at
FROM public.clinics
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- 2. Check if owner exists in auth.users
SELECT 
  'Clinic Owners' as check_type,
  c.id as clinic_id,
  c.name as clinic_name,
  c.status as clinic_status,
  c.owner_id,
  au.id as auth_user_id,
  au.email as owner_email,
  au.created_at as owner_created_at
FROM public.clinics c
LEFT JOIN auth.users au ON c.owner_id = au.id
WHERE c.created_at > NOW() - INTERVAL '24 hours'
ORDER BY c.created_at DESC;

-- 3. Check if user profiles were created
SELECT 
  'User Profiles' as check_type,
  u.id,
  u.email,
  u.full_name,
  u.role,
  u.clinic_id,
  u.status as user_status,
  c.name as clinic_name,
  c.status as clinic_status
FROM public.users u
LEFT JOIN public.clinics c ON u.clinic_id = c.id
WHERE u.created_at > NOW() - INTERVAL '24 hours'
ORDER BY u.created_at DESC;

-- 4. Test the exact query that getAllClinics uses
SELECT 
  'getAllClinics Query Test' as check_type,
  c.id,
  c.name,
  c.status,
  c.email,
  c.created_at,
  json_agg(json_build_object('full_name', u.full_name, 'role', u.role)) as users
FROM public.clinics c
LEFT JOIN public.users u ON u.clinic_id = c.id
WHERE c.created_at > NOW() - INTERVAL '24 hours'
GROUP BY c.id, c.name, c.status, c.email, c.created_at
ORDER BY c.created_at DESC;

-- 5. Check RLS policies for Super Admin
SELECT 
  'RLS Policies for Clinics' as check_type,
  policyname,
  cmd as operation,
  roles,
  qual as using_clause,
  with_check
FROM pg_policies 
WHERE tablename = 'clinics'
ORDER BY policyname;
