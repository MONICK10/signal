-- Switches the signal send limit from 1-per-hour to 6-per-rolling-hour.
-- Run once in the Supabase SQL Editor against your live project.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS signal_window_started_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS signal_window_count INT DEFAULT 0;
