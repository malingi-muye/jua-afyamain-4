-- Fix role constraint issue in signup trigger
-- The trigger is trying to insert 'admin' but the constraint might not allow it
-- First, let's check what the constraint allows

-- 1. Check what the constraint currently allows
SELECT 
  'Role Constraint Check' as check_type,
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.users'::regclass
  AND conname = 'users_role_check';

-- 2. Check what roles exist in the users table currently
SELECT 
  'Current Roles' as check_type,
  role,
  COUNT(*) as count
FROM public.users
GROUP BY role
ORDER BY role;

-- 3. Check what roles are allowed in the application
-- Based on types/enterprise.ts, valid roles are: 'admin', 'doctor', 'nurse', 'receptionist', 'pharmacist', 'lab_tech', 'super_admin'

-- If the constraint doesn't allow 'admin', we need to either:
-- Option A: Update the constraint to allow all valid roles
-- Option B: Update the trigger to use a valid role value

-- Let's see what the constraint definition says
-- Common patterns:
-- - role IN ('admin', 'doctor', ...)
-- - role = ANY(ARRAY['admin', 'doctor', ...])
-- - role ~ '^(admin|doctor|...)$'
