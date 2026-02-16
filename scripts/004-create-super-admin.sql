-- Create Super Admin User Profile
-- Run this AFTER creating the auth user in Supabase Dashboard
-- 
-- Steps:
-- 1. Go to Supabase Dashboard > Authentication > Users
-- 2. Click "Add User" 
-- 3. Create user with:
--    Email: superadmin@juaafya.com
--    Password: JuaAfya@Demo123
--    Auto Confirm: Yes
-- 4. Copy the user ID from the created user
-- 5. Replace 'YOUR_USER_ID_HERE' below with the actual UUID
-- 6. Run this script

-- ============================================================
-- SUPER ADMIN USER PROFILE
-- ============================================================

-- Insert super admin profile (replace YOUR_USER_ID_HERE with actual auth user ID)
-- To get the user ID: Go to Supabase Dashboard > Authentication > Users > Find superadmin@juaafya.com > Copy the UUID

INSERT INTO public.users (
  id,
  email,
  full_name,
  role,
  status,
  clinic_id, -- NULL for super admin (they don't belong to a clinic)
  created_at,
  updated_at
)
VALUES (
  'YOUR_USER_ID_HERE', -- Replace with actual auth user UUID
  'superadmin@juaafya.com',
  'Super Administrator',
  'super_admin',
  'active',
  NULL, -- Super admins don't have a clinic_id
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE
SET 
  role = 'super_admin',
  status = 'active',
  clinic_id = NULL,
  updated_at = NOW();

-- ============================================================
-- ALTERNATIVE: Create via Supabase Dashboard
-- ============================================================
-- If you prefer to use the Supabase Dashboard:
-- 1. Go to Authentication > Users > Add User
-- 2. Email: superadmin@juaafya.com
-- 3. Password: JuaAfya@Demo123
-- 4. Auto Confirm: Yes
-- 5. After user is created, go to Table Editor > users
-- 6. Insert new row with:
--    - id: (copy from auth.users)
--    - email: superadmin@juaafya.com
--    - full_name: Super Administrator
--    - role: super_admin
--    - status: active
--    - clinic_id: (leave NULL)
