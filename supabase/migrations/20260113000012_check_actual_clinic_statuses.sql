-- Check actual clinic statuses in the database
-- Run this to see what statuses clinics actually have

-- 1. Check all clinics and their statuses
SELECT 
  'All Clinics' as check_type,
  id,
  name,
  status,
  LOWER(status) as status_lowercase,
  owner_id,
  email,
  created_at
FROM public.clinics
ORDER BY created_at DESC;

-- 2. Count clinics by status
SELECT 
  'Status Count' as check_type,
  status,
  COUNT(*) as count
FROM public.clinics
GROUP BY status
ORDER BY status;

-- 3. Check for pending clinics specifically
SELECT 
  'Pending Clinics' as check_type,
  id,
  name,
  status,
  LOWER(status) as status_lowercase,
  owner_id,
  email,
  created_at
FROM public.clinics
WHERE LOWER(status) = 'pending'
ORDER BY created_at DESC;

-- 4. Check recent signups (last 7 days)
SELECT 
  'Recent Signups' as check_type,
  c.id,
  c.name,
  c.status,
  LOWER(c.status) as status_lowercase,
  c.created_at as clinic_created_at,
  u.id as user_id,
  u.email as user_email,
  u.created_at as user_created_at
FROM public.clinics c
LEFT JOIN public.users u ON u.clinic_id = c.id
WHERE c.created_at > NOW() - INTERVAL '7 days'
ORDER BY c.created_at DESC;
