-- ALIGN ROLES: Update database constraints and trigger to match "Title Case" roles (Admin, Doctor, etc)

-- 1. update the check constraint to allow BOTH casing styles (to be safe)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS super_admin_no_clinic;

ALTER TABLE public.users 
ADD CONSTRAINT users_role_check 
CHECK (role IN (
    -- Original snake_case
    'super_admin', 'admin', 'doctor', 'nurse', 'receptionist', 'lab_tech', 'pharmacist', 'accountant',
    -- Title Case (Preferred by UI)
    'SuperAdmin', 'Admin', 'Doctor', 'Nurse', 'Receptionist', 'Lab Tech', 'Pharmacist', 'Accountant'
));

ALTER TABLE public.users
ADD CONSTRAINT super_admin_no_clinic
CHECK ((role != 'super_admin' AND role != 'SuperAdmin') OR clinic_id IS NULL);

-- 2. Update the trigger to use Title Case
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
  -- Extract
  v_clinic_name := NEW.raw_user_meta_data->>'clinic_name';
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'Admin');
  v_normalized_email := LOWER(TRIM(NEW.email));
  
  -- NORMALIZE TO TITLE CASE
  -- Handle inputs like 'admin', 'Admin', 'ADMIN' -> 'Admin'
  IF lower(v_role) = 'admin' THEN v_role := 'Admin'; END IF;
  IF lower(v_role) = 'doctor' THEN v_role := 'Doctor'; END IF;
  IF lower(v_role) = 'nurse' THEN v_role := 'Nurse'; END IF;
  IF lower(v_role) = 'receptionist' THEN v_role := 'Receptionist'; END IF;
  IF lower(v_role) = 'pharmacist' THEN v_role := 'Pharmacist'; END IF;
  IF lower(v_role) = 'accountant' THEN v_role := 'Accountant'; END IF;
  
  -- Handle special cases
  IF lower(v_role) = 'superadmin' OR lower(v_role) = 'super_admin' THEN v_role := 'SuperAdmin'; END IF;
  IF lower(v_role) = 'lab tech' OR lower(v_role) = 'lab_tech' THEN v_role := 'Lab Tech'; END IF;

  -- 2. Clinic Creation
  IF v_clinic_name IS NOT NULL AND v_clinic_name != '' THEN
    BEGIN
      -- Enforce Admin for clinic creators
      IF v_role = 'SuperAdmin' THEN v_role := 'Admin'; END IF;

      -- Base Slug
      v_base_slug := lower(regexp_replace(v_clinic_name, '[^a-zA-Z0-9]+', '-', 'g'));
      v_base_slug := trim(both '-' from v_base_slug);
      IF v_base_slug IS NULL OR v_base_slug = '' THEN v_base_slug := 'clinic-' || substring(NEW.id::text from 1 for 6); END IF;
      
      -- Unique Slug Strategy
      v_slug := v_base_slug;
      IF EXISTS (SELECT 1 FROM public.clinics WHERE slug = v_slug) THEN
          v_slug := v_base_slug || '-' || substring(NEW.id::text from 1 for 4);
      END IF;

      -- A. Insert Clinic
      INSERT INTO public.clinics (name, slug, email, status, plan, country, currency, timezone, plan_seats)
      VALUES (v_clinic_name, v_slug, v_normalized_email, 'pending', 'free', 'KE', 'KES', 'Africa/Nairobi', 5)
      RETURNING id INTO v_clinic_id;

      -- B. Insert User
      INSERT INTO public.users (id, clinic_id, email, full_name, role, status)
      VALUES (
        NEW.id, 
        v_clinic_id, 
        v_normalized_email, 
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(v_normalized_email, '@', 1)), 
        v_role, 
        'active'
      );

      -- C. Link Owner
      UPDATE public.clinics SET owner_id = NEW.id WHERE id = v_clinic_id;

    EXCEPTION WHEN OTHERS THEN
       RAISE EXCEPTION 'DB TRIGGER FAILED: % (State: %)', SQLERRM, SQLSTATE;
    END;

  ELSE
    -- Standalone
    BEGIN
      INSERT INTO public.users (id, email, full_name, role, status)
      VALUES (NEW.id, v_normalized_email, split_part(v_normalized_email, '@', 1), v_role, 'active')
      ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
       RAISE EXCEPTION 'DB TRIGGER FAILED (STANDALONE): %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;
