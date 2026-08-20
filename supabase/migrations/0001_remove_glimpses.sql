-- Removes the Glimpses (stories) feature entirely.
-- Run this once in the Supabase SQL Editor against your live project.

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE glimpses;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DROP TABLE IF EXISTS glimpses;
