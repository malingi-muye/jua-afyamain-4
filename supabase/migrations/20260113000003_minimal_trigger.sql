-- Minimal trigger version - simplest possible to test
-- This version has minimal logic to isolate the issue

-- Drop existing trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create minimal function that just tries to insert
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER AS $$
DECLARE
  v_clinic_id UUID;
  v_clinic_name TEXT;
  v_full_name TEXT;
  v_role TEXT;
  v_slug TEXT;
BEGIN
  -- Extract metadata
  v_clinic_name := NEW.raw_user_meta_data->>'clinic_name';
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'User');
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'admin');

  -- Only proceed if clinic_name exists
  IF v_clinic_name IS NOT NULL AND v_clinic_name != '' THEN
    
    -- Generate simple slug
    v_slug := lower(regexp_replace(v_clinic_name, '[^a-zA-Z0-9]+', '-', 'g'));
    v_slug := trim(both '-' from v_slug);
    IF v_slug = '' OR v_slug IS NULL THEN
      v_slug := 'clinic-' || substring(NEW.id::text from 1 for 8);
    END IF;
    
    -- Make unique
    WHILE EXISTS (SELECT 1 FROM public.clinics WHERE slug = v_slug) LOOP
      v_slug := v_slug || '-' || substring(gen_random_uuid()::text from 1 for 4);
    END LOOP;

    -- Insert clinic - ALL fields explicitly provided
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

    -- Insert user - ALL fields explicitly provided
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

  ELSE
    -- No clinic name - just create user
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
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log the error but don't fail the auth user creation
  -- This allows the user to be created even if profile creation fails
  -- The error will appear in Postgres logs
  RAISE WARNING 'Signup trigger error for user %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
  -- Still return NEW so auth user creation succeeds
  -- User can log in and profile can be created manually if needed
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Set owner
ALTER FUNCTION public.handle_new_user_signup() OWNER TO postgres;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_signup();

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user_signup() TO authenticated, anon, service_role;

-- Ensure RLS policies exist
DO $$
BEGIN
  -- Clinics
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'clinics' 
    AND policyname = 'System can insert clinics'
  ) THEN
    CREATE POLICY "System can insert clinics" ON public.clinics
      FOR INSERT
      WITH CHECK (true);
  END IF;

  -- Users
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' 
    AND policyname = 'System can insert users'
  ) THEN
    CREATE POLICY "System can insert users" ON public.users
      FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;
