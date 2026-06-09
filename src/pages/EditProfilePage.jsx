import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomSheet from '../components/BottomSheet';
import VibeTagChip from '../components/VibeTagChip';
import { useToast } from '../components/Toast';
import { updateUserProfile, checkUsernameAvailable, setUsername } from '../firebase/firestore';

const VIBE_TAGS = [
  'Café person', 'Quiet type', 'Music head', 'Gamer',
  'Nature lover', 'Creative', 'Gym rat', 'Foodie',
  'Movie buff', 'Animal lover', 'Tech nerd', 'Chill vibes',
];

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

// ─── Rows ────────────────────────────────────────────────────────
function EditRow({ label, value, onEdit, icon = 'ti-pencil' }) {
  return (
    <div
      onClick={onEdit}
      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '15px 20px', borderBottom: '1px solid var(--color-border)', cursor: 'pointer', background: 'var(--color-bg)' }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 15, color: value ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', fontStyle: value ? 'normal' : 'italic' }}>
          {value || `Add ${label.toLowerCase()}`}
        </div>
      </div>
      <i className={`ti ${icon}`} style={{ fontSize: 18, color: 'var(--color-text-secondary)', flexShrink: 0 }} />
    </div>
  );
}

// ─── Username sheet ──────────────────────────────────────────────
function UsernameSheet({ uid, currentUsername, onDone, onClose }) {
  const showToast = useToast();
  const [input, setInput] = useState(currentUsername || '');
  const [status, setStatus] = useState(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef(null);

  const handleChange = (val) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setInput(clean);
    setStatus(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!USERNAME_REGEX.test(clean)) { setStatus('invalid'); return; }
    if (clean === currentUsername) { setStatus('available'); return; }
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
      await setUsername(uid, currentUsername, input);
      onDone(input);
    } catch {
      showToast('Failed to set username', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <h3>Username</h3>
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
          {saving ? <span className="spinner" style={{ width: 18, height: 18 }} /> : 'Save Username'}
        </button>
      </div>
    </BottomSheet>
  );
}

// ─── Main ────────────────────────────────────────────────────────
export default function EditProfilePage({ user, profile, refreshProfile }) {
  const navigate = useNavigate();
  const showToast = useToast();

  const [editField, setEditField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [showUsernameSheet, setShowUsernameSheet] = useState(false);
  const [showVibeSheet, setShowVibeSheet] = useState(false);
  const [tempTags, setTempTags] = useState([]);

  const openEdit = (field, current) => {
    setEditField(field);
    setEditValue(current || '');
  };

  const saveEdit = async () => {
    if (!editField) return;
    const trimmed = editValue.trim();
    if (editField === 'bio' && trimmed.length > 150) { showToast('Bio max 150 chars', 'error'); return; }
    setSaving(true);
    try {
      await updateUserProfile(user.uid, { [editField]: trimmed || null });
      await refreshProfile();
      setEditField(null);
      showToast('Saved', 'success');
    } catch {
      showToast('Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveVibeTags = async () => {
    if (tempTags.length < 3) { showToast('Pick at least 3 tags', 'error'); return; }
    setSaving(true);
    try {
      await updateUserProfile(user.uid, { vibeTags: tempTags });
      await refreshProfile();
      setShowVibeSheet(false);
      showToast('Vibe tags updated', 'success');
    } catch {
      showToast('Failed to update tags', 'error');
    } finally {
      setSaving(false);
    }
  };

  const fieldLabel = {
    displayName: 'Display Name',
    nickname: 'Nickname',
    bio: 'Bio',
    age: 'Age',
    gender: 'Gender',
  };

  return (
    <div className="page" style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 22, padding: 0 }}>
            <i className="ti ti-arrow-left" />
          </button>
          <h2>Edit Profile</h2>
        </div>
      </div>

      {/* Section label */}
      <div style={{ padding: '16px 20px 4px', fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Identity
      </div>
      <div style={{ borderTop: '1px solid var(--color-border)' }}>
        <EditRow
          label="Display Name"
          value={profile?.displayName}
          onEdit={() => openEdit('displayName', profile?.displayName)}
        />
        <EditRow
          label="Username"
          value={profile?.username ? `@${profile.username}` : null}
          onEdit={() => setShowUsernameSheet(true)}
        />
        <EditRow
          label="Nickname (shown on map)"
          value={profile?.nickname}
          onEdit={() => openEdit('nickname', profile?.nickname)}
        />
      </div>

      <div style={{ padding: '16px 20px 4px', fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        About You
      </div>
      <div style={{ borderTop: '1px solid var(--color-border)' }}>
        <EditRow
          label="Bio"
          value={profile?.bio}
          onEdit={() => openEdit('bio', profile?.bio)}
          icon="ti-text-size"
        />
        <EditRow
          label="Age"
          value={profile?.age ? `${profile.age} yrs` : null}
          onEdit={() => openEdit('age', String(profile?.age || ''))}
        />
        <EditRow
          label="Gender"
          value={profile?.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1) : null}
          onEdit={() => openEdit('gender', profile?.gender)}
        />
      </div>

      <div style={{ padding: '16px 20px 4px', fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Vibe Tags
      </div>
      <div style={{ borderTop: '1px solid var(--color-border)' }}>
        <div
          onClick={() => { setTempTags(profile?.vibeTags || []); setShowVibeSheet(true); }}
          style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '15px 20px', borderBottom: '1px solid var(--color-border)', cursor: 'pointer' }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Tags</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(profile?.vibeTags || []).length > 0
                ? (profile.vibeTags || []).map((t) => <span key={t} className="chip" style={{ fontSize: 12, padding: '4px 10px' }}>{t}</span>)
                : <span style={{ fontSize: 15, color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>Add vibe tags</span>
              }
            </div>
          </div>
          <i className="ti ti-pencil" style={{ fontSize: 18, color: 'var(--color-text-secondary)', flexShrink: 0 }} />
        </div>
      </div>

      {/* Inline field editor */}
      {editField && (
        <BottomSheet onClose={() => setEditField(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3>Edit {fieldLabel[editField] || editField}</h3>

            {editField === 'gender' ? (
              <div className="gender-pills">
                {['male', 'female', 'other'].map((g) => (
                  <button key={g} type="button" className={`gender-pill${editValue === g ? ` selected-${g}` : ''}`} onClick={() => setEditValue(g)}>
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </button>
                ))}
              </div>
            ) : editField === 'bio' ? (
              <div className="input-group">
                <textarea
                  className="input-field"
                  style={{ minHeight: 100, resize: 'vertical' }}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  maxLength={150}
                  autoFocus
                />
                <span className="caption" style={{ textAlign: 'right' }}>{editValue.length}/150</span>
              </div>
            ) : (
              <input
                className="input-field"
                type={editField === 'age' ? 'number' : 'text'}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                maxLength={editField === 'displayName' ? 24 : editField === 'nickname' ? 24 : undefined}
                min={editField === 'age' ? 18 : undefined}
                max={editField === 'age' ? 100 : undefined}
                autoFocus
              />
            )}

            <button className="btn btn-primary btn-full" onClick={saveEdit} disabled={saving}>
              {saving ? <span className="spinner" style={{ width: 18, height: 18 }} /> : 'Save'}
            </button>
          </div>
        </BottomSheet>
      )}

      {/* Username sheet */}
      {showUsernameSheet && (
        <UsernameSheet
          uid={user.uid}
          currentUsername={profile?.username}
          onClose={() => setShowUsernameSheet(false)}
          onDone={async (uname) => {
            setShowUsernameSheet(false);
            await refreshProfile();
            showToast(`@${uname} saved!`, 'success');
          }}
        />
      )}

      {/* Vibe tags sheet */}
      {showVibeSheet && (
        <BottomSheet onClose={() => setShowVibeSheet(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <h3>Vibe Tags</h3>
              <p className="caption" style={{ marginTop: 4 }}>Pick 3–5 tags ({tempTags.length}/5 selected)</p>
            </div>
            <div className="vibe-grid">
              {VIBE_TAGS.map((tag) => (
                <VibeTagChip
                  key={tag} label={tag}
                  selected={tempTags.includes(tag)} selectable
                  onClick={() => setTempTags((p) => p.includes(tag) ? p.filter((t) => t !== tag) : p.length < 5 ? [...p, tag] : p)}
                />
              ))}
            </div>
            <button className="btn btn-primary btn-full" onClick={saveVibeTags} disabled={tempTags.length < 3 || saving}>
              {saving ? <span className="spinner" style={{ width: 18, height: 18 }} /> : 'Save Tags'}
            </button>
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
