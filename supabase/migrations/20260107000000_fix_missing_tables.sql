-- Migration to fix missing tables: platform_settings and notifications

-- 1. Create platform_settings table
CREATE TABLE IF NOT EXISTS public.platform_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    settings JSONB NOT NULL DEFAULT '{
        "maintenanceMode": false,
        "allowNewRegistrations": true,
        "globalAnnouncement": "",
        "pricing": {"free": 0, "pro": 5000, "enterprise": 15000},
        "gateways": {
            "mpesa": {"paybill": "522522", "account": "JUAAFYA", "name": "JuaAfya Ltd", "enabled": true},
            "bank": {"name": "KCB Bank", "branch": "Head Office", "account": "1100223344", "swift": "KCBLKENX", "enabled": true},
            "paystack": {"publicKey": "", "secretKey": "", "enabled": false}
        }
    }'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT single_row CHECK (id = 1)
);

-- Initialize platform_settings if it doesn't exist
INSERT INTO public.platform_settings (id, settings)
VALUES (1, '{
    "maintenanceMode": false,
    "allowNewRegistrations": true,
    "globalAnnouncement": "",
    "pricing": {"free": 0, "pro": 5000, "enterprise": 15000},
    "gateways": {
        "mpesa": {"paybill": "522522", "account": "JUAAFYA", "name": "JuaAfya Ltd", "enabled": true},
        "bank": {"name": "KCB Bank", "branch": "Head Office", "account": "1100223344", "swift": "KCBLKENX", "enabled": true},
        "paystack": {"publicKey": "", "secretKey": "", "enabled": false}
    }
}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 2. Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for platform_settings
CREATE POLICY "Anyone can view platform settings" ON public.platform_settings
    FOR SELECT USING (true);

CREATE POLICY "Super admins can update platform settings" ON public.platform_settings
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'SuperAdmin'
        )
    );

-- 5. RLS Policies for notifications
CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System/Admins can create notifications" ON public.notifications
    FOR INSERT WITH CHECK (true); -- Usually created by edge functions or triggers

CREATE POLICY "Users can update (mark as read) own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id);
