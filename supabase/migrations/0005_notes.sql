-- Adds the Notes feature: short public requests/offers visible to everyone
-- within a poster's radius, expiring after 6 hours.
-- Run once in the Supabase SQL Editor against your live project.

CREATE TABLE IF NOT EXISTS notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 120),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  report_count INT NOT NULL DEFAULT 0,
  CHECK (expires_at = created_at + INTERVAL '6 hours')
);
CREATE INDEX IF NOT EXISTS notes_user_id_idx ON notes(user_id);
CREATE INDEX IF NOT EXISTS notes_expires_at_idx ON notes(expires_at);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Any signed-in user can read notes (client filters to expired/nearby).
CREATE POLICY "notes_select" ON notes FOR SELECT USING (auth.uid() IS NOT NULL);

-- A user can only insert a note for themselves, only while they have an
-- active (non-expired) row in `locations` — i.e. they're visible on the
-- map, not in ghost mode — and only if they don't already have another
-- active note (posting a new one requires deleting the old one first).
CREATE POLICY "notes_insert" ON notes FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM locations WHERE user_id = auth.uid() AND expires_at > NOW())
  AND NOT EXISTS (SELECT 1 FROM notes existing WHERE existing.user_id = auth.uid() AND existing.expires_at > NOW())
);

-- Only the owner can delete their own note.
CREATE POLICY "notes_delete" ON notes FOR DELETE USING (auth.uid() = user_id);

-- Deliberately no UPDATE policy: nobody, including the owner, can modify a
-- note's text/location after posting. The only mutation path is
-- report_note() below, which runs SECURITY DEFINER and bypasses RLS.
CREATE OR REPLACE FUNCTION report_note(p_note_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE notes SET report_count = report_count + 1 WHERE id = p_note_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE notes; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
