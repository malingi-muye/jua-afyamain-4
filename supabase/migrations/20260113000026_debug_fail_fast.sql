-- DEBUG: Fail Fast Trigger
-- This version RAISES EXCEPTION on error so we can see the exact database error in the signup form.

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
  -- 1. Extract Metadata
  v_clinic_name := NEW.raw_user_meta_data->>'clinic_name';
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'admin');
  v_normalized_email := LOWER(TRIM(NEW.email));
  
  v_role := LOWER(v_role);
  IF v_role = 'superadmin' THEN v_role := 'super_admin'; END IF;
  
  -- 2. Clinic Creation
  IF v_clinic_name IS NOT NULL AND v_clinic_name != '' THEN
    BEGIN
       -- Force role
      IF v_role = 'super_admin' THEN v_role := 'admin'; END IF;

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
      -- !!! DEBUG Change: Raise Exception to see the error in frontend !!!
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
