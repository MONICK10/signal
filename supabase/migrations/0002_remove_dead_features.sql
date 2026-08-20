-- Removes Leaderboard, Vibe Checker, Posts, and legacy Matches per product spec.
-- Run once in the Supabase SQL Editor against your live project.

-- Take tables out of realtime publication first (safe if not present)
DO $$ BEGIN ALTER PUBLICATION supabase_realtime DROP TABLE vibe_requests; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime DROP TABLE posts;         EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Vibe Checker
DROP FUNCTION IF EXISTS respond_to_vibe_request(UUID, UUID, BOOLEAN);
DROP FUNCTION IF EXISTS send_vibe_request(UUID, UUID);
DROP FUNCTION IF EXISTS compute_vibe_score(UUID, UUID);
DROP TABLE IF EXISTS vibe_requests;
DROP TABLE IF EXISTS private_vibes;

-- Posts
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS post_likes;
DROP TABLE IF EXISTS posts;

-- Legacy matches (never populated by any code path)
DROP TABLE IF EXISTS matches;

-- Leaderboard
ALTER TABLE profiles DROP COLUMN IF EXISTS show_on_leaderboard;
