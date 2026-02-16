-- Add UPDATE policy for invitations table to support upsert
CREATE POLICY "Admins can update invitations" ON public.invitations
    FOR UPDATE USING (
        clinic_id = (SELECT clinic_id FROM public.users WHERE id = auth.uid())
        AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'super_admin', 'Admin', 'SuperAdmin')
    );

-- Also ensure the INSERT policy is robust
DROP POLICY IF EXISTS "Admins can create invitations" ON public.invitations;
CREATE POLICY "Admins can create invitations" ON public.invitations
    FOR INSERT WITH CHECK (
        clinic_id = (SELECT clinic_id FROM public.users WHERE id = auth.uid())
        AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'super_admin', 'Admin', 'SuperAdmin')
    );
