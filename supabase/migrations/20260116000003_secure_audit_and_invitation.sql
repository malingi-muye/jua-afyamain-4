-- SECURE AUTOMATED AUDIT SYSTEM
-- This migration implements database-level auditing that cannot be bypassed by the client.

-- 1. Create the Audit Trigger Function
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
        v_user_record := ROW('System', 'system@juaafya.com', 'system');
        -- Try to infer clinic_id from the record itself if it has one
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

-- 2. Attach Triggers to Critical Tables
-- Patients
DROP TRIGGER IF EXISTS tr_audit_patients ON public.patients;
CREATE TRIGGER tr_audit_patients AFTER INSERT OR UPDATE OR DELETE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.proc_audit_log();

-- Medical Records
DROP TRIGGER IF EXISTS tr_audit_medical_records ON public.medical_records;
CREATE TRIGGER tr_audit_medical_records AFTER INSERT OR UPDATE OR DELETE ON public.medical_records FOR EACH ROW EXECUTE FUNCTION public.proc_audit_log();

-- Appointments
DROP TRIGGER IF EXISTS tr_audit_appointments ON public.appointments;
CREATE TRIGGER tr_audit_appointments AFTER INSERT OR UPDATE OR DELETE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.proc_audit_log();

-- Inventory
DROP TRIGGER IF EXISTS tr_audit_inventory ON public.inventory;
CREATE TRIGGER tr_audit_inventory AFTER INSERT OR UPDATE OR DELETE ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.proc_audit_log();

-- Transactions
DROP TRIGGER IF EXISTS tr_audit_transactions ON public.transactions;
CREATE TRIGGER tr_audit_transactions AFTER INSERT OR UPDATE OR DELETE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.proc_audit_log();

-- 3. Secure Invitation Lookup (For UX LUX)
-- This RPC allows a non-logged in user to see which clinic invited them
CREATE OR REPLACE FUNCTION public.get_invitation_details(p_invitation_id UUID)
RETURNS TABLE (
    clinic_name TEXT,
    invited_role TEXT,
    invited_email TEXT
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.name as clinic_name,
        i.role as invited_role,
        i.email as invited_email
    FROM public.invitations i
    JOIN public.clinics c ON c.id = i.clinic_id
    WHERE i.id = p_invitation_id
      AND i.status = 'pending'
      AND i.expires_at > now();
END;
$$;

-- Grant access to anonymouse users for invitation lookup
GRANT EXECUTE ON FUNCTION public.get_invitation_details(UUID) TO anon, authenticated;
GRANT SELECT ON public.clinics TO anon; -- Required for the join, but RLS protects actual clinical data
GRANT SELECT ON public.invitations TO anon; -- Required for the join
