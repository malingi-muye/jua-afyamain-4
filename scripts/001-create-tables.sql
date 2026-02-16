-- JuaAfya Clinic Database Schema
-- Run this script to create all required tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Clinics table (for multi-tenant support)
CREATE TABLE IF NOT EXISTS clinics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  owner_name TEXT,
  email TEXT,
  phone TEXT,
  location TEXT,
  plan TEXT DEFAULT 'Free',
  status TEXT DEFAULT 'Active',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Patients table
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT,
  age INTEGER,
  gender TEXT CHECK (gender IN ('Male', 'Female', 'Other')),
  last_visit TIMESTAMPTZ,
  notes TEXT,
  history TEXT[] DEFAULT '{}',
  vitals JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory table
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  stock INTEGER DEFAULT 0,
  min_stock_level INTEGER DEFAULT 10,
  unit TEXT DEFAULT 'pcs',
  category TEXT CHECK (category IN ('Medicine', 'Supply', 'Lab', 'Equipment')),
  price DECIMAL(10,2) DEFAULT 0,
  batch_number TEXT,
  expiry_date DATE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Appointments table
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Completed', 'Cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Visits table (patient flow/queue)
CREATE TABLE IF NOT EXISTS visits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  stage TEXT DEFAULT 'Check-In' CHECK (stage IN ('Check-In', 'Vitals', 'Consultation', 'Lab', 'Billing', 'Pharmacy', 'Clearance', 'Completed')),
  stage_start_time TIMESTAMPTZ DEFAULT NOW(),
  start_time TIMESTAMPTZ DEFAULT NOW(),
  queue_number INTEGER,
  priority TEXT DEFAULT 'Normal' CHECK (priority IN ('Normal', 'Urgent', 'Emergency')),
  insurance_details JSONB,
  vitals JSONB,
  chief_complaint TEXT,
  diagnosis TEXT,
  doctor_notes TEXT,
  lab_orders JSONB DEFAULT '[]',
  prescription JSONB DEFAULT '[]',
  medications_dispensed BOOLEAN DEFAULT FALSE,
  consultation_fee DECIMAL(10,2) DEFAULT 0,
  total_bill DECIMAL(10,2) DEFAULT 0,
  payment_status TEXT DEFAULT 'Pending' CHECK (payment_status IN ('Pending', 'Paid')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory logs table
CREATE TABLE IF NOT EXISTS inventory_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID REFERENCES inventory(id) ON DELETE SET NULL,
  item_name TEXT,
  action TEXT CHECK (action IN ('Created', 'Updated', 'Restocked', 'Deleted', 'Dispensed')),
  quantity_change INTEGER,
  notes TEXT,
  user_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(name);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_stage ON visits(stage);
CREATE INDEX IF NOT EXISTS idx_visits_patient ON visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category);

-- Insert a default clinic for demo
INSERT INTO clinics (name, owner_name, email, plan, status)
VALUES ('JuaAfya Demo Clinic', 'Dr. Demo', 'demo@juaafya.com', 'Pro', 'Active')
ON CONFLICT DO NOTHING;
