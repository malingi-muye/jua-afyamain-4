-- Update handle_new_user_signup to handle duplicate clinic names and better status checks
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
  v_invitation_record RECORD;
BEGIN
  -- 1. Extract and Clean Inputs
  v_clinic_name := NEW.raw_user_meta_data->>'clinic_name';
  v_normalized_email := LOWER(TRIM(NEW.email));
  v_user_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(v_normalized_email, '@', 1));
  
  -- ROLE SANITIZATION (CRITICAL FOR SECURITY)
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'admin');
  v_role := LOWER(TRIM(v_role));
  
  -- Prevent anyone from signing up as super_admin through public trigger
  IF v_role = 'super_admin' OR v_role = 'superadmin' THEN
    v_role := 'admin';
  END IF;

  -- 2. Check for Invitation First (Invitation can override role, but we still sanitise it)
  SELECT * INTO v_invitation_record 
  FROM public.invitations 
  WHERE LOWER(email) = v_normalized_email 
    AND status = 'pending' 
    AND expires_at > now()
  LIMIT 1;

  IF v_invitation_record.id IS NOT NULL THEN
    -- A. User was invited! Use invitation data
    v_clinic_id := v_invitation_record.clinic_id;
    v_role := v_invitation_record.role;
    
    -- Final safety check on invited role as well
    IF v_role = 'super_admin' OR v_role = 'superadmin' THEN v_role := 'admin'; END IF;
    
    -- B. Insert User (Linked to Invited Clinic)
    INSERT INTO public.users (id, clinic_id, email, full_name, role, status)
    VALUES (NEW.id, v_clinic_id, v_normalized_email, v_user_full_name, v_role, 'active')
    ON CONFLICT (id) DO UPDATE SET
      clinic_id = EXCLUDED.clinic_id,
      role = EXCLUDED.role,
      status = 'active';

    -- C. Mark invitation as accepted
    UPDATE public.invitations SET status = 'accepted' WHERE id = v_invitation_record.id;

    RETURN NEW;
  END IF;

  -- 3. Standard Clinic Creation Logic (if no invitation)
  IF v_clinic_name IS NOT NULL AND v_clinic_name != '' THEN
    -- CHECK FOR DUPLICATE CLINIC NAME
    IF EXISTS (SELECT 1 FROM public.clinics WHERE LOWER(name) = LOWER(TRIM(v_clinic_name))) THEN
      RAISE EXCEPTION 'CLINIC_ALREADY_EXISTS: A clinic with the name "%" is already registered. If you are a staff member, please ask your administrator for an invitation.', v_clinic_name;
    END IF;

    BEGIN
      -- SLUG Logic
      v_base_slug := lower(regexp_replace(v_clinic_name, '[^a-zA-Z0-9]+', '-', 'g'));
      v_base_slug := trim(both '-' from v_base_slug);
      IF v_base_slug IS NULL OR v_base_slug = '' THEN v_base_slug := 'clinic-' || substring(NEW.id::text from 1 for 6); END IF;
      
      v_slug := v_base_slug;
      -- Even if name is unique, slug might collide (rare but possible if name normalization leads to same slug)
      IF EXISTS (SELECT 1 FROM public.clinics WHERE slug = v_slug) THEN
          v_slug := v_base_slug || '-' || floor(random() * 10000)::text;
      END IF;

      -- Insert Clinic
      INSERT INTO public.clinics (name, slug, email, status, plan, country, currency, timezone, plan_seats)
      VALUES (v_clinic_name, v_slug, v_normalized_email, 'pending', 'free', 'KE', 'KES', 'Africa/Nairobi', 5)
      RETURNING id INTO v_clinic_id;

      -- Insert User
      INSERT INTO public.users (id, clinic_id, email, full_name, role, status)
      VALUES (NEW.id, v_clinic_id, v_normalized_email, v_user_full_name, v_role, 'active');

      -- Update Clinic Owner
      UPDATE public.clinics SET owner_id = NEW.id WHERE id = v_clinic_id;

    EXCEPTION WHEN OTHERS THEN
       -- Re-raise custom exception if it's ours, otherwise generic
       IF SQLSTATE = 'P0001' AND SQLERRM LIKE 'CLINIC_ALREADY_EXISTS%' THEN
         RAISE;
       END IF;
       RAISE WARNING 'SIGNUP FAIL: %', SQLERRM;
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
