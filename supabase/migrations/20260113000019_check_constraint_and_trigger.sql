-- Quick diagnostic: Check what's actually in the database
-- Run this FIRST to see the current state

-- 1. Check what the constraint actually allows
SELECT 
  'Constraint Check' as check_type,
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.users'::regclass
  AND conname LIKE '%role%check%';

-- 2. Check if trigger exists
SELECT 
  'Trigger Check' as check_type,
  tgname as trigger_name,
  CASE WHEN tgenabled = 'O' THEN 'Enabled' ELSE 'Disabled' END as status
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';

-- 3. Check function exists and show first 500 chars of definition
SELECT 
  'Function Check' as check_type,
  proname as function_name,
  prosecdef as is_security_definer,
  substring(pg_get_functiondef(oid), 1, 500) as function_preview
FROM pg_proc
WHERE proname = 'handle_new_user_signup';

-- 4. Check what roles currently exist
SELECT 
  'Current Roles' as check_type,
  role,
  COUNT(*) as count
FROM public.users
GROUP BY role
ORDER BY role;
