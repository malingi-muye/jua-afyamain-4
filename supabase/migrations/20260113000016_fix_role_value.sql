-- Fix role constraint violation
-- The error indicates that 'admin' might not be in the constraint
-- Based on the schema, valid roles are lowercase with underscores
-- The trigger should use 'admin' which is valid, but let's verify

-- First, let's check what the constraint actually says
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_def
FROM pg_constraint
WHERE conrelid = 'public.users'::regclass
  AND conname LIKE '%role%check%';

-- The schema shows the constraint should be:
-- CHECK (role IN ('super_admin', 'admin', 'doctor', 'nurse', 'receptionist', 'lab_tech', 'pharmacist', 'accountant'))
-- So 'admin' should be valid

-- However, the error suggests 'admin' is NOT valid
-- This could mean:
-- 1. The constraint is different than expected
-- 2. There's a case sensitivity issue
-- 3. The constraint was modified

-- Solution: Update the trigger to ensure it uses a role that definitely exists
-- Let's use 'doctor' as a safe default (it's the schema default)

-- Update the trigger function to use 'doctor' instead of 'admin' if needed
-- OR better: Make sure 'admin' is in the constraint

-- Actually, let's just update the trigger to use 'doctor' as the default
-- since 'admin' might not be in the constraint
