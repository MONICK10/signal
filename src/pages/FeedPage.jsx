import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  subscribeNearbyUsers, subscribeFriends,
  subscribeLocation, searchUsers,
} from '../firebase/firestore';
import { getDistanceKm } from '../utils/distance';
import { useToast } from '../components/Toast';

const NEARBY_RADIUS_KM = 0.5;
const GENDER_COLOR = { male: '#3B82F6', female: '#A855F7', other: '#F59E0B' };

function Avatar({ photoURL, displayName, gender, size = 44 }) {
  const bg = GENDER_COLOR[gender] || '#6C63FF';
  if (photoURL) {
    return (
      <img
        src={photoURL} alt=""
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
        onError={(e) => { e.target.style.display = 'none'; }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: size * 0.38, flexShrink: 0,
    }}>
      {(displayName || '?')[0].toUpperCase()}
    </div>
  );
}

function DistanceBadge({ km }) {
  const m = Math.round(km * 1000);
  const label = m < 1000 ? `~${m}m` : `~${km.toFixed(1)}km`;
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)',
      background: 'rgba(128,128,128,0.12)', padding: '3px 9px', borderRadius: 20,
      whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {label}
    </span>
  );
}

function NearbyCard({ nearbyUser, isFriend, distance, onClick }) {
  const name = nearbyUser.displayName || nearbyUser.username || 'Anonymous';
  const tags = (nearbyUser.vibeTags || []).slice(0, 3).join(' · ');

  return (
    <button
      onClick={onClick}
      style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px',
        background: 'var(--color-surface)',
        borderRadius: 14,
        marginBottom: 8,
        border: isFriend ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
      }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <Avatar photoURL={nearbyUser.photoURL} displayName={name} gender={nearbyUser.gender} size={44} />
          {isFriend && (
            <span style={{
              position: 'absolute', bottom: -2, right: -2, fontSize: 10,
              background: 'var(--color-primary)', borderRadius: '50%', width: 16, height: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
            }}>
              <i className="ti ti-check" style={{ fontSize: 9, lineHeight: 1 }} />
            </span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-primary)', lineHeight: 1.3 }}>
            {name}
            {isFriend && (
              <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--color-text-secondary)', marginLeft: 6 }}>friend</span>
            )}
          </div>
          {tags ? (
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {tags}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'rgba(128,128,128,0.4)', marginTop: 2, fontStyle: 'italic' }}>no vibe tags set</div>
          )}
        </div>
        <DistanceBadge km={distance} />
      </div>
    </button>
  );
}

function CardSkeleton() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--color-surface)', borderRadius: 14, marginBottom: 8, border: '1px solid var(--color-border)' }}>
      <div className="skeleton" style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="skeleton" style={{ height: 12, width: 100, borderRadius: 6 }} />
        <div className="skeleton" style={{ height: 10, width: 160, borderRadius: 6 }} />
      </div>
      <div className="skeleton" style={{ height: 22, width: 50, borderRadius: 10 }} />
    </div>
  );
}


