-- Seed demo clinics and users for testing
-- Run this after running scripts/001-create-complete-schema.sql

-- 1. Create Demo Clinic
INSERT INTO public.clinics (name, slug, email, phone, location, country, currency, timezone, plan, plan_seats, status)
VALUES (
  'Demo Clinic',
  'demo-clinic',
  'admin@democlinic.com',
  '+254 XXX XXX XXX',
  'Nairobi, Kenya',
  'KE',
  'KES',
  'Africa/Nairobi',
  'pro',
  10,
  'active'
)
ON CONFLICT (slug) DO NOTHING;

-- 2. Create Test Hospital
INSERT INTO public.clinics (name, slug, email, phone, location, country, currency, timezone, plan, plan_seats, status)
VALUES (
  'Test Hospital',
  'test-hospital',
  'admin@testhospital.com',
  '+254 XXX XXX XXX',
  'Kisumu, Kenya',
  'KE',
  'KES',
  'Africa/Nairobi',
  'enterprise',
  20,
  'active'
)
ON CONFLICT (slug) DO NOTHING;

-- Note: Supabase Auth users must be created through the auth endpoint or Supabase dashboard
-- Demo Credentials:

-- Super Admin (System Admin)
-- Email: superadmin@juaafya.com
-- Password: JuaAfya@Demo123

-- Demo Clinic
-- Admin: admin@democlinic.com / Clinic@Demo123
-- Doctor: doctor@democlinic.com / Doctor@Demo123
-- Receptionist: receptionist@democlinic.com / Receptionist@Demo123

-- Test Hospital
-- Admin: admin@testhospital.com / Hospital@Demo123
