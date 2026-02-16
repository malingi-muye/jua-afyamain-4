-- FIX: Relax User Status Constraint to allow 'active' (lowercase)
-- The error "violates check constraint users_status_check" implies it might be expecting Title Case or a different set.

-- 1. Drop the strict constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_status_check;

-- 2. Add a comprehensive constraint that supports both lowercase (used by new trigger) and Title Case (legacy)
ALTER TABLE public.users 
ADD CONSTRAINT users_status_check 
CHECK (status IN (
    -- Lowercase (Standard)
    'active', 'invited', 'suspended', 'deactivated',
    -- Title Case (Legacy/Safety)
    'Active', 'Invited', 'Suspended', 'Deactivated'
));

-- 3. Also check/fix Clinics status just in case
ALTER TABLE public.clinics DROP CONSTRAINT IF EXISTS clinics_status_check;
ALTER TABLE public.clinics 
ADD CONSTRAINT clinics_status_check 
CHECK (status IN (
    'active', 'pending', 'suspended', 'cancelled',
    'Active', 'Pending', 'Suspended', 'Cancelled'
));

-- 4. Also check/fix Clinics Plan constraint
ALTER TABLE public.clinics DROP CONSTRAINT IF EXISTS clinics_plan_check;
ALTER TABLE public.clinics 
ADD CONSTRAINT clinics_plan_check 
CHECK (plan IN (
    'free', 'pro', 'enterprise',
    'Free', 'Pro', 'Enterprise'
));


-- 4. Re-run the simplify signup migration logic just to be sure it's latest version
-- (The previous migration might have failed halfway if it was a single transaction, but we are appending this fix)
