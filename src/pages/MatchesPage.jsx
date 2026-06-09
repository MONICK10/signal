import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import ThemeToggle from '../components/ThemeToggle';
import MatchCard from '../components/MatchCard';
import VibeTagChip from '../components/VibeTagChip';
import EmptyState from '../components/EmptyState';
import { subscribeMatches, getUserProfile } from '../firebase/firestore';

function GenderBadge({ gender }) {
  const map = {
    male:   { label: 'Male',   color: 'var(--color-male)' },
    female: { label: 'Female', color: 'var(--color-female)' },
    other:  { label: 'Other',  color: 'var(--color-other)' },
  };
  const { label, color } = map[gender] || { label: gender, color: 'var(--color-primary)' };
  return <span className="chip" style={{ color, fontSize: 12, padding: '4px 10px' }}>{label}</span>;
}

function MatchModal({ match, profile, onClose }) {
  const matchedAt = match.matchedAt?.toDate?.() || new Date();
  const timeAgo = formatDistanceToNow(matchedAt, { addSuffix: true });
  const colors = { male: 'var(--color-male)', female: 'var(--color-female)', other: 'var(--color-other)' };
  const bg = colors[profile?.gender] || 'var(--color-primary)';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 32, border: `3px solid ${bg}` }}>
            {(profile?.displayName || '?')[0].toUpperCase()}
          </div>

          <div style={{ textAlign: 'center' }}>
            <h3 style={{ marginBottom: 8 }}>{profile?.displayName || 'User'}</h3>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {profile?.gender && <GenderBadge gender={profile.gender} />}
              {profile?.age && <span className="caption">{profile.age} yrs</span>}
            </div>
          </div>

          {profile?.vibeTags?.length > 0 && (
            <div className="vibe-grid" style={{ justifyContent: 'center' }}>
              {profile.vibeTags.map((tag) => <VibeTagChip key={tag} label={tag} />)}
            </div>
          )}

          <div className="card" style={{ width: '100%', textAlign: 'center', background: 'var(--color-surface-2)' }}>
            <p style={{ fontSize: 15, color: 'var(--color-text-secondary)' }}>
              You both noticed each other in the real world. Say hi next time 👋
            </p>
            <p className="caption" style={{ marginTop: 8 }}>Matched {timeAgo}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MatchesPage({ user }) {
  const [matches, setMatches] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeMatches(user.uid, async (data) => {
      setMatches(data);
      setLoading(false);

      const otherUids = data.map((m) => m.user1 === user.uid ? m.user2 : m.user1);
      const newProfiles = {};
      await Promise.all(
        otherUids.map(async (uid) => {
          if (!profiles[uid]) {
            try { newProfiles[uid] = await getUserProfile(uid); } catch {}
          }
        })
      );
      if (Object.keys(newProfiles).length > 0) {
        setProfiles((prev) => ({ ...prev, ...newProfiles }));
      }
    });
    return unsub;
  }, [user?.uid]);

  return (
    <div className="page">
      <div className="page-header">
        <h2>Matches</h2>
        <ThemeToggle />
      </div>

      <div className="page-content">
        {loading && (
          <div className="matches-grid">
            {[1,2,3,4].map((i) => <div key={i} className="skeleton" style={{ height: 160, borderRadius: 16 }} />)}
          </div>
        )}

        {!loading && matches.length === 0 && (
          <EmptyState
            icon="ti-heart"
            title="No matches yet"
            subtitle={"Accept signals to start\nconnecting with people"}
          />
        )}

        {!loading && matches.length > 0 && (
          <div className="matches-grid">
            {matches.map((match) => {
              const otherUid = match.user1 === user.uid ? match.user2 : match.user1;
              const profile = profiles[otherUid];
              return (
                <MatchCard
                  key={match.id}
                  match={match}
                  profile={profile}
                  onClick={() => setSelected({ match, profile })}
                />
              );
            })}
          </div>
        )}
      </div>

      {selected && (
        <MatchModal
          match={selected.match}
          profile={selected.profile}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
