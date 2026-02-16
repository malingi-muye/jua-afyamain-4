-- Test if signup is actually working now
-- Run this to verify the trigger works during actual signup

-- Check recent signups
SELECT 
  'Recent Auth Users' as check_type,
  id,
  email,
  created_at,
  raw_user_meta_data->>'clinic_name' as clinic_name,
  raw_user_meta_data->>'full_name' as full_name
FROM auth.users
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 5;

-- Check if profiles were created for recent users
SELECT 
  'User Profiles' as check_type,
  u.id,
  u.email,
  u.full_name,
  u.clinic_id,
  c.name as clinic_name,
  c.status as clinic_status
FROM public.users u
LEFT JOIN public.clinics c ON u.clinic_id = c.id
WHERE u.created_at > NOW() - INTERVAL '1 hour'
ORDER BY u.created_at DESC
LIMIT 5;

-- Check if clinics were created for recent signups
SELECT 
  'Clinics Created' as check_type,
  c.id,
  c.name,
  c.slug,
  c.status,
  c.owner_id,
  au.email as owner_email
FROM public.clinics c
LEFT JOIN auth.users au ON c.owner_id = au.id
WHERE c.created_at > NOW() - INTERVAL '1 hour'
ORDER BY c.created_at DESC
LIMIT 5;

-- Summary: Check if trigger is working
SELECT 
  'Summary' as check_type,
  (SELECT COUNT(*) FROM auth.users WHERE created_at > NOW() - INTERVAL '1 hour') as auth_users_created,
  (SELECT COUNT(*) FROM public.users WHERE created_at > NOW() - INTERVAL '1 hour') as profiles_created,
  (SELECT COUNT(*) FROM public.clinics WHERE created_at > NOW() - INTERVAL '1 hour') as clinics_created,
  CASE 
    WHEN (SELECT COUNT(*) FROM auth.users WHERE created_at > NOW() - INTERVAL '1 hour') > 0
     AND (SELECT COUNT(*) FROM public.users WHERE created_at > NOW() - INTERVAL '1 hour') > 0
    THEN '✓ Trigger appears to be working'
    ELSE '✗ Trigger may not be working - try signing up and run this again'
  END as status;
