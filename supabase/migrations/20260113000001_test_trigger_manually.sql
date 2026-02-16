-- Manual test script to verify the trigger works
-- Run this AFTER applying the trigger fix
-- This simulates what happens during signup

DO $$
DECLARE
  test_user_id UUID := gen_random_uuid();
  test_email TEXT := 'test-' || substring(test_user_id::text from 1 for 8) || '@example.com';
  test_clinic_name TEXT := 'Test Clinic ' || substring(test_user_id::text from 1 for 8);
  test_full_name TEXT := 'Test User';
  test_role TEXT := 'admin';
  test_slug TEXT;
  test_clinic_id UUID;
  clinic_count INTEGER;
  user_count INTEGER;
BEGIN
  RAISE NOTICE '=== Starting Manual Trigger Test ===';
  RAISE NOTICE 'Test User ID: %', test_user_id;
  RAISE NOTICE 'Test Email: %', test_email;
  RAISE NOTICE 'Test Clinic Name: %', test_clinic_name;
  
  -- Generate slug (same logic as trigger)
  test_slug := lower(regexp_replace(test_clinic_name, '[^a-zA-Z0-9]+', '-', 'g'));
  test_slug := trim(both '-' from test_slug);
  
  IF test_slug IS NULL OR test_slug = '' THEN
    test_slug := 'clinic-' || substring(test_user_id::text from 1 for 8);
  END IF;
  
  RAISE NOTICE 'Generated Slug: %', test_slug;
  
  -- Test 1: Try creating clinic directly
  RAISE NOTICE '--- Test 1: Creating clinic directly ---';
  BEGIN
    INSERT INTO public.clinics (
      name, slug, owner_id, email, status, plan, country, currency, timezone, plan_seats
    ) VALUES (
      test_clinic_name, test_slug, test_user_id, test_email, 'pending', 'free', 'KE', 'KES', 'Africa/Nairobi', 5
    ) RETURNING id INTO test_clinic_id;
    
    RAISE NOTICE '✓ Clinic created successfully: %', test_clinic_id;
    
    -- Clean up
    DELETE FROM public.clinics WHERE id = test_clinic_id;
    RAISE NOTICE '✓ Clinic cleaned up';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION '✗ Clinic creation failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
  END;
  
  -- Test 2: Try creating user directly
  RAISE NOTICE '--- Test 2: Creating user directly ---';
  BEGIN
    -- First create clinic again for user test
    INSERT INTO public.clinics (
      name, slug, owner_id, email, status, plan, country, currency, timezone, plan_seats
    ) VALUES (
      test_clinic_name, test_slug, test_user_id, test_email, 'pending', 'free', 'KE', 'KES', 'Africa/Nairobi', 5
    ) RETURNING id INTO test_clinic_id;
    
    -- Now try creating user
    INSERT INTO public.users (
      id, clinic_id, email, full_name, role, status
    ) VALUES (
      test_user_id, test_clinic_id, test_email, test_full_name, test_role, 'active'
    );
    
    RAISE NOTICE '✓ User created successfully';
    
    -- Verify counts
    SELECT COUNT(*) INTO clinic_count FROM public.clinics WHERE id = test_clinic_id;
    SELECT COUNT(*) INTO user_count FROM public.users WHERE id = test_user_id;
    
    RAISE NOTICE '✓ Verification: Clinic count = %, User count = %', clinic_count, user_count;
    
    -- Clean up
    DELETE FROM public.users WHERE id = test_user_id;
    DELETE FROM public.clinics WHERE id = test_clinic_id;
    RAISE NOTICE '✓ Cleanup completed';
  EXCEPTION WHEN OTHERS THEN
    -- Try to clean up on error
    BEGIN
      DELETE FROM public.users WHERE id = test_user_id;
      DELETE FROM public.clinics WHERE id = test_clinic_id;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    RAISE EXCEPTION '✗ User creation failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
  END;
  
  -- Test 3: Check RLS policies
  RAISE NOTICE '--- Test 3: Checking RLS policies ---';
  SELECT COUNT(*) INTO clinic_count
  FROM pg_policies 
  WHERE tablename = 'clinics' AND policyname = 'System can insert clinics';
  
  SELECT COUNT(*) INTO user_count
  FROM pg_policies 
  WHERE tablename = 'users' AND policyname = 'System can insert users';
  
  IF clinic_count > 0 THEN
    RAISE NOTICE '✓ Clinic insert policy exists';
  ELSE
    RAISE WARNING '✗ Clinic insert policy missing!';
  END IF;
  
  IF user_count > 0 THEN
    RAISE NOTICE '✓ User insert policy exists';
  ELSE
    RAISE WARNING '✗ User insert policy missing!';
  END IF;
  
  -- Test 4: Check trigger exists
  RAISE NOTICE '--- Test 4: Checking trigger ---';
  SELECT COUNT(*) INTO clinic_count
  FROM pg_trigger 
  WHERE tgname = 'on_auth_user_created';
  
  IF clinic_count > 0 THEN
    RAISE NOTICE '✓ Trigger exists';
  ELSE
    RAISE WARNING '✗ Trigger missing!';
  END IF;
  
  -- Test 5: Check function exists
  RAISE NOTICE '--- Test 5: Checking function ---';
  SELECT COUNT(*) INTO clinic_count
  FROM pg_proc 
  WHERE proname = 'handle_new_user_signup' AND prosecdef = true;
  
  IF clinic_count > 0 THEN
    RAISE NOTICE '✓ Function exists and is SECURITY DEFINER';
  ELSE
    RAISE WARNING '✗ Function missing or not SECURITY DEFINER!';
  END IF;
  
  RAISE NOTICE '=== All Tests Completed ===';
  
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Test failed with error: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END $$;
