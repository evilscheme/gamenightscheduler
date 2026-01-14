-- Migration: Add "maybe" availability status and comment field
-- Run this in Supabase SQL Editor to migrate existing data

-- 1. Create the availability_status enum type
CREATE TYPE availability_status AS ENUM ('available', 'unavailable', 'maybe');

-- 2. Add new columns
ALTER TABLE availability
  ADD COLUMN status availability_status,
  ADD COLUMN comment TEXT;

-- 3. Migrate existing data
UPDATE availability
SET status = CASE
  WHEN is_available = true THEN 'available'::availability_status
  ELSE 'unavailable'::availability_status
END;

-- 4. Make status NOT NULL now that data is migrated
ALTER TABLE availability
  ALTER COLUMN status SET NOT NULL;

-- 5. Drop the old boolean column
ALTER TABLE availability
  DROP COLUMN is_available;
