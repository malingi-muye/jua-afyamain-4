-- SIMPLE FIX: Drop all role check constraints and recreate with correct definition
-- This works regardless of the constraint name

-- Step 1: Find and drop ALL role check constraints on users table
DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  FOR constraint_record IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND contype = 'c'  -- CHECK constraint
      AND pg_get_constraintdef(oid) LIKE '%role%'
  LOOP
    EXECUTE 'ALTER TABLE public.users DROP CONSTRAINT IF EXISTS ' || constraint_record.conname;
    RAISE NOTICE 'Dropped constraint: %', constraint_record.conname;
  END LOOP;
END $$;

-- Step 2: Add the correct constraint with explicit name
ALTER TABLE public.users 
ADD CONSTRAINT users_role_check 
CHECK (role IN ('super_admin', 'admin', 'doctor', 'nurse', 'receptionist', 'lab_tech', 'pharmacist', 'accountant'));

-- Step 3: Recreate trigger function with guaranteed valid role
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
  -- Validate metadata role, but fallback to 'doctor' if invalid
  v_role := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'doctor');
  v_role := lower(trim(replace(v_role, ' ', '_')));
  
  -- Validate - only use if it's in the allowed list
  IF v_role NOT IN ('super_admin', 'admin', 'doctor', 'nurse', 'receptionist', 'lab_tech', 'pharmacist', 'accountant') THEN
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

    -- Create the clinic with 'pending' status
    BEGIN
      INSERT INTO public.clinics (
        name, slug, owner_id, email, status, plan, country, currency, timezone, plan_seats, created_at, updated_at
      ) VALUES (
        v_clinic_name, v_slug, NEW.id, NEW.email, 'pending', 'free', 'KE', 'KES', 'Africa/Nairobi', 5, NOW(), NOW()
      ) RETURNING id INTO v_clinic_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Failed to create clinic: %', SQLERRM;
    END;

    -- Create user profile - v_role is guaranteed to be valid
    BEGIN
      INSERT INTO public.users (
        id, clinic_id, email, full_name, role, status, created_at, updated_at
      ) VALUES (
        NEW.id, v_clinic_id, NEW.email, v_full_name, v_role, 'active', NOW(), NOW()
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Failed to create user profile: % (role: %)', SQLERRM, v_role;
    END;

    -- Log activity (non-blocking)
    BEGIN
      INSERT INTO public.activities (clinic_id, user_id, activity_type, title, description, created_at)
      VALUES (v_clinic_id, NEW.id, 'clinic_signup', 'New Clinic Registration', 'Clinic "' || v_clinic_name || '" registered and awaiting approval', NOW());
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to create activity log: %', SQLERRM;
    END;

  ELSE
    -- No clinic_name - create user without clinic
    BEGIN
      INSERT INTO public.users (id, email, full_name, role, status, created_at, updated_at)
      VALUES (NEW.id, NEW.email, v_full_name, v_role, 'active', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to create user profile: % (role: %)', SQLERRM, v_role;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- Set function owner and permissions
ALTER FUNCTION public.handle_new_user_signup() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.handle_new_user_signup() TO authenticated, anon, service_role;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_signup();

-- Step 4: Verify
SELECT 
  'Verification' as check_type,
  'Constraint exists' as check_item,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.users'::regclass 
    AND conname = 'users_role_check'
  ) THEN '✅ YES' ELSE '❌ NO' END as status
UNION ALL
SELECT 
  'Verification' as check_type,
  'Trigger exists' as check_item,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN '✅ YES' ELSE '❌ NO' END as status;
