-- 012-add-message-tables.sql
-- Adds inbound_messages and outbound_messages tables for Twilio/SMS/WhatsApp processing
-- Run this against your Supabase/Postgres database (psql or supabase sql runner).

-- Note: requires the pgcrypto extension for gen_random_uuid() if not already enabled.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Inbound messages (from Twilio -> our system)
CREATE TABLE IF NOT EXISTS inbound_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_sid text NOT NULL,
  from_number text,
  to_number text,
  body text,
  media jsonb,
  status text,
  direction text,
  patient_id uuid,
  clinic_id uuid,
  raw_payload jsonb,
  received_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

-- Enforce idempotency on message SID
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'inbound_messages_message_sid_idx'
  ) THEN
    CREATE UNIQUE INDEX inbound_messages_message_sid_idx ON inbound_messages (message_sid);
  END IF;
END$$;

-- Outbound messages (messages we send out)
CREATE TABLE IF NOT EXISTS outbound_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_sid text,
  to_number text,
  from_number text,
  body text,
  media jsonb,
  status text,
  direction text,
  patient_id uuid,
  clinic_id uuid,
  raw_payload jsonb,
  sent_at timestamptz DEFAULT now(),
  delivered_at timestamptz
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'outbound_messages_message_sid_idx'
  ) THEN
    CREATE UNIQUE INDEX outbound_messages_message_sid_idx ON outbound_messages (message_sid);
  END IF;
END$$;

-- Optional: add basic foreign key constraints if `patients` and `clinics` tables exist.
-- ALTER TABLE inbound_messages ADD CONSTRAINT fk_inbound_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL;
-- ALTER TABLE inbound_messages ADD CONSTRAINT fk_inbound_clinic FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE SET NULL;

-- End of migration