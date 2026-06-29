-- ============================================================
-- Cuelyn — Supabase schema
-- Run this entire file in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── Drop existing policies (safe re-run) ──────────────────────
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ── Profiles ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE,
  display_name TEXT,
  email TEXT,
  bio TEXT,
  photo_url TEXT,
  cover_url TEXT,
  gender TEXT,
  vibe_tags TEXT[] DEFAULT '{}',
  signals_received_total INT DEFAULT 0,
  friends_count INT DEFAULT 0,
  followers_count INT DEFAULT 0,
  following_count INT DEFAULT 0,
  is_private BOOLEAN DEFAULT FALSE,
  show_on_leaderboard BOOLEAN DEFAULT TRUE,
  onboarding_complete BOOLEAN DEFAULT FALSE,
  notification_prefs JSONB DEFAULT '{}',
  fcm_tokens TEXT[] DEFAULT '{}',
  last_signal_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- ── Private vibes ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS private_vibes (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  content TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE private_vibes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "private_vibes_owner" ON private_vibes FOR ALL USING (auth.uid() = user_id);

-- ── Usernames ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usernames (
  username TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);
ALTER TABLE usernames ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usernames_select" ON usernames FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "usernames_all"    ON usernames FOR ALL    USING (auth.uid() = user_id);

-- ── Locations ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS locations (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  fuzzy_lat DOUBLE PRECISION,
  fuzzy_lng DOUBLE PRECISION,
  expires_at TIMESTAMPTZ
);
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "locations_select" ON locations FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "locations_all"    ON locations FOR ALL    USING (auth.uid() = user_id);

-- ── Signals ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS signals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_uid UUID REFERENCES auth.users(id),
  to_uid UUID REFERENCES auth.users(id),
  anonymous BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'pending',
  from_display_name TEXT,
  from_photo_url TEXT,
  from_gender TEXT,
  from_vibe_tag TEXT,
  to_display_name TEXT,
  sender_quote TEXT,
  location_label TEXT,
  chat_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signals_select" ON signals FOR SELECT USING (auth.uid() = from_uid OR auth.uid() = to_uid);
CREATE POLICY "signals_insert" ON signals FOR INSERT WITH CHECK (auth.uid() = from_uid);
CREATE POLICY "signals_update" ON signals FOR UPDATE USING (auth.uid() = from_uid OR auth.uid() = to_uid);
CREATE POLICY "signals_delete" ON signals FOR DELETE USING (auth.uid() = from_uid OR auth.uid() = to_uid);

-- ── Signal cooldowns ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS signal_cooldowns (
  id TEXT PRIMARY KEY,
  sender_uid UUID,
  target_uid UUID,
  last_sent TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE signal_cooldowns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cooldowns_all" ON signal_cooldowns FOR ALL USING (auth.uid() IS NOT NULL);

-- ── Chats ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  participants UUID[],
  signal_id UUID,
  anonymous BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'active',
  timer_seconds INT DEFAULT 300,
  timer_running BOOLEAN DEFAULT TRUE,
  timer_started_at TIMESTAMPTZ,
  pause_requested_by UUID,
  pause_accepted_by UUID,
  is_paused BOOLEAN DEFAULT FALSE,
  paused_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chats_all" ON chats FOR ALL USING (auth.uid() = ANY(participants));

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  sender_uid UUID,
  text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_messages_all" ON chat_messages FOR ALL USING (auth.uid() IS NOT NULL);

-- ── Friend chats ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS friend_chats (
  id TEXT PRIMARY KEY,
  participants UUID[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE friend_chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "friend_chats_all" ON friend_chats FOR ALL USING (auth.uid() = ANY(participants));

CREATE TABLE IF NOT EXISTS friend_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id TEXT REFERENCES friend_chats(id) ON DELETE CASCADE,
  sender_uid UUID,
  text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE friend_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "friend_messages_all" ON friend_messages FOR ALL USING (auth.uid() IS NOT NULL);

-- ── Friend requests ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS friend_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_uid UUID REFERENCES auth.users(id),
  to_uid UUID REFERENCES auth.users(id),
  chat_id UUID,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "friend_requests_select" ON friend_requests FOR SELECT USING (auth.uid() = from_uid OR auth.uid() = to_uid);
CREATE POLICY "friend_requests_insert" ON friend_requests FOR INSERT WITH CHECK (auth.uid() = from_uid);
CREATE POLICY "friend_requests_update" ON friend_requests FOR UPDATE USING (auth.uid() = from_uid OR auth.uid() = to_uid);
CREATE POLICY "friend_requests_delete" ON friend_requests FOR DELETE USING (auth.uid() = from_uid OR auth.uid() = to_uid);

-- ── Friends ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS friends (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_uid UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  photo_url TEXT,
  gender TEXT,
  vibe_tags TEXT[] DEFAULT '{}',
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, friend_uid)
);
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "friends_select" ON friends FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "friends_all"    ON friends FOR ALL    USING (auth.uid() IS NOT NULL);

-- ── Follows ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS follows (
  follower_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id)
);
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "follows_select" ON follows FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "follows_all"    ON follows FOR ALL    USING (auth.uid() = follower_id);

-- ── Blocks ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blocks (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_uid UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, blocked_uid)
);
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocks_all" ON blocks FOR ALL USING (auth.uid() = user_id);

-- ── Reports ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_uid UUID,
  reported_uid UUID,
  type TEXT DEFAULT 'user_report',
  reason TEXT,
  details TEXT,
  description TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_insert" ON reports FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ── Posts ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  uid UUID REFERENCES auth.users(id),
  content TEXT,
  likes INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts_select" ON posts FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "posts_insert" ON posts FOR INSERT WITH CHECK (auth.uid() = uid);
CREATE POLICY "posts_update" ON posts FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "posts_delete" ON posts FOR DELETE USING (auth.uid() = uid);

CREATE TABLE IF NOT EXISTS post_likes (
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  uid UUID REFERENCES auth.users(id),
  liked_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (post_id, uid)
);
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "post_likes_select" ON post_likes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "post_likes_all"    ON post_likes FOR ALL    USING (auth.uid() = uid);

CREATE TABLE IF NOT EXISTS comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  uid UUID REFERENCES auth.users(id),
  display_name TEXT,
  photo_url TEXT,
  gender TEXT,
  text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_select" ON comments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "comments_insert" ON comments FOR INSERT WITH CHECK (auth.uid() = uid);
CREATE POLICY "comments_delete" ON comments FOR DELETE USING (auth.uid() = uid);

-- ── Daily signals ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_signals (
  id TEXT PRIMARY KEY,
  uid UUID,
  count INT DEFAULT 0,
  date TEXT
);
ALTER TABLE daily_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily_signals_all" ON daily_signals FOR ALL USING (auth.uid() IS NOT NULL);

-- ── Glimpses ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS glimpses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  media_url TEXT,
  media_type TEXT,
  expires_at TIMESTAMPTZ,
  viewed_by UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE glimpses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "glimpses_select" ON glimpses FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "glimpses_insert" ON glimpses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "glimpses_update" ON glimpses FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "glimpses_delete" ON glimpses FOR DELETE USING (auth.uid() = user_id);

-- ── Vibe requests ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vibe_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user_id UUID REFERENCES auth.users(id),
  to_user_id UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'pending',
  score INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
ALTER TABLE vibe_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vibe_requests_select" ON vibe_requests FOR SELECT USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);
CREATE POLICY "vibe_requests_insert" ON vibe_requests FOR INSERT WITH CHECK (auth.uid() = from_user_id);
CREATE POLICY "vibe_requests_update" ON vibe_requests FOR UPDATE USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- ── Notifications ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT,
  from_user_id UUID,
  ref_id TEXT,
  title TEXT,
  body TEXT,
  score INT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_select" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_insert" ON notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "notifications_update" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- ── Matches (legacy) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user1 UUID,
  user2 UUID,
  matched_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "matches_all" ON matches FOR ALL USING (auth.uid() IS NOT NULL);

-- ============================================================
-- Trigger: auto-create profile row on signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- RPC: accept_friend_request
-- ============================================================
CREATE OR REPLACE FUNCTION accept_friend_request(
  p_request_id UUID, p_my_uid UUID, p_from_uid UUID,
  p_my_display_name TEXT, p_my_photo_url TEXT, p_my_gender TEXT, p_my_vibe_tags TEXT[],
  p_from_display_name TEXT, p_from_photo_url TEXT, p_from_gender TEXT, p_from_vibe_tags TEXT[]
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO friends (user_id, friend_uid, display_name, photo_url, gender, vibe_tags)
  VALUES (p_my_uid, p_from_uid, p_from_display_name, p_from_photo_url, p_from_gender, p_from_vibe_tags)
  ON CONFLICT (user_id, friend_uid) DO NOTHING;
  INSERT INTO friends (user_id, friend_uid, display_name, photo_url, gender, vibe_tags)
  VALUES (p_from_uid, p_my_uid, p_my_display_name, p_my_photo_url, p_my_gender, p_my_vibe_tags)
  ON CONFLICT (user_id, friend_uid) DO NOTHING;
  UPDATE friend_requests SET status = 'accepted', responded_at = NOW() WHERE id = p_request_id;
  UPDATE profiles SET friends_count = friends_count + 1 WHERE id = p_my_uid;
  UPDATE profiles SET friends_count = friends_count + 1 WHERE id = p_from_uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RPC: remove_friend
-- ============================================================
CREATE OR REPLACE FUNCTION remove_friend(p_uid1 UUID, p_uid2 UUID)
RETURNS VOID AS $$
BEGIN
  DELETE FROM friends WHERE (user_id = p_uid1 AND friend_uid = p_uid2) OR (user_id = p_uid2 AND friend_uid = p_uid1);
  UPDATE profiles SET friends_count = GREATEST(0, friends_count - 1) WHERE id = p_uid1;
  UPDATE profiles SET friends_count = GREATEST(0, friends_count - 1) WHERE id = p_uid2;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RPC: compute_vibe_score (server-side only, text never exposed)
-- ============================================================
CREATE OR REPLACE FUNCTION compute_vibe_score(uid1 UUID, uid2 UUID)
RETURNS INT AS $$
DECLARE
  text1 TEXT; text2 TEXT;
  words1 TEXT[]; words2 TEXT[];
  overlap_count INT; total INT;
BEGIN
  SELECT content INTO text1 FROM private_vibes WHERE user_id = uid1;
  SELECT content INTO text2 FROM private_vibes WHERE user_id = uid2;
  IF text1 IS NULL OR text2 IS NULL THEN RETURN NULL; END IF;
  words1 := string_to_array(lower(regexp_replace(text1, '[^a-zA-Z0-9\s]', '', 'g')), ' ');
  words2 := string_to_array(lower(regexp_replace(text2, '[^a-zA-Z0-9\s]', '', 'g')), ' ');
  SELECT COUNT(*) INTO overlap_count FROM unnest(words1) w WHERE w = ANY(words2) AND length(w) > 3;
  total := array_length(words1, 1) + array_length(words2, 1);
  IF total IS NULL OR total = 0 THEN RETURN 0; END IF;
  RETURN LEAST(100, ROUND((overlap_count * 2.0 / total) * 100 * 4));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RPC: respond_to_vibe_request
-- ============================================================
CREATE OR REPLACE FUNCTION respond_to_vibe_request(p_request_id UUID, p_responder_uid UUID, p_accept BOOLEAN)
RETURNS JSONB AS $$
DECLARE req RECORD; score_val INT;
BEGIN
  SELECT * INTO req FROM vibe_requests WHERE id = p_request_id;
  IF req IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF req.to_user_id != p_responder_uid THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_accept THEN
    score_val := compute_vibe_score(req.from_user_id, req.to_user_id);
    UPDATE vibe_requests SET status = 'accepted', score = score_val, resolved_at = NOW() WHERE id = p_request_id;
    RETURN jsonb_build_object('score', score_val, 'status', 'accepted');
  ELSE
    UPDATE vibe_requests SET status = 'declined', resolved_at = NOW() WHERE id = p_request_id;
    RETURN jsonb_build_object('status', 'declined');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RPC: send_vibe_request
-- ============================================================
CREATE OR REPLACE FUNCTION send_vibe_request(p_from_uid UUID, p_to_uid UUID)
RETURNS UUID AS $$
DECLARE new_id UUID;
BEGIN
  IF EXISTS (
    SELECT 1 FROM vibe_requests
    WHERE ((from_user_id = p_from_uid AND to_user_id = p_to_uid) OR (from_user_id = p_to_uid AND to_user_id = p_from_uid))
      AND status = 'pending'
  ) THEN RAISE EXCEPTION 'already-exists'; END IF;
  INSERT INTO vibe_requests (from_user_id, to_user_id) VALUES (p_from_uid, p_to_uid) RETURNING id INTO new_id;
  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Enable Realtime on key tables
-- ============================================================
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE signals;       EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE chats;          EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE friend_requests;EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE friends;         EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE friend_messages; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE friend_chats;   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE locations;      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE notifications;  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE vibe_requests;  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE follows;        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE glimpses;       EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE profiles;       EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE posts;          EXCEPTION WHEN duplicate_object THEN NULL; END $$;
