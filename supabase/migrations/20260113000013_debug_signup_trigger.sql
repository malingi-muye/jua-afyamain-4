-- Debug signup trigger - Check if trigger exists and verify function
-- Run this to diagnose signup issues

-- 1. Check if trigger exists
SELECT 
  'Trigger Check' as check_type,
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  CASE WHEN tgenabled = 'O' THEN 'Enabled' ELSE 'Disabled' END as status,
  proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname = 'on_auth_user_created';

-- 2. Check if function exists and its definition
SELECT 
  'Function Check' as check_type,
  proname as function_name,
  prosecdef as is_security_definer,
  proconfig as config,
  pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'handle_new_user_signup';

-- 3. Check recent auth.users to see if they're being created
SELECT 
  'Recent Auth Users' as check_type,
  id,
  email,
  created_at,
  raw_user_meta_data->>'clinic_name' as clinic_name,
  raw_user_meta_data->>'full_name' as full_name,
  raw_user_meta_data->>'role' as role
FROM auth.users
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 5;

-- 4. Check if clinics table has the required columns
SELECT 
  'Clinics Table Schema' as check_type,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'clinics'
  AND column_name IN ('id', 'name', 'slug', 'owner_id', 'email', 'status', 'plan', 'country', 'currency', 'timezone', 'plan_seats')
ORDER BY ordinal_position;

-- 5. Check RLS policies that might block the trigger
SELECT 
  'RLS Policies on Clinics' as check_type,
  policyname,
  cmd as operation,
  roles,
  qual as using_clause,
  with_check
FROM pg_policies
WHERE tablename = 'clinics'
ORDER BY policyname;

-- 6. Check for system insert policy
SELECT 
  'System Insert Policy Check' as check_type,
  policyname,
  cmd as operation,
  qual as using_clause,
  with_check
FROM pg_policies
WHERE tablename = 'clinics'
  AND policyname LIKE '%System%insert%' OR policyname LIKE '%system%insert%';

-- 7. Test if trigger function can be called (will show errors if any)
DO $$
DECLARE
  test_result TEXT;
BEGIN
  -- Try to call the function (it will fail because NEW doesn't exist, but we'll see the error)
  RAISE NOTICE 'Testing if function can be parsed...';
  PERFORM public.handle_new_user_signup();
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Expected error (NEW doesn''t exist): %', SQLERRM;
END $$;
