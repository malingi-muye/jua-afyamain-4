-- ====================================================================
-- RUN THIS IN SUPABASE DASHBOARD SQL EDITOR
-- ====================================================================
-- This script fixes the invitations table RLS policies to support
-- upsert operations needed for re-sending invitations
-- ====================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can create invitations" ON public.invitations;
DROP POLICY IF EXISTS "Admins can update invitations" ON public.invitations;

-- Create INSERT policy for admins
CREATE POLICY "Admins can create invitations" ON public.invitations
    FOR INSERT WITH CHECK (
        clinic_id = (SELECT clinic_id FROM public.users WHERE id = auth.uid())
        AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'super_admin', 'Admin', 'SuperAdmin')
    );

-- Create UPDATE policy for admins (needed for upsert)
CREATE POLICY "Admins can update invitations" ON public.invitations
    FOR UPDATE USING (
        clinic_id = (SELECT clinic_id FROM public.users WHERE id = auth.uid())
        AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'super_admin', 'Admin', 'SuperAdmin')
    )
    WITH CHECK (
        clinic_id = (SELECT clinic_id FROM public.users WHERE id = auth.uid())
        AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'super_admin', 'Admin', 'SuperAdmin')
    );

-- Verify the policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'invitations'
ORDER BY policyname;
