-- Verify trigger exists and check for issues
-- Run this to see if the trigger is set up correctly

-- 1. Check if trigger exists
SELECT 
  'Trigger Check' as step,
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  CASE WHEN tgenabled = 'O' THEN 'Enabled' ELSE 'Disabled' END as status
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';

-- 2. Check function definition
SELECT 
  'Function Check' as step,
  proname as function_name,
  prosecdef as is_security_definer
FROM pg_proc
WHERE proname = 'handle_new_user_signup';

-- 3. Check what roles are currently allowed by the constraint
SELECT 
  'Constraint Check' as step,
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.users'::regclass
  AND conname LIKE '%role%check%';

-- 4. Check current role values in database
SELECT 
  'Current Roles' as step,
  role,
  COUNT(*) as count
FROM public.users
GROUP BY role
ORDER BY role;

-- 5. If trigger doesn't exist or is wrong, we need to recreate it
-- But first, let's make sure the function is correct

-- If you need to recreate the trigger, run the complete_system_fix migration again
-- OR manually drop and recreate:

-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- DROP FUNCTION IF EXISTS public.handle_new_user_signup();

-- Then run: supabase/migrations/20260113000010_complete_system_fix.sql
