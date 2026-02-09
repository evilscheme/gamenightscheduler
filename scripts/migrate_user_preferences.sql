-- Migration: Add user internationalization preferences
-- Run this against the production database manually.

ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS week_start_day INTEGER DEFAULT 0 CHECK (week_start_day IN (0, 1));
ALTER TABLE users ADD COLUMN IF NOT EXISTS time_format TEXT DEFAULT '12h' CHECK (time_format IN ('12h', '24h'));
