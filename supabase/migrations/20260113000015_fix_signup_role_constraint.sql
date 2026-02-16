-- Fix role constraint violation in signup trigger
-- The error: "users_role_check" constraint violation
-- This means the role value doesn't match the constraint

-- Step 1: Check what the constraint actually allows
SELECT 
  'Constraint Check' as step,
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.users'::regclass
  AND conname LIKE '%role%check%';

-- Step 2: Check what roles exist in the database
SELECT 
  'Current Roles' as step,
  role,
  COUNT(*) as count
FROM public.users
GROUP BY role
ORDER BY role;

-- Step 3: The constraint should allow: 'super_admin', 'admin', 'doctor', 'nurse', 'receptionist', 'lab_tech', 'pharmacist', 'accountant'
-- The trigger uses 'admin' which should be valid
-- But the constraint might be different or case-sensitive

-- Fix: Ensure the trigger uses a valid role from the constraint
-- Update the trigger function to use 'admin' (which should be valid)
-- OR if 'admin' is not valid, use 'doctor' (the default)

-- Actually, wait - looking at the schema, 'admin' IS in the list
-- So the issue might be that the constraint doesn't exist or is different
-- Let's update the trigger to be more defensive
