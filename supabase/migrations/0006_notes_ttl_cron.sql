-- Native scheduled deletion for expired notes — Postgres/Supabase has no
-- per-collection TTL like Firestore, so pg_cron (a first-party Postgres
-- extension, runs entirely inside the database, no external Cloud
-- Function or app-side cron) is the closest equivalent.
--
-- Run once in the Supabase SQL Editor against your live project, AFTER
-- 0005_notes.sql. If the first line errors with "permission denied to
-- create extension", enable it via Console instead:
--   Supabase Dashboard → your project → Database → Extensions →
--   search "pg_cron" → toggle it on. Then re-run just the two
--   statements below (skip the CREATE EXTENSION line).

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'notes-ttl-cleanup',
  '*/10 * * * *',  -- every 10 minutes
  $$DELETE FROM public.notes WHERE expires_at < now()$$
);

-- The app also filters client-side with expires_at > now() on every
-- query, so a note disappears from the UI at exactly 6 hours even though
-- this job only runs on a 10-minute cadence.

-- To check the job later:
--   SELECT * FROM cron.job WHERE jobname = 'notes-ttl-cleanup';
-- To remove it:
--   SELECT cron.unschedule('notes-ttl-cleanup');
