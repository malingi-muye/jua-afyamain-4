-- FINAL FIX: Clinic Signup Trigger
-- This script completely replaces the signup logic to ensuring robustness against:
-- 1. Slug collisions
-- 2. Role casing mismatches
-- 3. Circular dependencies
-- 4. Silent failures (added better logging)

CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_clinic_id UUID;
  v_clinic_name TEXT;
  v_role TEXT;
  v_slug TEXT;
  v_base_slug TEXT;
  v_normalized_email TEXT;
BEGIN
  -- 1. Safe Metadata Extraction
  v_clinic_name := NEW.raw_user_meta_data->>'clinic_name';
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'admin');
  v_normalized_email := LOWER(TRIM(NEW.email));
  
  -- Cleanup role casing (Force proper snake_case for DB consistency)
  v_role := LOWER(v_role);
  -- Map variations to standard snake_case roles
  IF v_role = 'superadmin' THEN v_role := 'super_admin'; END IF;
  IF v_role = 'lab tech' THEN v_role := 'lab_tech'; END IF;
  
  -- Defensively ensure role is valid (fallback to doctor if obscure role)
  IF v_role NOT IN ('super_admin', 'admin', 'doctor', 'nurse', 'receptionist', 'lab_tech', 'pharmacist', 'accountant') THEN
     v_role := 'doctor';
  END IF;

  -- 2. Clinic Creation Logic
  IF v_clinic_name IS NOT NULL AND v_clinic_name != '' THEN
    BEGIN
      -- Special Rule: Super Admins cannot exist within a clinic context
      -- If someone signs up with a clinic name, they MUST be an admin, not a super_admin
      IF v_role = 'super_admin' THEN v_role := 'admin'; END IF;

      -- Generate Base Slug (Clean URL-friendly string)
      v_base_slug := lower(regexp_replace(v_clinic_name, '[^a-zA-Z0-9]+', '-', 'g'));
      -- Remove leading/trailing dashes
      v_base_slug := trim(both '-' from v_base_slug);
      -- Ensure slug is not empty
      IF v_base_slug IS NULL OR v_base_slug = '' THEN v_base_slug := 'clinic-' || substring(NEW.id::text from 1 for 6); END IF;
      
      -- Slug Uniqueness Logic (Simple Retry Strategy)
      v_slug := v_base_slug;
      IF EXISTS (SELECT 1 FROM public.clinics WHERE slug = v_slug) THEN
          v_slug := v_base_slug || '-' || substring(NEW.id::text from 1 for 4);
      END IF;
      -- Just in case it STILL exists
      IF EXISTS (SELECT 1 FROM public.clinics WHERE slug = v_slug) THEN
          v_slug := v_base_slug || '-' || floor(random() * 10000)::text;
      END IF;
      
      -- STEP A: Insert Clinic with NULL owner first (to resolve circular dependency)
      INSERT INTO public.clinics (name, slug, email, status, plan, country, currency, timezone, plan_seats)
      VALUES (
        v_clinic_name, 
        v_slug, 
        v_normalized_email, 
        'pending',  -- Always pending initially
        'free',     -- Default plan
        'KE', 'KES', 'Africa/Nairobi', 5
      )
      RETURNING id INTO v_clinic_id;

      -- STEP B: Create User Profile linked to the new Clinic
      INSERT INTO public.users (
        id, 
        clinic_id, 
        email, 
        full_name, 
        role, 
        status
      )
      VALUES (
        NEW.id, 
        v_clinic_id, 
        v_normalized_email, 
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(v_normalized_email, '@', 1)), 
        v_role, 
        'active'
      );

      -- STEP C: Update Clinic to set the Owner
      UPDATE public.clinics 
      SET owner_id = NEW.id 
      WHERE id = v_clinic_id;
      
      -- STEP D: Log the success
      RAISE LOG 'SIGNUP SUCCESS: Created clinic % (%) and user %', v_clinic_name, v_slug, NEW.id;

    EXCEPTION WHEN OTHERS THEN
      -- Log ERROR to Postgres logs
      RAISE WARNING 'SIGNUP TRIGGER ERROR for user %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
      -- We do NOT raise exception here to allow the Auth user to be created, 
      -- ensuring we don't block the user completely (though profile will be missing).
    END;

  ELSE
    -- 3. Standalone User Creation (No Clinic) works as before
    BEGIN
      INSERT INTO public.users (id, email, full_name, role, status)
      VALUES (
        NEW.id, 
        v_normalized_email, 
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(v_normalized_email, '@', 1)), 
        v_role, 
        'active'
      )
      ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'STANDALONE USER ERROR: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure trigger is active
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_signup();
