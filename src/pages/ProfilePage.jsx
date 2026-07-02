import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import ThemeToggle from '../components/ThemeToggle';
import BottomSheet from '../components/BottomSheet';
import EmptyState from '../components/EmptyState';
import { useToast } from '../components/Toast';
import {
  updateUserProfile, setUsername, checkUsernameAvailable,
  getReceivedSignals, getSentSignals,
} from '../firebase/firestore';
import { uploadFile } from '../firebase/storage';
import { getAnonymousLabel } from '../utils/anonymousLabels';

const GENDER_COLORS = { male: 'var(--color-male)', female: 'var(--color-female)', other: 'var(--color-other)' };

function Avatar({ photoURL, displayName, gender, size }) {
  const bg = GENDER_COLORS[gender] || 'var(--color-primary)';
  if (photoURL) {
    return <img src={photoURL} alt="" loading="lazy" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${bg}` }} />;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: size * 0.38, border: `3px solid ${bg}`, flexShrink: 0 }}>
      {(displayName || '?')[0].toUpperCase()}
    </div>
  );
}

function UsernameRequiredSheet({ uid, onDone }) {
  const showToast = useToast();
  const [input, setInput] = useState('');
  const [status, setStatus] = useState(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef(null);
  const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

  const handleChange = (val) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setInput(clean);
    setStatus(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!USERNAME_REGEX.test(clean)) { setStatus('invalid'); return; }
    setChecking(true);
    debounceRef.current = setTimeout(async () => {
      const available = await checkUsernameAvailable(clean);
      setStatus(available ? 'available' : 'taken');
      setChecking(false);
    }, 500);
  };

  const handleSave = async () => {
    if (status !== 'available') return;
    setSaving(true);
    try {
      await setUsername(uid, null, input);
      onDone(input);
    } catch {
      showToast('Failed to set username', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet onClose={null}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <h3>Choose your username</h3>
          <p className="caption" style={{ marginTop: 4 }}>3–20 characters, letters, numbers and underscores only</p>
        </div>
        <div className="input-group">
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)', fontSize: 15 }}>@</span>
            <input
              className="input-field"
              style={{ paddingLeft: 28, borderColor: status === 'available' ? 'var(--color-success)' : status === 'taken' || status === 'invalid' ? 'var(--color-danger)' : undefined }}
              placeholder="yourname"
              value={input}
              onChange={(e) => handleChange(e.target.value)}
              maxLength={20}
              autoFocus
            />
            <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)' }}>
              {checking && <span className="spinner" style={{ width: 16, height: 16 }} />}
              {!checking && status === 'available' && <i className="ti ti-circle-check" style={{ color: 'var(--color-success)', fontSize: 18 }} />}
              {!checking && (status === 'taken' || status === 'invalid') && <i className="ti ti-circle-x" style={{ color: 'var(--color-danger)', fontSize: 18 }} />}
            </span>
          </div>
          {status === 'taken' && <span style={{ fontSize: 12, color: 'var(--color-danger)' }}>Username is already taken</span>}
          {status === 'invalid' && input.length > 0 && <span style={{ fontSize: 12, color: 'var(--color-danger)' }}>3–20 chars, letters/numbers/underscore only</span>}
          {status === 'available' && <span style={{ fontSize: 12, color: 'var(--color-success)' }}>Available!</span>}
        </div>
        <button className="btn btn-primary btn-full" onClick={handleSave} disabled={status !== 'available' || saving}>
          {saving ? <span className="spinner" style={{ width: 18, height: 18 }} /> : 'Set Username'}
        </button>
      </div>
    </BottomSheet>
  );
}

/* ── Signal History section ───────────────────────────────────── */
const SIGNAL_COLORS = { male: '#3B82F6', female: '#A855F7', other: '#F59E0B' };

function SignalAvatar({ photoURL, name, gender, isAnon }) {
  if (isAnon) {
    return (
      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--color-surface-2)', border: '2px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <i className="ti ti-ghost" style={{ fontSize: 18, color: 'var(--color-text-secondary)' }} />
      </div>
    );
  }
  const bg = SIGNAL_COLORS[gender] || 'var(--color-primary)';
  if (photoURL) {
    return <img src={photoURL} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: `2px solid ${bg}` }} />;
  }
  return (
    <div style={{ width: 44, height: 44, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 17, flexShrink: 0 }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}

function SignalHistoryEntry({ signal, isReceived, allReceivedSignals }) {
  const isAnon = signal.anonymous && isReceived;
  const anonLabel = isAnon ? getAnonymousLabel(signal.fromUid, allReceivedSignals) : null;

  const name = isAnon
    ? anonLabel
    : isReceived
      ? signal.fromDisplayName || 'Someone'
      : signal.toDisplayName || 'Someone';

  const photoURL = isReceived && !isAnon ? signal.fromPhotoURL : null;
  const gender = isReceived && !isAnon ? signal.fromGender : null;

  const date = signal.createdAt ? format(new Date(signal.createdAt), 'MMM d · h:mm a') : '';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 0',
      borderBottom: '1px solid var(--color-border)',
    }}>
      <SignalAvatar photoURL={photoURL} name={name} gender={gender} isAnon={isAnon} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-primary)' }}>{name}</div>
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
          {isReceived ? 'Signaled you' : 'You signaled'}
          {date ? ` · ${date}` : ''}
        </div>
        {signal.locationLabel && (
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            <i className="ti ti-map-pin" style={{ fontSize: 10, marginRight: 3 }} />
            {signal.locationLabel}
          </div>
        )}
      </div>
      <span style={{
        fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20,
        background: isReceived ? 'var(--color-surface-2)' : 'var(--color-surface-2)',
        color: isReceived ? 'var(--color-accent)' : 'var(--color-primary)',
        flexShrink: 0,
      }}>
        {isReceived ? 'Received' : 'Sent'}
      </span>
    </div>
  );
}

function SignalHistorySection({ uid }) {
  const [received, setReceived] = useState([]);
  const [sent, setSent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');

  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    Promise.all([getReceivedSignals(uid), getSentSignals(uid)])
      .then(([r, s]) => { setReceived(r); setSent(s); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [uid]);

  const allMerged = [...received.map((s) => ({ ...s, _type: 'received' })), ...sent.map((s) => ({ ...s, _type: 'sent' }))]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 50);

  const displayList = tab === 'all'
    ? allMerged
    : tab === 'received'
      ? allMerged.filter((s) => s._type === 'received')
      : allMerged.filter((s) => s._type === 'sent');

  return (
    <div style={{ padding: '0 20px', paddingBottom: 24 }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Signal History
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['all', 'received', 'sent'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                background: tab === t ? 'var(--color-primary)' : 'var(--color-surface)',
                color: tab === t ? '#fff' : 'var(--color-text-secondary)',
                border: `1px solid ${tab === t ? 'transparent' : 'var(--color-border)'}`,
              }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
          <span className="spinner" style={{ width: 22, height: 22 }} />
        </div>
      )}

      {!loading && displayList.length === 0 && (
        <EmptyState
          icon="ti-clock-history"
          title="No signals yet"
          subtitle="Your signal history will appear here"
        />
      )}

      {!loading && displayList.map((signal) => (
        <SignalHistoryEntry
          key={`${signal._type}-${signal.id}`}
          signal={signal}
          isReceived={signal._type === 'received'}
          allReceivedSignals={received}
        />
      ))}
    </div>
  );
}

/* ── Main ProfilePage ─────────────────────────────────────────── */
export default function ProfilePage({ user, profile, refreshProfile }) {
  const navigate = useNavigate();
  const showToast = useToast();
  const coverInputRef = useRef(null);
  const avatarInputRef = useRef(null);

  const [showUsernameSheet, setShowUsernameSheet] = useState(false);
  const [uploading, setUploading] = useState(null);

  const bgColor = GENDER_COLORS[profile?.gender] || 'var(--color-primary)';

  useEffect(() => {
    if (!profile) return;
    if (!profile.username) setShowUsernameSheet(true);
  }, [profile?.username]);

  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading('cover');
    try {
      const url = await uploadFile(`covers/${user.uid}`, file);
      await updateUserProfile(user.uid, { coverURL: url });
      await refreshProfile();
    } catch { showToast('Failed to upload cover photo', 'error'); }
    finally { setUploading(null); }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading('avatar');
    try {
      const url = await uploadFile(`avatars/${user.uid}`, file);
      await updateUserProfile(user.uid, { photoURL: url });
      await refreshProfile();
    } catch { showToast('Failed to upload photo', 'error'); }
    finally { setUploading(null); }
  };

  return (
    <div className="page" style={{ paddingBottom: 80 }}>
      {/* Top bar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '12px 16px', background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)', gap: 12 }}>
        <button onClick={() => navigate('/settings')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 22, padding: 4 }}>
          <i className="ti ti-settings" />
        </button>
        <ThemeToggle />
      </div>

      {/* Cover + Avatar */}
      <div style={{ position: 'relative', marginBottom: 52 }}>
        <div style={{ height: 130, background: 'linear-gradient(135deg, #0050CC, #00A3FF)', position: 'relative', overflow: 'hidden' }}>
          {profile?.coverURL && <img src={profile.coverURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
          {uploading === 'cover' && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="spinner" style={{ width: 28, height: 28 }} />
            </div>
          )}
          <button onClick={() => coverInputRef.current?.click()} style={{ position: 'absolute', bottom: 10, right: 12, width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,0,0,0.4)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <i className="ti ti-camera" style={{ fontSize: 16 }} />
          </button>
          <input ref={coverInputRef} type="file" accept="image/*" hidden onChange={handleCoverUpload} />
        </div>

        {/* Avatar overlapping cover */}
        <div style={{ position: 'absolute', bottom: -44, left: 20 }}>
          <div style={{ position: 'relative', width: 88, height: 88 }}>
            <Avatar photoURL={profile?.photoURL} displayName={profile?.displayName} gender={profile?.gender} size={88} />
            {uploading === 'avatar' && (
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="spinner" style={{ width: 22, height: 22 }} />
              </div>
            )}
            <button onClick={() => avatarInputRef.current?.click()} style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: '50%', background: bgColor, border: '2px solid var(--color-bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <i className="ti ti-camera" style={{ fontSize: 13 }} />
            </button>
            <input ref={avatarInputRef} type="file" accept="image/*" hidden onChange={handleAvatarUpload} />
          </div>
        </div>

        {/* Edit Profile button */}
        <div style={{ position: 'absolute', bottom: -38, right: 20 }}>
          <button
            onClick={() => navigate('/edit-profile')}
            className="btn btn-secondary btn-sm"
            style={{ padding: '7px 18px', fontSize: 14 }}
          >
            <i className="ti ti-pencil" style={{ fontSize: 14 }} /> Edit Profile
          </button>
        </div>
      </div>

      {/* Name + username + bio + vibe tags */}
      <div style={{ padding: '0 20px 20px', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ fontWeight: 700, fontSize: 20, color: 'var(--color-text-primary)' }}>
          {profile?.displayName || 'You'}
        </div>
        {profile?.username && (
          <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            @{profile.username}
          </div>
        )}
        {profile?.bio && (
          <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginTop: 8, lineHeight: 1.5 }}>
            {profile.bio}
          </div>
        )}
        {(profile?.vibeTags || []).length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {profile.vibeTags.map((t) => (
              <span key={t} className="chip" style={{ fontSize: 12, padding: '3px 10px' }}>{t}</span>
            ))}
          </div>
        )}
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', padding: '12px 20px', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 22, color: 'var(--color-text-primary)' }}>{profile?.friendsCount || 0}</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Friends</div>
        </div>
        <div style={{ width: 1, background: 'var(--color-border)', margin: '4px 0' }} />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 22, color: 'var(--color-text-primary)' }}>{profile?.signalsReceivedTotal || 0}</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Signals received</div>
        </div>
      </div>

      {/* Signal History */}
      <div style={{ marginTop: 20 }}>
        <SignalHistorySection uid={user?.uid} />
      </div>

      {/* Username required blocker */}
      {showUsernameSheet && (
        <UsernameRequiredSheet
          uid={user.uid}
          onDone={async (uname) => {
            setShowUsernameSheet(false);
            await refreshProfile();
            showToast(`@${uname} is yours!`, 'success');
          }}
        />
      )}
    </div>
  );
}
