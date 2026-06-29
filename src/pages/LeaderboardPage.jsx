import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection, query, where, onSnapshot, Timestamp,
} from 'firebase/firestore';
import { db, getUserProfile } from '../firebase/firestore';
import { getDistanceKm } from '../utils/distance';

const RADIUS_KM = 0.1;

function Avatar({ photoURL, name, gender, size = 44 }) {
  const colors = { male: '#3B82F6', female: '#A855F7', other: '#F59E0B' };
  const bg = colors[gender] || 'var(--color-primary)';
  if (photoURL) {
    return <img src={photoURL} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${bg}` }} />;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: size * 0.4 }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}

function RankBadge({ rank }) {
  if (rank === 1) return <span style={{ fontSize: 24 }}>🥇</span>;
  if (rank === 2) return <span style={{ fontSize: 24 }}>🥈</span>;
  if (rank === 3) return <span style={{ fontSize: 24 }}>🥉</span>;
  return <div style={{ width: 28, textAlign: 'center', fontWeight: 700, fontSize: 15, color: 'var(--color-text-secondary)' }}>{rank}</div>;
}

export default function LeaderboardPage({ user }) {
  const navigate = useNavigate();
  const [myCoords, setMyCoords] = useState(null);
  const [geoError, setGeoError] = useState(false);
  const [ranked, setRanked] = useState([]);
  const [loading, setLoading] = useState(false);
  const profileCache = useRef({});

  // Get GPS coords once
  useEffect(() => {
    if (!navigator.geolocation) { setGeoError(true); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => setMyCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeoError(true),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  // Subscribe to visible locations, filter to 100m, then fetch profiles
  useEffect(() => {
    if (!myCoords || !user?.uid) return;
    const now = Timestamp.now();
    const q = query(collection(db, 'locations'), where('expiresAt', '>', now));
    const unsub = onSnapshot(q, async (snap) => {
      setLoading(true);
      const nearby = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((u) => u.id !== user.uid && getDistanceKm(myCoords.lat, myCoords.lng, u.lat, u.lng) <= RADIUS_KM);

      const profiles = await Promise.all(
        nearby.map(async (u) => {
          if (!profileCache.current[u.id]) {
            try { profileCache.current[u.id] = await getUserProfile(u.id); } catch { profileCache.current[u.id] = null; }
          }
          return { ...u, profile: profileCache.current[u.id] };
        })
      );

      const entries = profiles
        .filter((e) => e.profile && !e.profile.leaderboardOptOut)
        .sort((a, b) => (b.profile.signalsReceivedTotal || 0) - (a.profile.signalsReceivedTotal || 0));

      setRanked(entries);
      setLoading(false);
    });
    return unsub;
  }, [myCoords, user?.uid]);

  return (
    <div className="page" style={{ paddingBottom: 80 }}>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.9)', fontSize: 22, padding: 0 }}>
            <i className="ti ti-arrow-left" />
          </button>
          <h2 style={{ color: '#fff' }}>Nearby Leaderboard</h2>
        </div>
        <i className="ti ti-trophy" style={{ fontSize: 22, color: '#FFD700' }} />
      </div>

      <div style={{ padding: '12px 16px 4px', fontSize: 13, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <i className="ti ti-radar" style={{ fontSize: 14 }} />
        Top signal-getters within 100m of you
      </div>

      {geoError && (
        <div style={{ margin: 16, padding: 20, background: 'var(--color-surface)', borderRadius: 14, border: '1px solid var(--color-border)', textAlign: 'center' }}>
          <i className="ti ti-map-pin-off" style={{ fontSize: 36, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 8 }} />
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Location unavailable</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Allow location access to see the leaderboard</div>
        </div>
      )}

      {!geoError && !myCoords && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <span className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      )}

      {myCoords && !loading && ranked.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 40, textAlign: 'center' }}>
          <i className="ti ti-users-group" style={{ fontSize: 48, color: 'var(--color-text-secondary)' }} />
          <div style={{ fontWeight: 600 }}>No one nearby right now</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>The leaderboard shows visible users within 100m</div>
        </div>
      )}

      {ranked.map((entry, i) => {
        const rank = i + 1;
        const p = entry.profile;
        const isMe = entry.id === user?.uid;
        return (
          <div
            key={entry.id}
            onClick={() => navigate(`/profile/${entry.id}`)}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 20px',
              background: isMe ? 'var(--color-surface-2)' : 'var(--color-bg)',
              borderBottom: '1px solid var(--color-border)',
              cursor: 'pointer',
              borderLeft: isMe ? '3px solid var(--color-primary)' : '3px solid transparent',
            }}
          >
            <RankBadge rank={rank} />
            <Avatar photoURL={p?.photoURL} name={p?.displayName} gender={p?.gender} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p?.displayName || 'Unknown'}
                {isMe && <span style={{ fontSize: 12, color: 'var(--color-primary)', fontWeight: 400, marginLeft: 6 }}>(you)</span>}
              </div>
              {p?.username && <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>@{p.username}</div>}
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 20, color: 'var(--color-primary)' }}>{p?.signalsReceivedTotal || 0}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>signals</div>
            </div>
          </div>
        );
      })}

      {loading && myCoords && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
          <span className="spinner" style={{ width: 24, height: 24 }} />
        </div>
      )}
    </div>
  );
}
