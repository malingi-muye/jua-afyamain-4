-- FIX: Simplify Signup to use snake_case and resolve constraints
-- 1. Aggressively drop potential duplicate constraints on users table
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS user_role_check;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check1;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS check_role;

-- Ensure clinic owner_id is nullable (resolves circular dependency)
ALTER TABLE public.clinics ALTER COLUMN owner_id DROP NOT NULL;

-- 2. Re-add constraint allowing both just in case, but we will use snake_case in trigger
ALTER TABLE public.users 
ADD CONSTRAINT users_role_check 
CHECK (role IN (
    'super_admin', 'admin', 'doctor', 'nurse', 'receptionist', 'lab_tech', 'pharmacist', 'accountant',
    'SuperAdmin', 'Admin', 'Doctor', 'Nurse', 'Receptionist', 'Lab Tech', 'Pharmacist', 'Accountant'
));

-- 3. Update Trigger to FORCE snake_case (simplest path to success)
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
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'admin');
  v_normalized_email := LOWER(TRIM(NEW.email));
  v_user_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(v_normalized_email, '@', 1));

  -- 2. Normalize Role to snake_case (Safest for DB)
  v_role := LOWER(v_role);
  -- Map known variations
  IF v_role = 'superadmin' THEN v_role := 'super_admin'; END IF;
  IF v_role = 'lab tech' THEN v_role := 'lab_tech'; END IF;
  IF v_role = 'labtech' THEN v_role := 'lab_tech'; END IF;
  
  -- Fallback
  IF v_role NOT IN ('super_admin', 'admin', 'doctor', 'nurse', 'receptionist', 'lab_tech', 'pharmacist', 'accountant') THEN
     v_role := 'doctor';
  END IF;

  -- 3. Clinic Creation Logic
  IF v_clinic_name IS NOT NULL AND v_clinic_name != '' THEN
    BEGIN
      -- Enforce: SuperAdmin cannot create a regular clinic this way
      IF v_role = 'super_admin' THEN v_role := 'admin'; END IF;

      -- Generate Base Slug
      v_base_slug := lower(regexp_replace(v_clinic_name, '[^a-zA-Z0-9]+', '-', 'g'));
      v_base_slug := trim(both '-' from v_base_slug);
      IF v_base_slug IS NULL OR v_base_slug = '' THEN v_base_slug := 'clinic-' || substring(NEW.id::text from 1 for 6); END IF;
      
      -- Slug Uniqueness Strategy (Append random number if conflict)
      v_slug := v_base_slug;
      IF EXISTS (SELECT 1 FROM public.clinics WHERE slug = v_slug) THEN
          v_slug := v_base_slug || '-' || floor(random() * 10000)::text;
      END IF;

      -- A. Insert Clinic (Owner is NULL initially)
      INSERT INTO public.clinics (name, slug, email, status, plan, country, currency, timezone, plan_seats)
      VALUES (v_clinic_name, v_slug, v_normalized_email, 'pending', 'free', 'KE', 'KES', 'Africa/Nairobi', 5)
      RETURNING id INTO v_clinic_id;

      -- B. Insert User (Linked to Clinic)
      INSERT INTO public.users (id, clinic_id, email, full_name, role, status)
      VALUES (NEW.id, v_clinic_id, v_normalized_email, v_user_full_name, v_role, 'active');

      -- C. Update Clinic Owner
      UPDATE public.clinics SET owner_id = NEW.id WHERE id = v_clinic_id;

    EXCEPTION WHEN OTHERS THEN
       -- Log detailed error
       RAISE WARNING 'SIGNUP FAIL: %', SQLERRM;
       -- Re-raise with a custom prefix to identify it
       RAISE EXCEPTION 'CUSTOM_SIGNUP_ERROR: %', SQLERRM;
    END;

  ELSE
    -- 4. Standalone User Creation
    BEGIN
      INSERT INTO public.users (id, email, full_name, role, status)
      VALUES (NEW.id, v_normalized_email, v_user_full_name, v_role, 'active')
      ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
       RAISE WARNING 'SIGNUP FAIL (STANDALONE): %', SQLERRM;
       RAISE EXCEPTION 'CUSTOM_SIGNUP_ERROR: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;
