-- ============================================================
-- SCRIPT 010: Initialize Super Admin User
-- ============================================================
-- This script ensures the super admin user exists in the users table
-- It automatically finds the super_admin from auth.users and creates their profile
-- 
-- Run this AFTER creating the super admin user in Supabase Auth
-- ============================================================

-- Create a temporary function to find and set up the super admin
DO $$
DECLARE
  v_super_admin_id UUID;
  v_super_admin_email TEXT;
  v_super_admin_name TEXT;
BEGIN
  -- Find the super admin user in auth.users by email
  -- Adjust the email if needed
  SELECT id, email, COALESCE((raw_user_meta_data->>'full_name'), split_part(email, '@', 1))
  INTO v_super_admin_id, v_super_admin_email, v_super_admin_name
  FROM auth.users
  WHERE email = 'superadmin@juaafya.com'
  LIMIT 1;

  IF v_super_admin_id IS NOT NULL THEN
    RAISE NOTICE 'Found super admin: % (ID: %)', v_super_admin_email, v_super_admin_id;
    
    -- Insert or update the super admin profile in users table
    INSERT INTO public.users (
      id,
      email,
      full_name,
      role,
      status,
      clinic_id, -- NULL for super admin
      created_at,
      updated_at
    )
    VALUES (
      v_super_admin_id,
      v_super_admin_email,
      COALESCE(v_super_admin_name, 'Super Administrator'),
      'super_admin',
      'active',
      NULL,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (id) DO UPDATE
    SET 
      role = 'super_admin',
      status = 'active',
      clinic_id = NULL,
      updated_at = CURRENT_TIMESTAMP;
      
    RAISE NOTICE 'Super admin profile created/updated successfully';
  ELSE
    RAISE NOTICE 'Super admin user not found in auth.users. Please create superadmin@juaafya.com in Supabase Auth first.';
  END IF;
END $$;

-- ============================================================
-- Verify the super admin exists
-- ============================================================
SELECT 
  u.id,
  u.email,
  u.full_name,
  u.role,
  u.status,
  u.clinic_id,
  u.created_at
FROM public.users u
WHERE u.role = 'super_admin'
LIMIT 5;

-- ============================================================
-- SUCCESS
-- ============================================================
-- The super admin user should now exist in both:
-- 1. auth.users (Supabase Auth)
-- 2. public.users (Application database table)
--
-- You can now login with:
-- Email: superadmin@juaafya.com
-- Password: (whatever you set in Supabase Auth)
-- ============================================================
