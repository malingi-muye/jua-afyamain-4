-- Create lab_test_profiles table if it does not exist
CREATE TABLE IF NOT EXISTS public.lab_test_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Haematology', 'Biochemistry', 'Microbiology', 'Serology', 'Radiology', 'Pathology', 'General')),
  unit TEXT,
  reference_range TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure name is unique per clinic
  UNIQUE(clinic_id, name)
);

-- Access control policies
ALTER TABLE public.lab_test_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view lab tests from their clinic" 
ON public.lab_test_profiles FOR SELECT
USING (auth.uid() IN (
    SELECT id FROM public.users WHERE clinic_id = lab_test_profiles.clinic_id
));

CREATE POLICY "Clinic admins can manage lab tests" 
ON public.lab_test_profiles FOR ALL
USING (auth.uid() IN (
    SELECT id FROM public.users WHERE clinic_id = lab_test_profiles.clinic_id 
    AND role IN ('admin', 'super_admin', 'Admin', 'SuperAdmin')
));

-- Insert some default lab test profiles for existing clinics based on likely defaults
INSERT INTO public.lab_test_profiles (clinic_id, name, category, unit, reference_range, price)
SELECT 
    id as clinic_id,
    'Full Blood Count',
    'Haematology',
    'cells/L',
    '4.0-10.0',
    500
FROM public.clinics
ON CONFLICT DO NOTHING;

INSERT INTO public.lab_test_profiles (clinic_id, name, category, unit, reference_range, price)
SELECT 
    id as clinic_id,
    'Malaria Smear',
    'Microbiology',
    '',
    'Negative',
    200
FROM public.clinics
ON CONFLICT DO NOTHING;
