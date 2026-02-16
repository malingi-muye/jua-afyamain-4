-- Quick diagnostic to see what's actually configured
-- Run this FIRST to see the current state

-- 1. Check if trigger exists and is enabled
SELECT 
  'Trigger Status' as check_type,
  tgname as name,
  CASE WHEN tgenabled = 'O' THEN 'Enabled' ELSE 'Disabled' END as status,
  tgrelid::regclass as table_name
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';

-- 2. Check if function exists
SELECT 
  'Function Status' as check_type,
  proname as name,
  CASE WHEN prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END as security_type,
  proowner::regrole as owner
FROM pg_proc 
WHERE proname = 'handle_new_user_signup';

-- 3. Check RLS policies for clinics
SELECT 
  'Clinics RLS Policies' as check_type,
  policyname,
  cmd as operation,
  CASE WHEN with_check = 'true' THEN 'Allows' ELSE 'Restricts' END as policy_type
FROM pg_policies 
WHERE tablename = 'clinics' AND cmd = 'INSERT';

-- 4. Check RLS policies for users
SELECT 
  'Users RLS Policies' as check_type,
  policyname,
  cmd as operation,
  CASE WHEN with_check = 'true' THEN 'Allows' ELSE 'Restricts' END as policy_type
FROM pg_policies 
WHERE tablename = 'users' AND cmd = 'INSERT';

-- 5. Check table structure - required NOT NULL columns
SELECT 
  'Table Structure' as check_type,
  table_name,
  column_name,
  is_nullable,
  column_default,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name IN ('clinics', 'users')
  AND is_nullable = 'NO'
ORDER BY table_name, ordinal_position;

-- 6. Test direct insert (simulating what trigger should do)
-- This will show the ACTUAL error if there is one
DO $$
DECLARE
  test_user_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
  test_email TEXT := 'diagnostic-test@example.com';
  test_clinic_name TEXT := 'Diagnostic Test Clinic';
  test_slug TEXT := 'diagnostic-test-clinic-' || substring(gen_random_uuid()::text from 1 for 8);
  test_clinic_id UUID;
BEGIN
  RAISE NOTICE '=== Starting Direct Insert Test ===';
  
  -- Try to create clinic
  BEGIN
    INSERT INTO public.clinics (
      name, slug, owner_id, email, status, plan, country, currency, timezone, plan_seats
    ) VALUES (
      test_clinic_name, test_slug, test_user_id, test_email, 'pending', 'free', 'KE', 'KES', 'Africa/Nairobi', 5
    ) RETURNING id INTO test_clinic_id;
    
    RAISE NOTICE '✓ Clinic insert SUCCESSFUL: %', test_clinic_id;
    
    -- Clean up
    DELETE FROM public.clinics WHERE id = test_clinic_id;
    RAISE NOTICE '✓ Cleanup successful';
    
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION '✗ Clinic insert FAILED: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
  END;
  
  RAISE NOTICE '=== Direct Insert Test PASSED ===';
  
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION '=== Direct Insert Test FAILED: % (SQLSTATE: %) ===', SQLERRM, SQLSTATE;
END $$;
