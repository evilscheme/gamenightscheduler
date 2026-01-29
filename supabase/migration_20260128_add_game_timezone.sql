-- Add timezone column to games table
-- Stores IANA timezone identifier (e.g., 'America/Los_Angeles')
-- Used for calendar exports (ICS files) to include proper timezone information

ALTER TABLE games ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Los_Angeles';

-- Note: Default ensures existing games get a timezone for calendar exports
-- New games will auto-detect from browser and can be changed in game settings
