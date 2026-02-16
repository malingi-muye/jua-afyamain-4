-- Diagnostic script to check signup trigger and identify issues
-- Run this in Supabase SQL Editor to diagnose the signup 500 error

-- 1. Check if the trigger function exists
SELECT 
  proname as function_name,
  prosecdef as is_security_definer,
  proowner::regrole as owner,
  prosrc as function_source
FROM pg_proc 
WHERE proname = 'handle_new_user_signup';

-- 2. Check if the trigger exists
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  tgenabled as is_enabled,
  pg_get_triggerdef(oid) as trigger_definition
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';

-- 3. Check RLS policies on clinics table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'clinics';

-- 4. Check RLS policies on users table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'users';

-- 5. Check RLS policies on activities table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'activities';

-- 6. Check if tables exist and have correct structure
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name IN ('clinics', 'users', 'activities')
ORDER BY table_name, ordinal_position;

-- 7. Test the function with a dummy user (this will show the actual error)
-- NOTE: This is just for testing - don't run in production without understanding the impact
-- Uncomment to test:
/*
DO $$
DECLARE
  test_user_id UUID := gen_random_uuid();
  test_result RECORD;
BEGIN
  -- Simulate what the trigger does
  RAISE NOTICE 'Testing trigger logic...';
  
  -- This will show us if there are any constraint violations or other issues
  INSERT INTO public.clinics (
    name,
    slug,
    owner_id,
    email,
    status,
    plan,
    created_at,
    updated_at
  ) VALUES (
    'Test Clinic',
    'test-clinic-' || substring(test_user_id::text from 1 for 8),
    test_user_id,
    'test@example.com',
    'pending',
    'free',
    NOW(),
    NOW()
  );
  
  RAISE NOTICE 'Clinic insert successful';
  
  INSERT INTO public.users (
    id,
    clinic_id,
    email,
    full_name,
    role,
    status,
    created_at,
    updated_at
  ) VALUES (
    test_user_id,
    (SELECT id FROM public.clinics WHERE slug LIKE 'test-clinic-%' LIMIT 1),
    'test@example.com',
    'Test User',
    'admin',
    'active',
    NOW(),
    NOW()
  );
  
  RAISE NOTICE 'User insert successful';
  
  -- Clean up
  DELETE FROM public.users WHERE id = test_user_id;
  DELETE FROM public.clinics WHERE slug LIKE 'test-clinic-%';
  
  RAISE NOTICE 'Test completed successfully';
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error during test: % - %', SQLSTATE, SQLERRM;
END $$;
*/
