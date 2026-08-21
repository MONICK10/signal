import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import { divIcon } from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import Logo from '../components/Logo';
import ThemeToggle from '../components/ThemeToggle';
import BottomSheet from '../components/BottomSheet';
import VibeTagChip from '../components/VibeTagChip';
import { useToast } from '../components/Toast';
import UserActionMenu from '../components/UserActionMenu';
import NotePostSheet from '../components/NotePostSheet';
import NotesListSheet from '../components/NotesListSheet';
import { makeNoteMarkerIcon } from '../components/NoteMarker';
import { useNearbyUsers } from '../hooks/useNearbyUsers';
import { useNotes } from '../hooks/useNotes';
import { setLocation, updateLocation, deleteLocation, getLocation, postNote, deleteNote, reportNote } from '../lib/db';
import { fuzzyLocation } from '../utils/fuzzyLocation';
import { getDistanceKm, fuzzyDistance } from '../utils/distance';
import { sendSignal } from '../utils/signalLimit';


// OpenTopoMap: free, no API key. Native tiles only go to zoom 17 — maxNativeZoom
// below tells Leaflet to upscale those instead of requesting tiles that don't exist.
const TILE_URL = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '© OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)';
const TILE_MAX_NATIVE_ZOOM = 17;
const VISIBLE_DURATION_MS = 2 * 60 * 60 * 1000;
const NEARBY_RADIUS_KM = 5;

function genderBorderColor(gender) {
  if (gender === 'male')   return '#3B82F6';
  if (gender === 'female') return '#A855F7';
  return '#F59E0B';
}

function genderGlowRgb(gender) {
  if (gender === 'male')   return '59,130,246';
  if (gender === 'female') return '168,85,247';
  return '245,158,11';
}

