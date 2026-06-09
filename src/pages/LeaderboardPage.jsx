import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLeaderboardUsers } from '../firebase/firestore';
import { getDistanceKm } from '../utils/distance';
import EmptyState from '../components/EmptyState';

const LEADERBOARD_RADIUS_KM = 0.05; // 50 meters

function medalColor(count) {
  if (count >= 500) return '#B9F2FF';
  if (count >= 100) return '#FFD700';
  if (count >= 50)  return '#C0C0C0';
  if (count >= 10)  return '#CD7F32';
  return null;
}

function medalIcon(count) {
  if (count >= 500) return 'ti-diamond';
  return 'ti-medal';
}

function RankBadge({ rank }) {
  const bg = rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : '#CD7F32';
  return (
    <div style={{ width: 20, height: 20, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: rank === 1 ? '#7a5200' : '#fff', flexShrink: 0 }}>
      {rank}
    </div>
  );
}

function Avatar({ u, size }) {
  const colors = { male: '#FF4B6E', female: '#00CC88', other: '#AA66FF' };
  const bg = colors[u.gender] || 'var(--color-primary)';
  const mc = medalColor(u.signalsReceivedTotal || 0);
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {u.photoURL
        ? <img src={u.photoURL} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${bg}` }} />
        : <div style={{ width: size, height: size, borderRadius: '50%', background: bg, border: `3px solid ${bg}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: size * 0.35 }}>{(u.firstName || '?')[0].toUpperCase()}</div>
      }
      {mc && (
        <i className={`ti ${medalIcon(u.signalsReceivedTotal || 0)}`} style={{ position: 'absolute', bottom: -2, right: -2, fontSize: 14, color: mc, background: 'var(--color-bg)', borderRadius: '50%', padding: 1 }} />
      )}
    </div>
  );
}

function Podium({ users }) {
  const order = [users[1], users[0], users[2]].filter(Boolean);
  const heights = [80, 100, 60];
  const sizes = [56, 68, 48];
  const ranks = [2, 1, 3];

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 16, padding: '24px 16px 8px', background: 'var(--color-surface)', borderRadius: 20, margin: '0 16px 16px' }}>
      {order.map((u, i) => u && (
        <div key={u.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
          {ranks[i] === 1 && <i className="ti ti-crown" style={{ fontSize: 20, color: '#FFD700' }} />}
          <Avatar u={u} size={sizes[i]} />
          <div style={{ fontSize: 12, fontWeight: 700, textAlign: 'center', maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.firstName}</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{u.signalsReceivedTotal || 0}</div>
          <div style={{ width: '100%', height: heights[i], background: `rgba(0,102,255,${0.15 + i * 0.05})`, borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 6 }}>
            <RankBadge rank={ranks[i]} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LeaderboardPage({ user, userCoords, profile }) {
  const navigate = useNavigate();
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [genderFilter, setGenderFilter] = useState('all');

  useEffect(() => {
    getLeaderboardUsers().then(setAll).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = all
    .filter((u) => u.leaderboardEnabled)
    .filter((u) => {
      if (!userCoords) return true;
      return getDistanceKm(userCoords.lat, userCoords.lng, u.lat, u.lng) <= LEADERBOARD_RADIUS_KM;
    })
    .filter((u) => genderFilter === 'all' || u.gender === genderFilter)
    .sort((a, b) => (b.signalsReceivedTotal || 0) - (a.signalsReceivedTotal || 0))
    .slice(0, 50);

  const myEntry = all.find((u) => u.id === user?.uid);
  const myRank = myEntry?.leaderboardEnabled
    ? filtered.findIndex((u) => u.id === user?.uid) + 1
    : -1;

  return (
    <div className="page" style={{ paddingBottom: myEntry ? 80 : 24 }}>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 22, padding: 0 }}>
            <i className="ti ti-arrow-left" />
          </button>
          <div>
            <h2>Nearby Leaderboard</h2>
            <p className="caption">Top Signal receivers within 50m</p>
          </div>
        </div>
      </div>

      {/* Gender filter */}
      <div style={{ display: 'flex', gap: 8, padding: '0 16px 16px' }}>
        {['all', 'male', 'female'].map((g) => (
          <button
            key={g}
            onClick={() => setGenderFilter(g)}
            style={{ padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, border: `1.5px solid ${genderFilter === g ? 'transparent' : 'var(--color-border)'}`, background: genderFilter === g ? 'var(--color-primary)' : 'var(--color-surface)', color: genderFilter === g ? '#fff' : 'var(--color-text-secondary)', cursor: 'pointer' }}
          >
            {g === 'all' ? 'All' : g.charAt(0).toUpperCase() + g.slice(1)}
          </button>
        ))}
      </div>

      {loading && [1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 64, borderRadius: 16, margin: '0 16px 8px' }} />)}

      {!loading && filtered.length === 0 && (
        <EmptyState
          icon="ti-trophy"
          title="No one on the board yet"
          subtitle={"Not enough nearby users\nhave opted into the leaderboard"}
        />
      )}

      {!loading && filtered.length >= 3 && <Podium users={filtered} />}

      {/* Rest of list */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.slice(filtered.length >= 3 ? 3 : 0).map((u, i) => {
          const rank = (filtered.length >= 3 ? 3 : 0) + i + 1;
          const mc = medalColor(u.signalsReceivedTotal || 0);
          const colors = { male: '#FF4B6E', female: '#00CC88', other: '#AA66FF' };
          const borderColor = colors[u.gender] || 'var(--color-primary)';
          return (
            <div key={u.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-secondary)', width: 24, textAlign: 'center' }}>#{rank}</span>
              <Avatar u={u} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{u.firstName}</div>
              </div>
              {u.gender && (
                <span className="chip" style={{ fontSize: 11, color: borderColor, padding: '3px 8px' }}>
                  {u.gender.charAt(0).toUpperCase() + u.gender.slice(1)}
                </span>
              )}
              <span style={{ fontWeight: 700, color: mc || 'var(--color-primary)', fontSize: 15 }}>{u.signalsReceivedTotal || 0}</span>
            </div>
          );
        })}
      </div>

      {/* Own rank sticky footer */}
      {!loading && (
        <div style={{ position: 'fixed', bottom: 64, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 430, padding: '10px 16px', background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)', zIndex: 20 }}>
          {myEntry?.leaderboardEnabled
            ? <div style={{ fontSize: 14, fontWeight: 600, textAlign: 'center', color: 'var(--color-primary)' }}>
                Your rank: #{myRank > 0 ? myRank : '?'} · {myEntry?.signalsReceivedTotal || 0} signals
              </div>
            : <div style={{ fontSize: 13, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                Your rank is hidden · Enable in Profile → Settings
              </div>
          }
        </div>
      )}
    </div>
  );
}
