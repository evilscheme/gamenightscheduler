ALTER TABLE availability ADD COLUMN IF NOT EXISTS available_after TIME;
ALTER TABLE availability ADD COLUMN IF NOT EXISTS available_until TIME;