function offsetDuplicates(users) {
  const groups = {};
  users.forEach((u) => {
    const key = `${u.lat},${u.lng}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(u.id);
  });
  const SPREAD = 0.0003;
  return users.map((u) => {
    const key = `${u.lat},${u.lng}`;
    const group = groups[key];
    if (group.length === 1) return u;
    const idx = group.indexOf(u.id);
    const angle = (2 * Math.PI * idx) / group.length;
    return { ...u, lat: u.lat + SPREAD * Math.sin(angle), lng: u.lng + SPREAD * Math.cos(angle) };
  });
}

function makeMarkerIcon(u, distanceKm) {
  const color = genderBorderColor(u.gender);
  const glow = genderGlowRgb(u.gender);
  const firstName = (u.firstName || 'U').split(' ')[0];
  const distLabel = distanceKm != null ? fuzzyDistance(distanceKm) : null;
  const html = renderToStaticMarkup(
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, animation: 'markerAppear 0.3s ease' }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        border: `2.5px solid ${color}`, overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: color, boxSizing: 'border-box', flexShrink: 0,
        boxShadow: `0 0 0 4px rgba(${glow},0.14), 0 0 18px -2px rgba(${glow},0.6)`,
      }}>
        {u.photoURL
          ? <img src={u.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
          : <span style={{ color: '#fff', fontWeight: 700, fontSize: 20, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>{firstName[0].toUpperCase()}</span>
        }
      </div>
      <div style={{
        background: 'rgba(10,15,26,0.82)', color: '#F1F5FB',
        border: '1px solid rgba(124,168,255,0.22)',
        borderRadius: 20, padding: '3px 10px',
        fontSize: 11, fontWeight: 700, fontFamily: "'Plus Jakarta Sans',sans-serif",
        whiteSpace: 'nowrap', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis',
        display: 'flex', alignItems: 'center', gap: 5,
      }}>
        <span>{firstName}</span>
        {distLabel && <span style={{ opacity: 0.6, fontWeight: 600 }}>· {distLabel}</span>}
      </div>
    </div>
  );
  return divIcon({ html, className: '', iconSize: [90, 90], iconAnchor: [45, 72] });
}

function CurrentUserIcon(profile) {
  const firstName = (profile?.displayName || 'Me').split(' ')[0];
  const html = renderToStaticMarkup(
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        border: '3px solid #E11D48', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#E11D48', boxSizing: 'border-box', flexShrink: 0,
      }}>
        {profile?.photoURL
          ? <img src={profile.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
          : <span style={{ color: '#fff', fontWeight: 700, fontSize: 20, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>{(firstName[0] || 'M').toUpperCase()}</span>
        }
      </div>
      <div style={{
        background: 'rgba(255,59,59,0.85)', color: '#fff',
        borderRadius: 20, padding: '2px 8px',
        fontSize: 11, fontWeight: 700, fontFamily: "'Plus Jakarta Sans',sans-serif",
        whiteSpace: 'nowrap',
      }}>You</div>
    </div>
  );
  return divIcon({ html, className: '', iconSize: [80, 84], iconAnchor: [40, 68] });
}

function RecenterMap({ coords }) {
  const map = useMap();
  const didCenter = useRef(false);
  useEffect(() => {
    if (coords && !didCenter.current) {
      map.setView([coords.lat, coords.lng], 19, { animate: true });
      didCenter.current = true;
    }
  }, [coords, map]);
  return null;
}

function GenderBadge({ gender }) {
  const map = {
    male:   { label: 'Male',   color: 'var(--color-male)' },
    female: { label: 'Female', color: 'var(--color-female)' },
    other:  { label: 'Other',  color: 'var(--color-other)' },
  };
  const { label, color } = map[gender] || { label: gender, color: 'var(--color-primary)' };
  return <span className="chip" style={{ color, fontSize: 12, padding: '4px 10px' }}>{label}</span>;
}

function FilterPill({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600,
        border: `1.5px solid ${active ? 'transparent' : 'var(--color-border)'}`,
        background: active ? 'var(--color-primary)' : 'var(--color-surface)',
        color: active ? '#fff' : 'var(--color-text-secondary)',
        cursor: 'pointer', transition: 'all 0.2s',
      }}
    >{label}</button>
  );
}

function SignalModeCard({ title, icon, subtitle, description, selected, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1, padding: '16px 12px', borderRadius: 16, cursor: 'pointer',
        border: `2px solid ${selected ? 'var(--color-primary)' : 'var(--color-border)'}`,
        background: selected ? 'rgba(47,111,237,0.08)' : 'var(--color-surface)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        transition: 'all 0.2s',
      }}
    >
      <div style={{ fontSize: 28, lineHeight: 1 }}>{icon}</div>
      <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', textAlign: 'center' }}>{subtitle}</div>}
      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', textAlign: 'center', lineHeight: 1.4 }}>{description}</div>
    </div>
  );
}

function VisibilityPrompt({ onGoVisible, onDismiss }) {
  return (
    <BottomSheet onClose={onDismiss}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className="ti ti-radio" style={{ fontSize: 28, color: '#fff' }} />
        </div>
        <div>
          <h3>Ready to be discovered?</h3>
          <p style={{ marginTop: 8, fontSize: 15, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            Go visible so people nearby can find you on the map.
            You control when you&apos;re seen.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
          <button className="btn btn-primary btn-full" onClick={onGoVisible}>
            Go Visible Now
          </button>
          <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 15, padding: '10px 0', fontWeight: 500 }}>
            Maybe Later
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

export default function MapPage({ user, profile, unreadNotifCount = 0 }) {
  const navigate = useNavigate();
  const showToast = useToast();

  const [userCoords, setUserCoords] = useState(null);
  const userCoordsRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [showVisibilityPrompt, setShowVisibilityPrompt] = useState(false);
  const lastUpdateRef = useRef(0);
  const [expiresAt, setExpiresAt] = useState(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [sendingSignal, setSendingSignal] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [genderFilter, setGenderFilter] = useState('all');
  const [senderQuote, setSenderQuote] = useState('');
  const [showPostNote, setShowPostNote] = useState(false);
  const [showNotesList, setShowNotesList] = useState(false);
  const [selectedNote, setSelectedNote] = useState(null);
  const [noteAnonymous, setNoteAnonymous] = useState(false);
  const [sendingNoteSignal, setSendingNoteSignal] = useState(false);

  const allNearbyUsers = useNearbyUsers(user?.uid);
  const allNotes = useNotes(user?.uid);

  // Filter by radius and gender, then spread any markers that share the same fuzzy coordinate
  const nearbyUsers = offsetDuplicates(
    allNearbyUsers
      .filter((u) => {
        if (!userCoordsRef.current) return true;
        const dist = getDistanceKm(userCoordsRef.current.lat, userCoordsRef.current.lng, u.lat, u.lng);
        return dist <= NEARBY_RADIUS_KM;
      })
      .filter((u) => genderFilter === 'all' || u.gender === genderFilter)
  );

  // Notes visible to everyone within the same radius used for person markers
  const nearbyNotes = allNotes.filter((n) => {
    if (n.uid === user?.uid) return true;
    if (!userCoordsRef.current) return true;
    return getDistanceKm(userCoordsRef.current.lat, userCoordsRef.current.lng, n.lat, n.lng) <= NEARBY_RADIUS_KM;
  });

  // First-time visibility prompt (shown once after onboarding)
  useEffect(() => {
    const alreadyPrompted = localStorage.getItem('cuelyn_visibility_prompted') === 'true';
    if (!alreadyPrompted) {
      const t = setTimeout(() => setShowVisibilityPrompt(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  // Restore visibility state after reload: check if active location row exists in Supabase
  useEffect(() => {
    if (!user?.uid) return;
    getLocation(user.uid).then((loc) => {
      if (!loc) return;
      const exp = loc.expiresAt ? new Date(loc.expiresAt) : null;
      if (exp && exp > new Date()) {
        setVisible(true);
        setExpiresAt(exp.getTime());
      } else {
        deleteLocation(user.uid).catch(() => {});
      }
    }).catch(() => {});
  }, [user?.uid]);

  // Watch position continuously (UI updates every reading; Firestore debounced to 5s in the interval below)
  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserCoords(coords);
        userCoordsRef.current = coords;
      },
      () => showToast('Location access denied', 'error'),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // Update Firestore location every 5 seconds when visible (debounced)
  useEffect(() => {
    if (!visible || !user?.uid) return;
    const interval = setInterval(async () => {
      const now = Date.now();
      if (now - lastUpdateRef.current < 5000) return;
      lastUpdateRef.current = now;
      const coords = userCoordsRef.current;
      if (!coords) return;
      const fuzzy = fuzzyLocation(coords.lat, coords.lng);
      try {
        await updateLocation(user.uid, {
          lat: fuzzy.lat, lng: fuzzy.lng,
          expiresAt: new Date(Date.now() + VISIBLE_DURATION_MS),
        });
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [visible, user?.uid]);

  // Expiry countdown
  useEffect(() => {
    if (!visible || !expiresAt) { setTimeLeft(''); return; }
    const tick = () => {
      const rem = expiresAt - Date.now();
      if (rem <= 0) { setVisible(false); setExpiresAt(null); return; }
      const h = Math.floor(rem / 3600000);
      const m = Math.floor((rem % 3600000) / 60000);
      setTimeLeft(`${h}h ${m}m left`);
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [visible, expiresAt]);

  const toggleVisibility = async () => {
    if (!userCoords || !user || !profile) { showToast('Location not available yet', 'error'); return; }
    if (visible) {
      try {
        await deleteLocation(user.uid);
        setVisible(false); setExpiresAt(null);
        showToast('Gone ghost');
      } catch { showToast('Failed to go ghost', 'error'); }
    } else {
      try {
        const fuzzy = fuzzyLocation(userCoords.lat, userCoords.lng);
        const exp = new Date(Date.now() + VISIBLE_DURATION_MS);
        await setLocation(user.uid, {
          lat: fuzzy.lat, lng: fuzzy.lng,
          gender: profile.gender,
          firstName: profile.displayName,
          vibeTag: profile.vibeTags?.[0] || '',
          photoURL: profile.photoURL || null,
          expiresAt: exp,
        });
        setVisible(true); setExpiresAt(exp.getTime());
        showToast("You're visible for 2 hours");
      } catch { showToast('Failed to go visible', 'error'); }
    }
  };

  const handleSignal = useCallback(async () => {
    if (!selectedUser || !user || !profile) return;
    setSendingSignal(true);
    const enrichedProfile = { ...profile, senderQuote: senderQuote.trim() || null, toDisplayName: selectedUser.firstName || null };
    const signalId = await sendSignal(user.uid, selectedUser.id, anonymous, enrichedProfile, showToast);
    setSendingSignal(false);
    if (signalId) {
      setSelectedUser(null);
      setSenderQuote('');
      showToast('Signal sent!', 'success');
    }
  }, [selectedUser, user, profile, anonymous, senderQuote, showToast]);

  const distanceToSelected = selectedUser && userCoordsRef.current
    ? getDistanceKm(userCoordsRef.current.lat, userCoordsRef.current.lng, selectedUser.lat, selectedUser.lng)
    : null;

  const handleOpenPostNote = () => {
    if (!visible) { showToast('Go visible to post a Note', 'error'); return; }
    setShowPostNote(true);
  };

  const handlePostNote = async (text) => {
    if (!userCoords || !user) return;
    try {
      const fuzzy = fuzzyLocation(userCoords.lat, userCoords.lng);
      await postNote(user.uid, { text, lat: fuzzy.lat, lng: fuzzy.lng });
      showToast('Note posted — visible for 6 hours');
    } catch {
      showToast('Failed to post Note', 'error');
    }
  };

  const handleDeleteNote = async (noteId) => {
    try {
      await deleteNote(noteId);
      showToast('Note deleted');
    } catch { showToast('Failed to delete Note', 'error'); }
  };

  const handleReportNote = async (noteId) => {
    try {
      await reportNote(noteId);
      showToast('Note reported. Thank you.');
    } catch { showToast('Failed to report Note', 'error'); }
  };

  const handleReplyToNote = (note) => {
    setShowNotesList(false);
    setSelectedNote(note);
    setNoteAnonymous(false);
  };

  const handleSendNoteSignal = useCallback(async () => {
    if (!selectedNote || !user || !profile) return;
    setSendingNoteSignal(true);
    const enrichedProfile = { ...profile, senderQuote: null, toDisplayName: null };
    const signalId = await sendSignal(user.uid, selectedNote.uid, noteAnonymous, enrichedProfile, showToast);
    setSendingNoteSignal(false);
    if (signalId) {
      setSelectedNote(null);
      showToast('Signal sent!', 'success');
    }
  }, [selectedNote, user, profile, noteAnonymous, showToast]);

  const defaultCenter = userCoords || { lat: 12.9716, lng: 77.5946 };

  return (
    <div className="map-page">
      <style>{`
        @keyframes markerAppear {
          from { transform: scale(0.5); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
      `}</style>

      <div className="map-container">
        <MapContainer
          center={[defaultCenter.lat, defaultCenter.lng]}
          zoom={19}
          maxZoom={19}
          zoomControl={false}
          style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
        >
          <TileLayer
            url={TILE_URL}
            attribution={TILE_ATTRIBUTION}
            maxZoom={19}
            maxNativeZoom={TILE_MAX_NATIVE_ZOOM}
          />
          {userCoords && <RecenterMap coords={userCoords} />}
          {userCoords && visible && <Marker position={[userCoords.lat, userCoords.lng]} icon={CurrentUserIcon(profile)} />}
          {nearbyUsers.map((u) => (
            <Marker
              key={u.id}
              position={[u.lat, u.lng]}
              icon={makeMarkerIcon(u, userCoordsRef.current
                ? getDistanceKm(userCoordsRef.current.lat, userCoordsRef.current.lng, u.lat, u.lng)
                : null)}
              eventHandlers={{ click: () => { setSelectedUser(u); setAnonymous(false); } }}
            />
          ))}
          {nearbyNotes.map((n) => (
            <Marker
              key={n.id}
              position={[n.lat, n.lng]}
              icon={makeNoteMarkerIcon(n)}
              eventHandlers={{ click: () => { if (n.uid !== user?.uid) { setSelectedNote(n); setNoteAnonymous(false); } } }}
            />
          ))}
        </MapContainer>

        {/* Warm ambient glow over the tiles — keeps the map from reading as a stock Leaflet embed */}
        <div className="map-glow-overlay" />

        {/* Top bar */}
        <div className="map-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Logo variant="icon" size={32} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => navigate('/notifications')}
              style={{ position: 'relative', background: 'rgba(128,128,128,0.15)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-text-primary)' }}
              title="Notifications"
            >
              <i className="ti ti-bell" style={{ fontSize: 18 }} />
              {unreadNotifCount > 0 && (
                <span style={{ position: 'absolute', top: 5, right: 5, width: 8, height: 8, borderRadius: '50%', background: '#ef4444', border: '1.5px solid var(--color-bg)' }} />
              )}
            </button>
            <ThemeToggle />
          </div>
        </div>

        {/* Gender filter pills */}
        <div style={{
          position: 'absolute', top: 64, left: 0, right: 0,
          display: 'flex', justifyContent: 'center', gap: 8, zIndex: 1000, padding: '0 16px',
        }}>
          {['all', 'male', 'female'].map((g) => (
            <FilterPill
              key={g}
              label={g === 'all' ? 'All' : g.charAt(0).toUpperCase() + g.slice(1)}
              active={genderFilter === g}
              onClick={() => setGenderFilter(g)}
            />
          ))}
        </div>

        {/* Visibility pill */}
        <div className="visibility-pill-wrap">
          <button className={`visibility-pill${visible ? ' visible' : ''}`} onClick={toggleVisibility}>
            <i className={`ti ${visible ? 'ti-radio' : 'ti-ghost'}`} />
            {visible ? `Visible · ${timeLeft}` : 'Ghost Mode'}
          </button>
        </div>

        {/* Notes FAB cluster */}
        <div className="notes-fab-wrap">
          <button className="notes-list-btn" onClick={() => setShowNotesList(true)} title="Notes nearby">
            <i className="ti ti-note" />
            {nearbyNotes.length > 0 && (
              <span style={{ position: 'absolute', transform: 'translate(14px, -14px)', minWidth: 16, height: 16, borderRadius: 8, background: '#F59E0B', color: '#1A1200', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
                {nearbyNotes.length}
              </span>
            )}
          </button>
          <button className="notes-post-fab" onClick={handleOpenPostNote} title="Post a Note">
            <i className="ti ti-plus" />
          </button>
        </div>
      </div>

      {/* First-time visibility prompt */}
      {showVisibilityPrompt && (
        <VisibilityPrompt
          onGoVisible={() => {
            setShowVisibilityPrompt(false);
            localStorage.setItem('cuelyn_visibility_prompted', 'true');
            toggleVisibility();
          }}
          onDismiss={() => {
            setShowVisibilityPrompt(false);
            localStorage.setItem('cuelyn_visibility_prompted', 'true');
          }}
        />
      )}

      {/* Send Signal bottom sheet */}
      {selectedUser && (
        <BottomSheet onClose={() => setSelectedUser(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Target user info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ position: 'relative', width: 60, height: 60, flexShrink: 0 }}>
                {sendingSignal && (
                  <span style={{
                    position: 'absolute', inset: -3, borderRadius: '50%',
                    border: `1.5px solid ${genderBorderColor(selectedUser.gender)}`,
                    animation: 'pulse-ring 1.1s ease-out infinite',
                  }} />
                )}
                <div style={{
                  width: 60, height: 60, borderRadius: '50%',
                  border: `3px solid ${genderBorderColor(selectedUser.gender)}`,
                  overflow: 'hidden', background: genderBorderColor(selectedUser.gender),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {selectedUser.photoURL
                    ? <img src={selectedUser.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                    : <span style={{ color: '#fff', fontWeight: 700, fontSize: 22 }}>{(selectedUser.firstName || '?')[0].toUpperCase()}</span>
                  }
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 17 }}>{selectedUser.firstName}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <GenderBadge gender={selectedUser.gender} />
                  {selectedUser.vibeTag && <VibeTagChip label={selectedUser.vibeTag} />}
                </div>
                {distanceToSelected !== null && (
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                    {fuzzyDistance(distanceToSelected)} away
                  </div>
                )}
              </div>
              <button
                onClick={() => { setSelectedUser(null); navigate(`/profile/${selectedUser.id}`); }}
                style={{ background: 'none', border: '1.5px solid var(--color-border)', borderRadius: 10, cursor: 'pointer', color: 'var(--color-text-primary)', padding: '6px 12px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}
              >
                View Profile
              </button>
              <UserActionMenu
                myUid={user?.uid}
                targetUid={selectedUser.id}
                targetName={selectedUser.firstName}
                onBlock={() => setSelectedUser(null)}
              />
            </div>

            {/* Mode selection */}
            <div style={{ display: 'flex', gap: 10 }}>
              <SignalModeCard
                title="As Yourself"
                icon={
                  profile?.photoURL
                    ? <img src={profile.photoURL} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} alt="" />
                    : <i className="ti ti-user" style={{ fontSize: 28, color: 'var(--color-primary)' }} />
                }
                subtitle={profile?.displayName}
                description="They'll see who you are"
                selected={!anonymous}
                onClick={() => setAnonymous(false)}
              />
              <SignalModeCard
                title="As Ghost"
                icon={<i className="ti ti-ghost" style={{ fontSize: 28, color: 'var(--color-text-secondary)' }} />}
                subtitle="Anonymous"
                description="They won't know it's you"
                selected={anonymous}
                onClick={() => setAnonymous(true)}
              />
            </div>

            {/* Optional quote */}
            <div className="input-group">
              <label className="input-label" style={{ fontSize: 12 }}>
                How do you feel? <span style={{ color: 'var(--color-text-secondary)' }}>(optional · only you see this)</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input-field"
                  type="text"
                  placeholder="Something about this moment…"
                  value={senderQuote}
                  onChange={(e) => setSenderQuote(e.target.value.slice(0, 50))}
                  maxLength={50}
                  style={{ paddingRight: 40 }}
                />
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--color-text-secondary)' }}>
                  {senderQuote.length}/50
                </span>
              </div>
            </div>

            <button className="btn btn-primary btn-full" onClick={handleSignal} disabled={sendingSignal}>
              {sendingSignal ? <span className="spinner" style={{ width: 18, height: 18 }} /> : <><i className="ti ti-send" /> Send Signal</>}
            </button>
          </div>
        </BottomSheet>
      )}

      {/* Post a Note */}
      {showPostNote && (
        <NotePostSheet onClose={() => setShowPostNote(false)} onPost={handlePostNote} />
      )}

      {/* Notes list */}
      {showNotesList && (
        <NotesListSheet
          notes={nearbyNotes}
          myUid={user?.uid}
          userCoords={userCoordsRef.current}
          onClose={() => setShowNotesList(false)}
          onReply={handleReplyToNote}
          onDelete={handleDeleteNote}
          onReport={handleReportNote}
        />
      )}

      {/* Reply to a Note — same anonymous-or-not signal flow as messaging a person marker */}
      {selectedNote && (
        <BottomSheet onClose={() => setSelectedNote(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Reply to this Note</div>
              <div style={{
                padding: '12px 14px', borderRadius: 14,
                background: 'rgba(245,158,11,0.08)', border: '1.5px solid rgba(245,158,11,0.35)',
                fontSize: 15, color: 'var(--color-text-primary)', lineHeight: 1.5,
              }}>
                {selectedNote.text}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <SignalModeCard
                title="As Yourself"
                icon={
                  profile?.photoURL
                    ? <img src={profile.photoURL} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} alt="" />
                    : <i className="ti ti-user" style={{ fontSize: 28, color: 'var(--color-primary)' }} />
                }
                subtitle={profile?.displayName}
                description="They'll see who you are"
                selected={!noteAnonymous}
                onClick={() => setNoteAnonymous(false)}
              />
              <SignalModeCard
                title="As Ghost"
                icon={<i className="ti ti-ghost" style={{ fontSize: 28, color: 'var(--color-text-secondary)' }} />}
                subtitle="Anonymous"
                description="They won't know it's you"
                selected={noteAnonymous}
                onClick={() => setNoteAnonymous(true)}
              />
            </div>

            <button className="btn btn-primary btn-full" onClick={handleSendNoteSignal} disabled={sendingNoteSignal}>
              {sendingNoteSignal ? <span className="spinner" style={{ width: 18, height: 18 }} /> : <><i className="ti ti-send" /> Send Signal</>}
            </button>
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
