-- Migration: Add start_time and end_time to sessions table
-- Run this if you already have the database set up

ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS start_time TIME,
ADD COLUMN IF NOT EXISTS end_time TIME;