export default function FeedPage({ user, profile, unreadNotifCount = 0 }) {
  const navigate = useNavigate();
  const [myCoords, setMyCoords] = useState(null);
  const [allVisible, setAllVisible] = useState([]);
  const [friendSet, setFriendSet] = useState(new Set());
  const [amVisible, setAmVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  /* ── Search state ── */
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const searchDebounceRef = useRef(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setMyCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }, []);

  useEffect(() => {
    return subscribeNearbyUsers((users) => {
      setAllVisible(users);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    return subscribeFriends(user.uid, (friends) => {
      setFriendSet(new Set(friends.map((f) => f.uid)));
    });
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    return subscribeLocation(user.uid, (data) => {
      if (!data) { setAmVisible(false); return; }
      const exp = data.expiresAt ? new Date(data.expiresAt) : null;
      setAmVisible(!!exp && exp > new Date());
    });
  }, [user?.uid]);

  /* ── Debounced search ── */
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!searchTerm.trim() || searchTerm.trim().length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const results = await searchUsers(searchTerm.trim());
        setSearchResults(results.filter((r) => r.id !== user?.uid));
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(searchDebounceRef.current);
  }, [searchTerm, user?.uid]);

  const nearbyFiltered = useMemo(() => {
    if (!myCoords) return [];
    return allVisible
      .filter((u) => u.id !== user?.uid)
      .map((u) => ({ ...u, dist: getDistanceKm(myCoords.lat, myCoords.lng, u.lat, u.lng) }))
      .filter((u) => u.dist <= NEARBY_RADIUS_KM)
      .sort((a, b) => {
        const af = friendSet.has(a.id) ? 0 : 1;
        const bf = friendSet.has(b.id) ? 0 : 1;
        if (af !== bf) return af - bf;
        return a.dist - b.dist;
      })
      .slice(0, 6);
  }, [allVisible, myCoords, friendSet, user?.uid]);

  const nearbyCount = nearbyFiltered.length;
  const isSearching = searchTerm.trim().length >= 2;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--color-bg)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: 'var(--color-brand-header)', padding: '52px 20px 14px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="ti ti-ghost" style={{ fontSize: 20, color: 'rgba(255,255,255,0.85)' }} />
            <span style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: -0.5 }}>Cuelyn</span>
          </div>
          <button
            onClick={() => navigate('/notifications')}
            style={{ position: 'relative', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}
          >
            <i className="ti ti-bell" style={{ fontSize: 18 }} />
            {unreadNotifCount > 0 && (
              <span style={{ position: 'absolute', top: 5, right: 5, width: 8, height: 8, borderRadius: '50%', background: '#ef4444', border: '1.5px solid var(--color-brand-header, #7c3aed)' }} />
            )}
          </button>
        </div>
        <div style={{ marginTop: 6, fontSize: 13, color: 'rgba(255,255,255,0.72)', fontWeight: 500 }}>
          {loading
            ? 'Looking around…'
            : !myCoords
              ? "Enable location to see who's nearby"
              : nearbyCount > 0
                ? `${nearbyCount} ${nearbyCount === 1 ? 'person' : 'people'} nearby right now`
                : 'No one nearby right now'}
        </div>

        {/* Search bar */}
        <div style={{ marginTop: 12, position: 'relative' }}>
          <i className="ti ti-search" style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: 'rgba(255,255,255,0.6)', fontSize: 16, pointerEvents: 'none',
          }} />
          <input
            style={{
              width: '100%', background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.25)', borderRadius: 12,
              padding: '10px 36px 10px 36px', fontSize: 14, color: '#fff',
              outline: 'none', fontFamily: 'inherit',
            }}
            placeholder="Search by name or @username"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm.length > 0 && (
            <button
              onClick={() => { setSearchTerm(''); setSearchResults([]); }}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', padding: 4 }}
            >
              <i className="ti ti-x" style={{ fontSize: 14 }} />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 90px' }}>

        {/* ── Search results ── */}
        {isSearching && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
              search results
            </div>
            {searching && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
                <span className="spinner" style={{ width: 24, height: 24 }} />
              </div>
            )}
            {!searching && searchResults.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px 16px', background: 'var(--color-surface)', borderRadius: 16, border: '1px solid var(--color-border)' }}>
                <i className="ti ti-user-search" style={{ fontSize: 28, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 8 }} />
                <div style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>No users found</div>
              </div>
            )}
            {!searching && searchResults.map((u) => (
              <button
                key={u.id}
                onClick={() => navigate(`/profile/${u.id}`)}
                style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', background: 'var(--color-surface)',
                  borderRadius: 14, marginBottom: 8, border: '1px solid var(--color-border)',
                }}>
                  <Avatar photoURL={u.photoURL} displayName={u.displayName} gender={u.gender} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-primary)' }}>
                      {u.displayName || 'Unknown'}
                    </div>
                    {u.username && (
                      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 1 }}>
                        @{u.username}
                      </div>
                    )}
                    {(u.vibeTags || []).length > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                        {u.vibeTags.slice(0, 3).join(' · ')}
                      </div>
                    )}
                  </div>
                  <i className="ti ti-chevron-right" style={{ color: 'var(--color-text-secondary)', fontSize: 16, flexShrink: 0 }} />
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ── Nearby section (hidden while searching) ── */}
        {!isSearching && (
          <>
            {/* Ghost mode banner */}
            {!amVisible && !loading && (
              <button
                onClick={() => navigate('/map')}
                style={{
                  width: '100%', textAlign: 'left',
                  background: 'var(--color-surface)',
                  border: '1.5px dashed var(--color-border)',
                  borderRadius: 14, padding: '12px 14px', marginBottom: 16,
                  display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--color-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className="ti ti-ghost" style={{ fontSize: 18, color: 'var(--color-primary)' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>You're in ghost mode</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 1 }}>Tap to go visible on the Map tab</div>
                </div>
                <i className="ti ti-chevron-right" style={{ fontSize: 16, color: 'var(--color-text-secondary)' }} />
              </button>
            )}

            {/* Nearby signals */}
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
              nearby signals
            </div>
            {loading ? (
              [1, 2, 3].map((n) => <CardSkeleton key={n} />)
            ) : nearbyFiltered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px 16px', background: 'var(--color-surface)', borderRadius: 16, border: '1px solid var(--color-border)' }}>
                <i className="ti ti-world" style={{ fontSize: 32, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 10 }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  {myCoords ? 'No signals nearby' : 'Location needed'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                  {myCoords
                    ? 'No one is visible within 500m right now'
                    : 'Allow location access to discover people nearby'}
                </div>
              </div>
            ) : (
              nearbyFiltered.map((u) => (
                <NearbyCard
                  key={u.id}
                  nearbyUser={u}
                  isFriend={friendSet.has(u.id)}
                  distance={u.dist}
                  onClick={() => navigate(`/profile/${u.id}`)}
                />
              ))
            )}
          </>
        )}
      </div>

    </div>
  );
}
