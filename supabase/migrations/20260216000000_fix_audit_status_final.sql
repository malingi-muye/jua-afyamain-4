-- FIX: Audit Log Status Case Sensitivity
-- This migration updates the audit_logs table to support both lowercase and Title Case status values,
-- and updates the proc_audit_log function to use 'Success' as the default.

-- 1. Drop the existing constraint if possible (we don't know the exact name, but default is audit_logs_status_check)
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_status_check;

-- 2. Add a relaxed constraint
ALTER TABLE public.audit_logs 
ADD CONSTRAINT audit_logs_status_check 
CHECK (status IN ('success', 'failed', 'warning', 'Success', 'Failed', 'Warning'));

-- 3. Update the Audit Trigger Function to use Title Case 'Success'
CREATE OR REPLACE FUNCTION public.proc_audit_log()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_record RECORD;
    v_clinic_id UUID;
    v_action TEXT := TG_OP;
    v_old_data JSONB := NULL;
    v_new_data JSONB := NULL;
    v_resource_id TEXT;
BEGIN
    -- Only proceed if there is an authenticated user (ignore system/internal changes if needed, or track them as System)
    IF v_user_id IS NOT NULL THEN
        SELECT clinic_id, full_name, email, role INTO v_user_record FROM public.users WHERE id = v_user_id;
        v_clinic_id := v_user_record.clinic_id;
    ELSE
        -- Fallback for changes during signup or system processes
        -- Note: Profile might not exist yet for new signups
        IF TG_OP = 'DELETE' THEN
            v_clinic_id := OLD.clinic_id;
        ELSE
            v_clinic_id := NEW.clinic_id;
        END IF;
    END IF;

    -- Capture Data
    IF TG_OP = 'INSERT' THEN
        v_new_data := to_jsonb(NEW);
        v_resource_id := NEW.id::text;
    ELSIF TG_OP = 'UPDATE' THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        v_resource_id := NEW.id::text;
    ELSIF TG_OP = 'DELETE' THEN
        v_old_data := to_jsonb(OLD);
        v_resource_id := OLD.id::text;
    END IF;

    -- Insert into audit_logs
    INSERT INTO public.audit_logs (
        clinic_id,
        user_id,
        user_email,
        user_name,
        user_role,
        action,
        resource_type,
        resource_id,
        old_values,
        new_values,
        status
    ) VALUES (
        v_clinic_id,
        v_user_id,
        COALESCE(v_user_record.email, 'system@juaafya.com'),
        COALESCE(v_user_record.full_name, 'System'),
        COALESCE(v_user_record.role, 'system'),
        v_action,
        TG_TABLE_NAME,
        v_resource_id,
        v_old_data,
        v_new_data,
        'Success'
    );

    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
