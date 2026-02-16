-- IMMEDIATE FIX: Check actual constraint and fix trigger
-- Run this to see what the constraint actually allows and fix it

-- Step 1: Check what the constraint actually allows
SELECT 
  'Actual Constraint' as step,
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.users'::regclass
  AND conname LIKE '%role%check%';

-- Step 2: Check what roles currently exist in the database
SELECT 
  'Current Roles in DB' as step,
  role,
  COUNT(*) as count
FROM public.users
GROUP BY role
ORDER BY role;

-- Step 3: The constraint might be different than expected
-- Let's update the trigger to be more defensive and use 'doctor' always
-- OR we can update the constraint to allow 'admin'

-- Option A: Update constraint to explicitly allow all valid roles
-- (Only if constraint is missing 'admin')
ALTER TABLE public.users 
DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users 
ADD CONSTRAINT users_role_check 
CHECK (role IN ('super_admin', 'admin', 'doctor', 'nurse', 'receptionist', 'lab_tech', 'pharmacist', 'accountant'));

-- Step 4: Recreate trigger function with guaranteed valid role
DROP FUNCTION IF EXISTS public.handle_new_user_signup();

CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_clinic_id UUID;
  v_clinic_name TEXT;
  v_full_name TEXT;
  v_role TEXT;
  v_slug TEXT;
BEGIN
  -- Extract metadata from auth.users
  v_clinic_name := NEW.raw_user_meta_data->>'clinic_name';
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  
  -- ALWAYS use 'doctor' as default (guaranteed to be in constraint)
  -- Don't trust metadata role value - validate it first
  v_role := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'doctor');
  v_role := lower(replace(v_role, ' ', '_'));
  
  -- Validate and normalize - only use if it's in the allowed list
  IF v_role IN ('super_admin', 'admin', 'doctor', 'nurse', 'receptionist', 'lab_tech', 'pharmacist', 'accountant') THEN
    -- Role is valid, use it
    NULL; -- Keep v_role as is
  ELSE
    -- Role is invalid, use 'doctor' (guaranteed valid)
    v_role := 'doctor';
  END IF;

  -- Only process if clinic_name is provided (new clinic signup)
  IF v_clinic_name IS NOT NULL AND v_clinic_name != '' THEN
    -- Generate slug from clinic name
    v_slug := lower(regexp_replace(v_clinic_name, '[^a-zA-Z0-9]+', '-', 'g'));
    v_slug := trim(both '-' from v_slug);
    
    -- Ensure slug is not empty (fallback to user ID if needed)
    IF v_slug IS NULL OR v_slug = '' THEN
      v_slug := 'clinic-' || substring(NEW.id::text from 1 for 8);
    END IF;
    
    -- Make slug unique if it already exists
    WHILE EXISTS (SELECT 1 FROM public.clinics WHERE slug = v_slug) LOOP
      v_slug := v_slug || '-' || substring(gen_random_uuid()::text from 1 for 8);
    END LOOP;

    -- Create the clinic with 'pending' status (awaiting Super Admin approval)
    BEGIN
      INSERT INTO public.clinics (
        name,
        slug,
        owner_id,
        email,
        status,
        plan,
        country,
        currency,
        timezone,
        plan_seats,
        created_at,
        updated_at
      ) VALUES (
        v_clinic_name,
        v_slug,
        NEW.id,
        NEW.email,
        'pending',  -- New clinics start as pending
        'free',     -- Default plan
        'KE',       -- Default country
        'KES',      -- Default currency
        'Africa/Nairobi',  -- Default timezone
        5,          -- Default plan seats
        NOW(),
        NOW()
      ) RETURNING id INTO v_clinic_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Failed to create clinic: %', SQLERRM;
    END;

    -- Create user profile linked to the new clinic
    -- Use v_role which is guaranteed to be valid
    BEGIN
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
        NEW.id,
        v_clinic_id,
        NEW.email,
        v_full_name,
        v_role,  -- This is now guaranteed to be valid
        'active',  -- User is active but clinic is pending
        NOW(),
        NOW()
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Failed to create user profile: % (role attempted: %)', SQLERRM, v_role;
    END;

    -- Log the signup activity (non-blocking - if this fails, signup still succeeds)
    BEGIN
      INSERT INTO public.activities (
        clinic_id,
        user_id,
        activity_type,
        title,
        description,
        created_at
      ) VALUES (
        v_clinic_id,
        NEW.id,
        'clinic_signup',
        'New Clinic Registration',
        'Clinic "' || v_clinic_name || '" registered and awaiting approval',
        NOW()
      );
    EXCEPTION WHEN OTHERS THEN
      -- Log warning but don't fail the signup
      RAISE WARNING 'Failed to create activity log for clinic signup: %', SQLERRM;
    END;

  ELSE
    -- If no clinic_name, this might be a user being added to an existing clinic
    -- Just create the user profile without a clinic
    BEGIN
      INSERT INTO public.users (
        id,
        email,
        full_name,
        role,
        status,
        created_at,
        updated_at
      ) VALUES (
        NEW.id,
        NEW.email,
        v_full_name,
        v_role,  -- This is now guaranteed to be valid
        'active',
        NOW(),
        NOW()
      ) ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to create user profile: % (role attempted: %)', SQLERRM, v_role;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure function owner has proper permissions
ALTER FUNCTION public.handle_new_user_signup() OWNER TO postgres;

-- Grant execute permission to all necessary roles
GRANT EXECUTE ON FUNCTION public.handle_new_user_signup() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user_signup() TO anon;
GRANT EXECUTE ON FUNCTION public.handle_new_user_signup() TO service_role;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_signup();

-- Step 5: Verify the fix
SELECT 
  'Verification' as step,
  'Trigger exists' as check_item,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN '✅ YES' ELSE '❌ NO' END as status
UNION ALL
SELECT 
  'Verification' as step,
  'Constraint allows admin' as check_item,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.users'::regclass 
    AND conname LIKE '%role%check%'
    AND pg_get_constraintdef(oid) LIKE '%admin%'
  ) THEN '✅ YES' ELSE '❌ NO' END as status;
