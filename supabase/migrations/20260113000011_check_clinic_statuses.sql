-- Quick diagnostic to check what statuses clinics actually have
-- Run this to see the real status values in the database

-- 1. Check all clinics and their statuses
SELECT 
  'All Clinics' as check_type,
  id,
  name,
  status as db_status,
  LOWER(status) as status_lowercase,
  created_at,
  owner_id
FROM public.clinics
ORDER BY created_at DESC;

-- 2. Count by status
SELECT 
  'Status Count' as check_type,
  status,
  LOWER(status) as status_lowercase,
  COUNT(*) as count
FROM public.clinics
GROUP BY status
ORDER BY status;

-- 3. Check specifically for pending (case-insensitive)
SELECT 
  'Pending Clinics (Case Insensitive)' as check_type,
  id,
  name,
  status,
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
  c.created_at,
  u.id as user_id,
  u.email,
  u.full_name,
  u.role
FROM public.clinics c
LEFT JOIN public.users u ON c.owner_id = u.id
WHERE c.created_at > NOW() - INTERVAL '7 days'
ORDER BY c.created_at DESC;
