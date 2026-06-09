import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/auth';
import { getUserProfile, createUserProfile } from '../firebase/firestore';

export function useAuth() {
  const [user, setUser] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          let p = await getUserProfile(firebaseUser.uid);
          if (!p) {
            // Profile doc missing — create a skeleton so writes don't fail
            await createUserProfile(firebaseUser.uid, {
              displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
              email: firebaseUser.email,
              age: null,
              gender: null,
              vibeTags: [],
            });
            p = await getUserProfile(firebaseUser.uid);
          }
          setProfile(p);
        } catch {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const refreshProfile = async () => {
    if (user) {
      const p = await getUserProfile(user.uid);
      setProfile(p);
    }
  };

  return { user, profile, loading, refreshProfile };
}
