-- JuaAfya Complete Schema with Clinic-based Multitenancy
-- This is the single source of truth for database schema
-- Run this script once to set up the entire system

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. CLINICS TABLE (Multi-tenant root - replaces organizations)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clinics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT,
  phone TEXT,
  location TEXT,
  logo_url TEXT,
  country TEXT NOT NULL DEFAULT 'KE',
  currency TEXT NOT NULL DEFAULT 'KES',
  timezone TEXT NOT NULL DEFAULT 'Africa/Nairobi',
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  plan_seats INTEGER NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending', 'cancelled')),
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  settings JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_clinics_slug ON public.clinics(slug);
CREATE INDEX IF NOT EXISTS idx_clinics_status ON public.clinics(status);
CREATE INDEX IF NOT EXISTS idx_clinics_created_at ON public.clinics(created_at);

-- ============================================================
-- 2. USERS TABLE (with clinic context)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'doctor' CHECK (role IN ('super_admin', 'admin', 'doctor', 'nurse', 'receptionist', 'lab_tech', 'pharmacist', 'accountant')),
  department TEXT,
  license_number TEXT,
  specialization TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended', 'deactivated')),
  last_login_at TIMESTAMP WITH TIME ZONE,
  last_active_at TIMESTAMP WITH TIME ZONE,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT super_admin_no_clinic CHECK (role != 'super_admin' OR clinic_id IS NULL),
  UNIQUE(clinic_id, email)
);

CREATE INDEX IF NOT EXISTS idx_users_clinic_id ON public.users(clinic_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);

-- ============================================================
-- 3. PATIENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  mrn TEXT NOT NULL, -- Medical Record Number
  email TEXT,
  full_name TEXT NOT NULL,
  date_of_birth DATE,
  phone_number TEXT,
  gender TEXT CHECK (gender IN ('Male', 'Female', 'Other')),
  blood_type TEXT CHECK (blood_type IN ('A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-')),
  allergies TEXT[] DEFAULT '{}',
  chronic_conditions TEXT[] DEFAULT '{}',
  next_of_kin_name TEXT,
  next_of_kin_phone TEXT,
  insurance_provider TEXT,
  insurance_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(clinic_id, mrn),
  UNIQUE(clinic_id, email)
);

CREATE INDEX IF NOT EXISTS idx_patients_clinic ON public.patients(clinic_id);
CREATE INDEX IF NOT EXISTS idx_patients_mrn ON public.patients(clinic_id, mrn);
CREATE INDEX IF NOT EXISTS idx_patients_name ON public.patients(full_name);

-- ============================================================
-- 4. APPOINTMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no-show')),
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_appointments_clinic ON public.appointments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON public.appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON public.appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON public.appointments(appointment_date);

