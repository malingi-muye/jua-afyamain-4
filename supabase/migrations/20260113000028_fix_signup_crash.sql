-- FIX: Robust Signup Trigger and Role Constraints
-- 1. Unify Role Constraints (Allow both Snake and Title case)
-- 2. Restore Robust Slug Generation (Add Random fallback)
-- 3. Ensure Owner_ID is nullable to prevent circular dependency deadlocks
-- 4. Improve Error Handling (Raise Exception with clear message to avoid silent failures)

-- A. Relax Constraints to allow both Casing styles
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users 
ADD CONSTRAINT users_role_check 
CHECK (role IN (
    'super_admin', 'admin', 'doctor', 'nurse', 'receptionist', 'lab_tech', 'pharmacist', 'accountant',
    'SuperAdmin', 'Admin', 'Doctor', 'Nurse', 'Receptionist', 'Lab Tech', 'Pharmacist', 'Accountant'
));

-- B. Ensure Clinic Owner ID is nullable (Critical for the circular insert flow)
ALTER TABLE public.clinics ALTER COLUMN owner_id DROP NOT NULL;

-- C. The Final Robust Trigger
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
  v_user_full_name TEXT;
BEGIN
  -- 1. Extract and Clean Inputs
  v_clinic_name := NEW.raw_user_meta_data->>'clinic_name';
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'Admin');
  v_normalized_email := LOWER(TRIM(NEW.email));
  v_user_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(v_normalized_email, '@', 1));

  -- 2. Normalize Role to Title Case (Preferred by UI)
  -- Map known snake_case to Title Case
  CASE lower(v_role)
    WHEN 'admin' THEN v_role := 'Admin';
    WHEN 'doctor' THEN v_role := 'Doctor';
    WHEN 'nurse' THEN v_role := 'Nurse';
    WHEN 'receptionist' THEN v_role := 'Receptionist';
    WHEN 'pharmacist' THEN v_role := 'Pharmacist';
    WHEN 'accountant' THEN v_role := 'Accountant';
    WHEN 'lab tech' THEN v_role := 'Lab Tech';
    WHEN 'lab_tech' THEN v_role := 'Lab Tech';
    WHEN 'superadmin' THEN v_role := 'SuperAdmin';
    WHEN 'super_admin' THEN v_role := 'SuperAdmin';
    ELSE 
      -- Keep as is if it matches Title Case, otherwise default to Doctor if unknown/invalid
      IF v_role NOT IN ('SuperAdmin', 'Admin', 'Doctor', 'Nurse', 'Receptionist', 'Lab Tech', 'Pharmacist', 'Accountant') THEN
         -- Fallback for safety
         v_role := 'Doctor';
      END IF;
  END CASE;

  -- 3. Clinic Creation Logic
  IF v_clinic_name IS NOT NULL AND v_clinic_name != '' THEN
    BEGIN
      -- Enforce: SuperAdmin cannot create a regular clinic this way (should be Admin)
      IF v_role = 'SuperAdmin' THEN v_role := 'Admin'; END IF;

      -- Generate Base Slug
      v_base_slug := lower(regexp_replace(v_clinic_name, '[^a-zA-Z0-9]+', '-', 'g'));
      v_base_slug := trim(both '-' from v_base_slug);
      IF v_base_slug IS NULL OR v_base_slug = '' THEN v_base_slug := 'clinic-' || substring(NEW.id::text from 1 for 6); END IF;
      
      -- Slug Uniqueness Strategy (Retry 1: Base, Retry 2: Base-ID, Retry 3: Base-Random)
      v_slug := v_base_slug;
      IF EXISTS (SELECT 1 FROM public.clinics WHERE slug = v_slug) THEN
          v_slug := v_base_slug || '-' || substring(NEW.id::text from 1 for 4);
      END IF;
      IF EXISTS (SELECT 1 FROM public.clinics WHERE slug = v_slug) THEN
          v_slug := v_base_slug || '-' || floor(random() * 10000)::text;
      END IF;

      -- Insert Clinic (Owner is NULL initially)
      INSERT INTO public.clinics (name, slug, email, status, plan, country, currency, timezone, plan_seats)
      VALUES (v_clinic_name, v_slug, v_normalized_email, 'pending', 'free', 'KE', 'KES', 'Africa/Nairobi', 5)
      RETURNING id INTO v_clinic_id;

      -- Insert User (Linked to Clinic)
      INSERT INTO public.users (id, clinic_id, email, full_name, role, status)
      VALUES (NEW.id, v_clinic_id, v_normalized_email, v_user_full_name, v_role, 'active');

      -- Update Clinic Owner
      UPDATE public.clinics SET owner_id = NEW.id WHERE id = v_clinic_id;

    EXCEPTION WHEN OTHERS THEN
       -- Log specific details to Postgres logs for debugging
       RAISE WARNING 'Signup Trigger Failed for User % (Clinic: %): %', NEW.id, v_clinic_name, SQLERRM;
       -- Re-raise exception to ensure the Auth User is NOT created if the Public Data fails.
       -- This prevents "Ghost Users" (Auth exists, Public missing).
       RAISE EXCEPTION 'Failed to create account organization: %', SQLERRM;
    END;

  ELSE
    -- 4. Standalone User Creation
    BEGIN
      INSERT INTO public.users (id, email, full_name, role, status)
      VALUES (NEW.id, v_normalized_email, v_user_full_name, v_role, 'active')
      ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
       RAISE WARNING 'Signup Trigger Failed for Standalone User %: %', NEW.id, SQLERRM;
       RAISE EXCEPTION 'Failed to create user profile: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;
