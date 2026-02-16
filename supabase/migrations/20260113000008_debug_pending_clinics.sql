-- Debug script to check pending clinics
-- Run this to see what's actually in the database

-- 1. Check all clinics and their statuses
SELECT 
  'All Clinics' as check_type,
  id,
  name,
  status,
  email,
  owner_id,
  created_at
FROM public.clinics
ORDER BY created_at DESC;

-- 2. Check specifically for pending clinics
SELECT 
  'Pending Clinics' as check_type,
  id,
  name,
  status,
  email,
  owner_id,
  created_at
FROM public.clinics
WHERE LOWER(status) = 'pending'
ORDER BY created_at DESC;

-- 3. Check the exact query that getAllClinics uses
SELECT 
  'getAllClinics Query Test' as check_type,
  c.id,
  c.name,
  c.status as db_status,
  CASE 
    WHEN LOWER(c.status) = 'active' THEN 'Active'
    WHEN LOWER(c.status) = 'pending' THEN 'Pending'
    ELSE 'Suspended'
  END as mapped_status,
  c.email,
  c.created_at,
  json_agg(json_build_object('full_name', u.full_name, 'role', u.role)) as users
FROM public.clinics c
LEFT JOIN public.users u ON u.clinic_id = c.id
GROUP BY c.id, c.name, c.status, c.email, c.created_at
ORDER BY c.created_at DESC;

-- 4. Count by status
SELECT 
  'Status Count' as check_type,
  status,
  COUNT(*) as count
FROM public.clinics
GROUP BY status
ORDER BY status;
