-- ROBUST SIGNUP TRIGGER: Ensures signup ALWAYS succeeds even if profile creation fails
-- This prevents the "Database error saving new user" block during registration

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
  -- 1. Extract and Normalize Metadata
  -- Use COALESCE for safety; split email as fallback for full_name
  v_clinic_name := NEW.raw_user_meta_data->>'clinic_name';
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  
  -- Defensively handle role - default to 'doctor' if missing
  v_role := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'doctor');
  v_role := lower(trim(replace(v_role, ' ', '_')));
  
  -- Final role validation against current known constraints
  IF v_role NOT IN ('super_admin', 'admin', 'doctor', 'nurse', 'receptionist', 'lab_tech', 'pharmacist', 'accountant') THEN
    v_role := 'doctor';
  END IF;

  -- 2. Process Clinic Creation (if clinic_name is provided)
  IF v_clinic_name IS NOT NULL AND v_clinic_name != '' THEN
    BEGIN
      -- Generate Unique Slug
      v_slug := lower(regexp_replace(v_clinic_name, '[^a-zA-Z0-9]+', '-', 'g'));
      v_slug := trim(both '-' from v_slug);
      
      IF v_slug IS NULL OR v_slug = '' THEN
        v_slug := 'clinic-' || substring(NEW.id::text from 1 for 8);
      END IF;
      
      -- Ensure slug uniqueness with a simple suffix
      IF EXISTS (SELECT 1 FROM public.clinics WHERE slug = v_slug) THEN
        v_slug := v_slug || '-' || substring(NEW.id::text from 1 for 4);
      END IF;

      -- Insert Clinic
      -- We include all common columns with explicit values or NULL
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

      -- Insert User Profile linked to clinic
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

      -- Optional: Log activity (swallow errors)
      BEGIN
        INSERT INTO public.activities (clinic_id, user_id, activity_type, title, description, created_at)
        VALUES (v_clinic_id, NEW.id, 'clinic_signup', 'New Clinic Registration', 'Clinic "' || v_clinic_name || '" registered', NOW());
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;

    EXCEPTION WHEN OTHERS THEN
      -- Log the error to Postgres logs but DO NOT fail the transaction
      RAISE WARNING 'SIGNUP_TRIGGER_ERROR: Failed to create clinic/profile for user %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
    END;

  ELSE
    -- 3. Simple User Creation (No clinic provided)
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
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'SIGNUP_TRIGGER_ERROR: Failed to create standalone profile for user %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
    END;
  END IF;

  -- 4. ALWAYS RETURN NEW
  -- This ensures the auth user is created even if the trigger logic failed
  RETURN NEW;
END;
$$;

-- Ensure owner and permissions
ALTER FUNCTION public.handle_new_user_signup() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.handle_new_user_signup() TO authenticated, anon, service_role;

-- Re-enable target trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_signup();
