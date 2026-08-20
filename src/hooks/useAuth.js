import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getUserProfile, createUserProfile } from '../lib/db';

function normalizeUser(supabaseUser) {
  if (!supabaseUser) return null;
  return {
    uid: supabaseUser.id,
    email: supabaseUser.email,
    emailVerified: !!supabaseUser.email_confirmed_at,
    displayName: supabaseUser.user_metadata?.display_name || null,
    photoURL: supabaseUser.user_metadata?.photo_url || null,
    _raw: supabaseUser,
  };
}

export function useAuth() {
  const [user, setUser] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (u) => {
    try {
      let p = await getUserProfile(u.uid);
      if (!p) {
        await createUserProfile(u.uid, {
          displayName: u.displayName || u.email?.split('@')[0] || 'User',
          email: u.email,
          gender: null,
          vibeTags: [],
        });
        p = await getUserProfile(u.uid);
      }
      setProfile(p);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = normalizeUser(session?.user);
      setUser(u);
      if (u) loadProfile(u);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = normalizeUser(session?.user);
      setUser(u);
      if (u) {
        await loadProfile(u);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshProfile = async () => {
    if (user) {
      const p = await getUserProfile(user.uid);
      setProfile(p);
    }
  };

  return { user, profile, loading, refreshProfile };
}
