-- Debug and fix signup trigger
-- This version includes better error handling and logging

-- First, let's check what's actually happening
-- Drop the existing trigger temporarily to see if that's the issue
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create a simpler version first to test
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER AS $$
DECLARE
  v_clinic_id UUID;
  v_clinic_name TEXT;
  v_full_name TEXT;
  v_role TEXT;
  v_slug TEXT;
  v_error_message TEXT;
BEGIN
  -- Extract metadata from auth.users
  v_clinic_name := NEW.raw_user_meta_data->>'clinic_name';
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'admin');

  -- Log what we're trying to do (this will appear in Postgres logs)
  RAISE NOTICE 'Trigger fired for user: %, clinic_name: %, full_name: %', NEW.id, v_clinic_name, v_full_name;

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

    RAISE NOTICE 'Generated slug: %', v_slug;

    -- Create the clinic with 'pending' status
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
        'pending',
        'free',
        'KE',
        'KES',
        'Africa/Nairobi',
        5,
        NOW(),
        NOW()
      ) RETURNING id INTO v_clinic_id;
      
      RAISE NOTICE 'Clinic created successfully: %', v_clinic_id;
    EXCEPTION WHEN OTHERS THEN
      v_error_message := 'Failed to create clinic: ' || SQLERRM || ' (SQLSTATE: ' || SQLSTATE || ')';
      RAISE EXCEPTION '%', v_error_message;
    END;

    -- Create user profile linked to the new clinic
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
        v_role,
        'active',
        NOW(),
        NOW()
      );
      
      RAISE NOTICE 'User profile created successfully';
    EXCEPTION WHEN OTHERS THEN
      v_error_message := 'Failed to create user profile: ' || SQLERRM || ' (SQLSTATE: ' || SQLSTATE || ')';
      -- Try to clean up the clinic if user creation fails
      BEGIN
        DELETE FROM public.clinics WHERE id = v_clinic_id;
      EXCEPTION WHEN OTHERS THEN
        -- Ignore cleanup errors
      END;
      RAISE EXCEPTION '%', v_error_message;
    END;

    -- Log the signup activity (non-blocking)
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
      RAISE NOTICE 'Activity logged successfully';
    EXCEPTION WHEN OTHERS THEN
      -- Log warning but don't fail the signup
      RAISE WARNING 'Failed to create activity log: %', SQLERRM;
    END;

  ELSE
    -- If no clinic_name, just create the user profile without a clinic
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
        v_role,
        'active',
        NOW(),
        NOW()
      ) ON CONFLICT (id) DO NOTHING;
      
      RAISE NOTICE 'User profile created (no clinic)';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to create user profile (no clinic): %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_signup();

-- Ensure function owner
ALTER FUNCTION public.handle_new_user_signup() OWNER TO postgres;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user_signup() TO authenticated, anon, service_role;

-- Ensure RLS policies allow system inserts
DROP POLICY IF EXISTS "System can insert clinics" ON public.clinics;
CREATE POLICY "System can insert clinics" ON public.clinics
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "System can insert users" ON public.users;
CREATE POLICY "System can insert users" ON public.users
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "System can insert activities" ON public.activities;
CREATE POLICY "System can insert activities" ON public.activities
  FOR INSERT
  WITH CHECK (true);
