-- Removes the Glimpses (stories) feature entirely.
-- Run this once in the Supabase SQL Editor against your live project.

ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS glimpses;
DROP TABLE IF EXISTS glimpses;
