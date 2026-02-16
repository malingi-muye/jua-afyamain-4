-- Migration to fix team invitation logic
-- 1. Create invitations table
CREATE TABLE IF NOT EXISTS public.invitations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    invited_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '7 days'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- LEGACY CLEANUP: Remove any dummy 'invited' users from the users table 
-- This prevents unique email constraint violations when the real user signs up.
DELETE FROM public.users WHERE status = 'invited' OR status = 'Invited';

-- 2. Enable RLS
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- 3. Policies for invitations
CREATE POLICY "Clinics can view own invitations" ON public.invitations
    FOR SELECT USING (clinic_id = (SELECT clinic_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Admins can create invitations" ON public.invitations
    FOR INSERT WITH CHECK (
        clinic_id = (SELECT clinic_id FROM public.users WHERE id = auth.uid())
        AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'super_admin', 'Admin', 'SuperAdmin')
    );

CREATE POLICY "Admins can delete invitations" ON public.invitations
    FOR DELETE USING (
        clinic_id = (SELECT clinic_id FROM public.users WHERE id = auth.uid())
        AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'super_admin', 'Admin', 'SuperAdmin')
    );

-- 4. Update handle_new_user_signup trigger to handle invitations
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
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'admin');
  v_normalized_email := LOWER(TRIM(NEW.email));
  v_user_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(v_normalized_email, '@', 1));

  -- 2. Check for Invitation First
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
    BEGIN
      -- Normalize Role
      v_role := LOWER(v_role);
      IF v_role = 'super_admin' OR v_role = 'superadmin' THEN v_role := 'admin'; END IF;
      
      -- SLUG Logic
      v_base_slug := lower(regexp_replace(v_clinic_name, '[^a-zA-Z0-9]+', '-', 'g'));
      v_base_slug := trim(both '-' from v_base_slug);
      IF v_base_slug IS NULL OR v_base_slug = '' THEN v_base_slug := 'clinic-' || substring(NEW.id::text from 1 for 6); END IF;
      
      v_slug := v_base_slug;
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
