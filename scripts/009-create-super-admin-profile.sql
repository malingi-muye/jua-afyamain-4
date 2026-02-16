-- ============================================================
-- DIRECT SUPER ADMIN PROFILE CREATION
-- ============================================================
-- This script directly creates the super admin user profile
-- in the users table for the email: superadmin@juaafya.com
-- 
-- The Supabase auth user must already exist with this email.
-- To create it:
-- 1. Go to https://supabase.com/dashboard
-- 2. Select your project (tlraaxpemekmjpcbwpny)
-- 3. Go to Authentication > Users
-- 4. Click "Add user" and create with:
--    - Email: superadmin@juaafya.com
--    - Password: JuaAfya@Demo123
--    - Auto confirm: checked
-- 5. Copy the user UUID from the created user
-- 6. Run this script with the actual UUID
-- ============================================================

-- First, find the auth user ID for superadmin@juaafya.com
-- If you know the UUID, replace 'YOUR_UUID_HERE' with it below

-- Option 1: Insert the super admin profile (replace UUID if known)
INSERT INTO public.users (
  id,
  email,
  full_name,
  role,
  status,
  clinic_id,
  created_at,
  updated_at
)
-- To find the correct UUID, run this query first to see all auth users:
-- SELECT id, email FROM auth.users WHERE email = 'superadmin@juaafya.com'
-- Then use that UUID below
SELECT 
  id,
  'superadmin@juaafya.com',
  'Super Administrator',
  'super_admin',
  'active',
  NULL,
  NOW(),
  NOW()
FROM auth.users
WHERE email = 'superadmin@juaafya.com'
  AND id NOT IN (SELECT id FROM public.users)
ON CONFLICT (id) DO UPDATE
SET 
  role = 'super_admin',
  status = 'active',
  updated_at = NOW();

-- Verify the profile was created
SELECT id, email, full_name, role, status FROM public.users WHERE email = 'superadmin@juaafya.com';
