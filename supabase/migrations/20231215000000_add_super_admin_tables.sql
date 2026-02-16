-- Create Transactions Table for SaaS Billing
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID REFERENCES public.clinics(id) ON DELETE SET NULL,
    amount NUMERIC NOT NULL,
    currency TEXT DEFAULT 'KES',
    status TEXT NOT NULL CHECK (status IN ('Success', 'Pending', 'Failed')),
    method TEXT NOT NULL CHECK (method IN ('Card', 'M-Pesa', 'Bank Transfer')),
    plan TEXT,
    reference TEXT UNIQUE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Policy: Clinics can view their own transactions
CREATE POLICY "Clinics can view own transactions" ON public.transactions
    FOR SELECT
    USING (auth.uid() IN (
        SELECT id FROM public.users WHERE clinic_id = transactions.clinic_id
    ));

-- Policy: Super Admins can view all transactions (assuming is_super_admin() function exists or based on role)
-- For simplicity in this demo ID schema:
-- CREATE POLICY "Super Admins view all transactions" ON public.transactions
--     FOR ALL
--     USING (public.is_super_admin());


-- Create Support Tickets Table
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    subject TEXT NOT NULL,
    priority TEXT CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
    status TEXT DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Resolved')),
    messages JSONB DEFAULT '[]'::jsonb, -- Array of { role: 'user'|'admin', text: '', timestamp: '' }
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Support Tickets
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Policy: Clinics can view and create their own tickets
CREATE POLICY "Clinics can view own tickets" ON public.support_tickets
    FOR SELECT
    USING (clinic_id IN (
        SELECT clinic_id FROM public.users WHERE id = auth.uid()
    ));

CREATE POLICY "Clinics can create tickets" ON public.support_tickets
    FOR INSERT
    WITH CHECK (clinic_id IN (
        SELECT clinic_id FROM public.users WHERE id = auth.uid()
    ));

CREATE POLICY "Clinics can update own tickets" ON public.support_tickets
    FOR UPDATE
    USING (clinic_id IN (
        SELECT clinic_id FROM public.users WHERE id = auth.uid()
    ));
