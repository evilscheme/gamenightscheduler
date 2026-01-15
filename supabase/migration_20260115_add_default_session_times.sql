-- Migration: Add default session times to games table
-- Run this on existing databases to add default_start_time and default_end_time columns

-- Add columns with default values
ALTER TABLE games ADD COLUMN IF NOT EXISTS default_start_time TIME DEFAULT '18:00';
ALTER TABLE games ADD COLUMN IF NOT EXISTS default_end_time TIME DEFAULT '22:00';
