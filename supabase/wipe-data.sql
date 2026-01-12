-- Wipe all data from database tables (keeps schema intact)
-- Run this in Supabase SQL Editor
-- WARNING: This permanently deletes all data!

-- Truncate all tables with CASCADE to handle foreign key relationships
-- Order matters less with CASCADE, but we'll go from dependent to parent tables

TRUNCATE TABLE sessions CASCADE;
TRUNCATE TABLE availability CASCADE;
TRUNCATE TABLE game_memberships CASCADE;
TRUNCATE TABLE games CASCADE;
TRUNCATE TABLE users CASCADE;

-- Verify tables are empty
SELECT 'users' as table_name, COUNT(*) as row_count FROM users
UNION ALL
SELECT 'games', COUNT(*) FROM games
UNION ALL
SELECT 'game_memberships', COUNT(*) FROM game_memberships
UNION ALL
SELECT 'availability', COUNT(*) FROM availability
UNION ALL
SELECT 'sessions', COUNT(*) FROM sessions;