-- ============================================================
-- 5. MEDICAL RECORDS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.medical_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL CHECK (record_type IN ('consultation', 'diagnosis', 'prescription', 'lab_result', 'imaging', 'procedure')),
  title TEXT NOT NULL,
  description TEXT,
  findings TEXT,
  treatment_plan TEXT,
  attachments JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_medical_records_clinic ON public.medical_records(clinic_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_patient ON public.medical_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_doctor ON public.medical_records(doctor_id);

-- ============================================================
-- 6. INVENTORY TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Medicine', 'Supply', 'Lab', 'Equipment')),
  quantity_in_stock INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER DEFAULT 10,
  unit TEXT DEFAULT 'pcs',
  price DECIMAL(10, 2) DEFAULT 0,
  supplier_id UUID,
  batch_number TEXT,
  expiry_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(clinic_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_inventory_clinic ON public.inventory(clinic_id);
CREATE INDEX IF NOT EXISTS idx_inventory_sku ON public.inventory(clinic_id, sku);
CREATE INDEX IF NOT EXISTS idx_inventory_low_stock ON public.inventory(clinic_id) WHERE quantity_in_stock <= reorder_level;

-- ============================================================
-- 7. SUPPLIERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_suppliers_clinic ON public.suppliers(clinic_id);

-- ============================================================
-- 8. VISITS TABLE (Patient Flow/Queue)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.visits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  queue_number INTEGER,
  stage TEXT DEFAULT 'check-in' CHECK (stage IN ('check-in', 'vitals', 'consultation', 'lab', 'billing', 'pharmacy', 'clearance', 'completed')),
  stage_start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent', 'emergency')),
  vital_signs JSONB,
  chief_complaint TEXT,
  diagnosis TEXT,
  doctor_notes TEXT,
  lab_orders JSONB DEFAULT '[]',
  prescription JSONB DEFAULT '[]',
  consultation_fee DECIMAL(10, 2) DEFAULT 0,
  total_bill DECIMAL(10, 2) DEFAULT 0,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_visits_clinic ON public.visits(clinic_id);
CREATE INDEX IF NOT EXISTS idx_visits_patient ON public.visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_stage ON public.visits(stage);

-- ============================================================
-- 9. AUDIT LOGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  user_email TEXT,
  user_name TEXT,
  user_role TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  old_values JSONB,
  new_values JSONB,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'Success' CHECK (status IN ('Success', 'Failed', 'Warning')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_clinic ON public.audit_logs(clinic_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);

-- ============================================================
-- 10. ACTIVITIES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,
  resource_type TEXT,
  resource_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activities_clinic ON public.activities(clinic_id);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON public.activities(created_at);

-- ============================================================
-- 11. ENABLE ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 12. HELPER FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_clinic_id()
RETURNS UUID AS $$
  SELECT clinic_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT role = 'super_admin' FROM public.users WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_clinic_admin()
RETURNS BOOLEAN AS $$
  SELECT role IN ('admin', 'super_admin') FROM public.users WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ============================================================
-- 13. RLS POLICIES
-- ============================================================

-- CLINICS: Users see their own clinic, super admins see all
DROP POLICY IF EXISTS "Users can view own clinic" ON public.clinics;
CREATE POLICY "Users can view own clinic" ON public.clinics
  FOR SELECT USING (id = public.get_user_clinic_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Super admins can manage all clinics" ON public.clinics;
CREATE POLICY "Super admins can manage all clinics" ON public.clinics
  FOR ALL USING (public.is_super_admin());

DROP POLICY IF EXISTS "Clinic admins can update own clinic" ON public.clinics;
CREATE POLICY "Clinic admins can update own clinic" ON public.clinics
  FOR UPDATE USING (id = public.get_user_clinic_id() AND public.is_clinic_admin());

-- USERS: Users see people in their clinic, super admins see all
DROP POLICY IF EXISTS "Users can view clinic members" ON public.users;
CREATE POLICY "Users can view clinic members" ON public.users
  FOR SELECT USING (clinic_id = public.get_user_clinic_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Clinic admins can manage users" ON public.users;
CREATE POLICY "Clinic admins can manage users" ON public.users
  FOR ALL USING (clinic_id = public.get_user_clinic_id() AND public.is_clinic_admin());

-- PATIENTS: Users see patients in their clinic
DROP POLICY IF EXISTS "Users can view clinic patients" ON public.patients;
CREATE POLICY "Users can view clinic patients" ON public.patients
  FOR SELECT USING (clinic_id = public.get_user_clinic_id());

DROP POLICY IF EXISTS "Clinic admins can manage patients" ON public.patients;
CREATE POLICY "Clinic admins can manage patients" ON public.patients
  FOR ALL USING (clinic_id = public.get_user_clinic_id() AND public.is_clinic_admin());

-- APPOINTMENTS: Users see appointments in their clinic
DROP POLICY IF EXISTS "Users can view clinic appointments" ON public.appointments;
CREATE POLICY "Users can view clinic appointments" ON public.appointments
  FOR SELECT USING (clinic_id = public.get_user_clinic_id());

DROP POLICY IF EXISTS "Doctors can create appointments" ON public.appointments;
CREATE POLICY "Doctors can create appointments" ON public.appointments
  FOR INSERT WITH CHECK (clinic_id = public.get_user_clinic_id());

-- MEDICAL RECORDS: Users see records in their clinic
DROP POLICY IF EXISTS "Users can view clinic records" ON public.medical_records;
CREATE POLICY "Users can view clinic records" ON public.medical_records
  FOR SELECT USING (clinic_id = public.get_user_clinic_id());

-- INVENTORY: Users see inventory in their clinic
DROP POLICY IF EXISTS "Users can view clinic inventory" ON public.inventory;
CREATE POLICY "Users can view clinic inventory" ON public.inventory
  FOR SELECT USING (clinic_id = public.get_user_clinic_id());

-- VISITS: Users see visits in their clinic
DROP POLICY IF EXISTS "Users can view clinic visits" ON public.visits;
CREATE POLICY "Users can view clinic visits" ON public.visits
  FOR SELECT USING (clinic_id = public.get_user_clinic_id());

-- AUDIT LOGS: Users see their clinic logs, super admins see all
DROP POLICY IF EXISTS "Users can view clinic audit logs" ON public.audit_logs;
CREATE POLICY "Users can view clinic audit logs" ON public.audit_logs
  FOR SELECT USING (clinic_id = public.get_user_clinic_id() OR public.is_super_admin());

-- ACTIVITIES: Users see their clinic activities
DROP POLICY IF EXISTS "Users can view clinic activities" ON public.activities;
CREATE POLICY "Users can view clinic activities" ON public.activities
  FOR SELECT USING (clinic_id = public.get_user_clinic_id());

-- ============================================================
-- 14. UPDATED AT TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_clinics_updated_at ON public.clinics;
CREATE TRIGGER update_clinics_updated_at
  BEFORE UPDATE ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_patients_updated_at ON public.patients;
CREATE TRIGGER update_patients_updated_at
  BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 15. AUDIT LOGGING FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.audit_log_event(
  p_clinic_id UUID,
  p_user_id UUID,
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id TEXT,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_audit_id UUID;
  v_user_email TEXT;
  v_user_name TEXT;
  v_user_role TEXT;
BEGIN
  -- Get user details
  SELECT email, full_name, role INTO v_user_email, v_user_name, v_user_role
  FROM public.users WHERE id = p_user_id;

  -- Insert audit log
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
    metadata,
    status
  ) VALUES (
    p_clinic_id,
    p_user_id,
    v_user_email,
    v_user_name,
    v_user_role,
    p_action,
    p_resource_type,
    p_resource_id,
    p_old_values,
    p_new_values,
    COALESCE(p_metadata, '{}'),
    'Success'
  ) RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.audit_log_event TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_clinic_id TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_clinic_admin TO anon, authenticated;
