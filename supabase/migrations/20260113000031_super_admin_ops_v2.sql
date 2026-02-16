-- FIX: Enable Super Admin to UPDATE and DELETE clinics (Fixes Approval Persistence)
-- 1. Make is_super_admin() robust to casing
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() 
    AND (role = 'super_admin' OR role = 'SuperAdmin')
  );
END;
$$;

-- 2. Allow Super Admins to UPDATE clinics (Approve/Suspend)
DROP POLICY IF EXISTS "Super admins can update all clinics" ON public.clinics;
CREATE POLICY "Super admins can update all clinics" ON public.clinics
    FOR UPDATE
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- 3. Allow Super Admins to DELETE clinics
DROP POLICY IF EXISTS "Super admins can delete all clinics" ON public.clinics;
CREATE POLICY "Super admins can delete all clinics" ON public.clinics
    FOR DELETE
    USING (public.is_super_admin());

-- 4. Allow Super Admins to UPDATE users (e.g. assigning admins, resetting passwords via DB)
DROP POLICY IF EXISTS "Super admins can update all users" ON public.users;
CREATE POLICY "Super admins can update all users" ON public.users
    FOR UPDATE
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- 5. Allow Super Admins to INSERT clinics (Provisioning)
DROP POLICY IF EXISTS "Super admins can insert clinics" ON public.clinics;
CREATE POLICY "Super admins can insert clinics" ON public.clinics
    FOR INSERT
    WITH CHECK (public.is_super_admin());
