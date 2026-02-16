-- Migration to fix Support Ticket and Transaction access for Super Admins

-- 1. Support Tickets Policies
-- Drop existing policies if they might conflict or be updated
-- Note: Migration 20231215000000_add_super_admin_tables.sql created "Clinics can view own tickets" etc.

-- Allow Super Admins to view all support tickets
CREATE POLICY "Super Admins can view all tickets" ON public.support_tickets
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE public.users.id = auth.uid() AND public.users.role = 'SuperAdmin'
        )
    );

-- Allow Super Admins to update support tickets (reply, resolve, change priority)
CREATE POLICY "Super Admins can update all tickets" ON public.support_tickets
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE public.users.id = auth.uid() AND public.users.role = 'SuperAdmin'
        )
    );

-- 2. Transactions Policies
-- Allow Super Admins to view all financials
CREATE POLICY "Super Admins can view all transactions" ON public.transactions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE public.users.id = auth.uid() AND public.users.role = 'SuperAdmin'
        )
    );

-- 3. Ensure updated_at is handled for support_tickets
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_support_tickets_updated_at ON public.support_tickets;
CREATE TRIGGER set_support_tickets_updated_at
    BEFORE UPDATE ON public.support_tickets
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
