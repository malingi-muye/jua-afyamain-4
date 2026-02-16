-- Optimizing Dashboard & List Queries

-- 1. Accelerate "Today's Appointments" and "Scheduled" lookups
CREATE INDEX IF NOT EXISTS idx_appointments_date_status ON appointments(date, status);

-- 2. Accelerate "Patients Queue" (Visits pending)
CREATE INDEX IF NOT EXISTS idx_visits_stage ON visits(stage);

-- 3. Accelerate Patient List sorting (default view)
CREATE INDEX IF NOT EXISTS idx_patients_created_at ON patients(created_at DESC);

-- 4. Accelerate Revenue & Visit Stats (Time range filtering)
CREATE INDEX IF NOT EXISTS idx_visits_start_time ON visits(start_time);

-- 5. Accelerate "Low Stock" Alerts
CREATE INDEX IF NOT EXISTS idx_inventory_stock ON inventory(stock);

-- 6. Accelerate Transaction History lookups
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
