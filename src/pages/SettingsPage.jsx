import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomSheet from '../components/BottomSheet';
import { useToast } from '../components/Toast';
import { useTheme } from '../hooks/useTheme';
import { updateUserProfile } from '../firebase/firestore';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/firestore';
import { logoutUser, changePassword, deleteAccount } from '../firebase/auth';
import { deleteFriendList, deleteLocation } from '../firebase/firestore';

// ─── Password strength ──────────────────────────────────────────
function checkStrength(pw) {
  return {
    length:    pw.length >= 8,
    uppercase: /[A-Z]/.test(pw),
    number:    /[0-9]/.test(pw),
    special:   /[!@#$%^&*]/.test(pw),
  };
}
const STRENGTH_COLORS = ['', '#FF5A6A', '#FF8C42', '#F5C518', '#00CC88'];
const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];

function PasswordStrengthBar({ password }) {
  const criteria = checkStrength(password);
  const score = Object.values(criteria).filter(Boolean).length;
  if (!password) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        {[1, 2, 3, 4].map((n) => (
          <div key={n} style={{ flex: 1, height: 4, borderRadius: 9999, background: n <= score ? STRENGTH_COLORS[score] : 'var(--color-border)', transition: 'background 0.3s' }} />
        ))}
      </div>
      <span style={{ fontSize: 12, color: STRENGTH_COLORS[score] || 'var(--color-text-secondary)', fontWeight: 500 }}>
        {STRENGTH_LABELS[score]}
      </span>
    </div>
  );
}

// ─── Section header ─────────────────────────────────────────────
function SectionHeader({ title }) {
  return (
    <div style={{ padding: '20px 20px 8px', fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
      {title}
    </div>
  );
}

// ─── Settings row ────────────────────────────────────────────────
function SettingsRow({ icon, label, subtitle, right, onClick, danger }) {
  return (
    <div
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '1px solid var(--color-border)', cursor: onClick ? 'pointer' : 'default', background: 'var(--color-bg)' }}
    >
      {icon && (
        <i className={`ti ${icon}`} style={{ fontSize: 20, color: danger ? 'var(--color-danger)' : 'var(--color-text-secondary)', flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: danger ? 'var(--color-danger)' : 'var(--color-text-primary)' }}>{label}</div>
        {subtitle && <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2 }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

// ─── Change password sheet ───────────────────────────────────────
function ChangePasswordSheet({ onClose }) {
  const showToast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const strength = checkStrength(next);
  const score = Object.values(strength).filter(Boolean).length;
  const mismatch = confirm && next !== confirm;
  const valid = current && score >= 3 && next === confirm;

  const handleSubmit = async () => {
    if (!valid) return;
    setLoading(true);
    try {
      await changePassword(current, next);
      onClose();
      showToast('Password updated', 'success');
    } catch (err) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        showToast('Current password is incorrect', 'error');
      } else {
        showToast('Failed to update password', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h3>Change Password</h3>
        <div className="input-group">
          <label className="input-label">Current Password</label>
          <input className="input-field" type="password" placeholder="••••••••" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div className="input-group">
          <label className="input-label">New Password</label>
          <input className="input-field" type="password" placeholder="••••••••" value={next} onChange={(e) => setNext(e.target.value)} />
          <PasswordStrengthBar password={next} />
        </div>
        <div className="input-group">
          <label className="input-label">Confirm New Password</label>
          <input className="input-field" type="password" placeholder="••••••••" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={{ borderColor: mismatch ? 'var(--color-danger)' : undefined }} />
          {mismatch && <span style={{ fontSize: 12, color: 'var(--color-danger)' }}>Passwords don&apos;t match</span>}
        </div>
        <button className="btn btn-primary btn-full" onClick={handleSubmit} disabled={!valid || loading}>
          {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : 'Update Password'}
        </button>
      </div>
    </BottomSheet>
  );
}

// ─── Change display name sheet ──────────────────────────────────
function ChangeNameSheet({ currentName, onClose, uid, refreshProfile }) {
  const showToast = useToast();
  const [value, setValue] = useState(currentName || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await updateUserProfile(uid, { displayName: trimmed });
      await refreshProfile();
      onClose();
      showToast('Display name updated', 'success');
    } catch {
      showToast('Failed to update name', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h3>Change Display Name</h3>
        <div className="input-group">
          <input className="input-field" type="text" placeholder="Your name" value={value} onChange={(e) => setValue(e.target.value)} maxLength={24} autoFocus />
        </div>
        <button className="btn btn-primary btn-full" onClick={handleSave} disabled={!value.trim() || saving}>
          {saving ? <span className="spinner" style={{ width: 18, height: 18 }} /> : 'Save'}
        </button>
      </div>
    </BottomSheet>
  );
}

// ─── Delete account sheet ────────────────────────────────────────
function DeleteAccountSheet({ user, onClose }) {
  const navigate = useNavigate();
  const showToast = useToast();
  const [step, setStep] = useState(1);
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') return;
    setLoading(true);
    try {
      await Promise.allSettled([
        deleteDoc(doc(db, 'users', user.uid)),
        deleteDoc(doc(db, 'locations', user.uid)),
        deleteFriendList(user.uid),
      ]);
      await deleteAccount();
      navigate('/splash', { replace: true });
    } catch (err) {
      if (err.code === 'auth/requires-recent-login') {
        showToast('Please sign out and sign back in, then try again', 'error');
      } else {
        showToast('Failed to delete account. Please try again.', 'error');
      }
      setLoading(false);
    }
  };

  return (
    <BottomSheet onClose={!loading ? onClose : null}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {step === 1 ? (
          <>
            <div style={{ textAlign: 'center' }}>
              <i className="ti ti-trash" style={{ fontSize: 40, color: 'var(--color-danger)', marginBottom: 12, display: 'block' }} />
              <h3 style={{ color: 'var(--color-danger)' }}>Are you sure?</h3>
              <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginTop: 10, lineHeight: 1.6 }}>
                This will permanently delete your account, all your posts, signals, and matches.
                This cannot be undone.
              </p>
            </div>
            <button className="btn btn-full" onClick={() => setStep(2)} style={{ background: 'var(--color-danger)', color: '#fff', border: 'none', borderRadius: 12, padding: '14px', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
              Delete My Account
            </button>
            <button className="btn btn-secondary btn-full" onClick={onClose}>Keep My Account</button>
          </>
        ) : (
          <>
            <div>
              <h3 style={{ color: 'var(--color-danger)' }}>Final confirmation</h3>
              <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginTop: 8 }}>Type <strong>DELETE</strong> to confirm</p>
            </div>
            <div className="input-group">
              <input
                className="input-field"
                type="text"
                placeholder="Type DELETE to confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoFocus
              />
            </div>
            <button
              className="btn btn-full"
              onClick={handleDelete}
              disabled={confirmText !== 'DELETE' || loading}
              style={{ background: confirmText === 'DELETE' ? 'var(--color-danger)' : 'var(--color-surface-2)', color: confirmText === 'DELETE' ? '#fff' : 'var(--color-text-secondary)', border: 'none', borderRadius: 12, padding: '14px', fontWeight: 700, fontSize: 15, cursor: confirmText === 'DELETE' ? 'pointer' : 'not-allowed' }}
            >
              {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : 'Confirm Delete'}
            </button>
            <button className="btn btn-secondary btn-full" onClick={onClose} disabled={loading}>Cancel</button>
          </>
        )}
      </div>
    </BottomSheet>
  );
}

// ─── Main ────────────────────────────────────────────────────────
export default function SettingsPage({ user, profile, refreshProfile }) {
  const navigate = useNavigate();
  const showToast = useToast();
  const { theme, toggleTheme } = useTheme();

  const [showPasswordSheet, setShowPasswordSheet] = useState(false);
  const [showNameSheet, setShowNameSheet] = useState(false);
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const notifPrefs = profile?.notificationPrefs || {};

  const togglePref = async (key) => {
    try {
      await updateUserProfile(user.uid, {
        notificationPrefs: { ...notifPrefs, [key]: !(notifPrefs[key] !== false) },
      });
      await refreshProfile();
    } catch { showToast('Failed to save preference', 'error'); }
  };

  const togglePrivacy = async (field) => {
    try {
      await updateUserProfile(user.uid, { [field]: !profile?.[field] });
      await refreshProfile();
    } catch { showToast('Failed to save', 'error'); }
  };

  const handleSignOut = async () => {
    setLoggingOut(true);
    setShowSignOutConfirm(false);
    try { await logoutUser(); } catch { setLoggingOut(false); }
  };

  const Toggle = ({ value, onChange }) => (
    <label className="toggle-switch" style={{ flexShrink: 0 }}>
      <input type="checkbox" checked={!!value} onChange={onChange} />
      <span className="toggle-switch__slider" />
    </label>
  );

  return (
    <div className="page" style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 22, padding: 0 }}>
            <i className="ti ti-arrow-left" />
          </button>
          <h2>Settings</h2>
        </div>
      </div>

      {/* ── Account ── */}
      <SectionHeader title="Account" />
      <div style={{ borderTop: '1px solid var(--color-border)' }}>
        <SettingsRow
          icon="ti-mail"
          label="Email"
          subtitle={user?.email || ''}
        />
        <SettingsRow
          icon="ti-lock"
          label="Change Password"
          onClick={() => setShowPasswordSheet(true)}
          right={<i className="ti ti-chevron-right" style={{ color: 'var(--color-text-secondary)', fontSize: 16 }} />}
        />
        <SettingsRow
          icon="ti-pencil"
          label="Change Display Name"
          subtitle={profile?.displayName || ''}
          onClick={() => setShowNameSheet(true)}
          right={<i className="ti ti-chevron-right" style={{ color: 'var(--color-text-secondary)', fontSize: 16 }} />}
        />
      </div>

      {/* ── Privacy ── */}
      <SectionHeader title="Privacy" />
      <div style={{ borderTop: '1px solid var(--color-border)' }}>
        <SettingsRow
          icon="ti-lock"
          label="Private Account"
          subtitle="Only friends can see your quicks"
          right={<Toggle value={profile?.isPrivate} onChange={() => togglePrivacy('isPrivate')} />}
        />
        <SettingsRow
          icon="ti-trophy"
          label="Show on Leaderboard"
          subtitle="Appear in nearby Signal leaderboard"
          right={<Toggle value={profile?.leaderboardEnabled} onChange={() => togglePrivacy('leaderboardEnabled')} />}
        />
        <SettingsRow
          icon="ti-ban"
          label="Blocked Users"
          onClick={() => navigate('/settings/blocked')}
          right={<i className="ti ti-chevron-right" style={{ color: 'var(--color-text-secondary)', fontSize: 16 }} />}
        />
      </div>

      {/* ── Notifications ── */}
      <SectionHeader title="Notifications" />
      <div style={{ borderTop: '1px solid var(--color-border)' }}>
        {[
          { key: 'signalReceived',  label: 'Signal received' },
          { key: 'signalAccepted',  label: 'Signal accepted' },
          { key: 'friendRequests',  label: 'Friend requests' },
          { key: 'chatTimerWarning', label: 'Chat timer warning' },
          { key: 'friendMessages',  label: 'Friend messages' },
        ].map(({ key, label }) => (
          <SettingsRow
            key={key}
            label={label}
            right={<Toggle value={notifPrefs[key] !== false} onChange={() => togglePref(key)} />}
          />
        ))}
      </div>

      {/* ── Appearance ── */}
      <SectionHeader title="Appearance" />
      <div style={{ borderTop: '1px solid var(--color-border)' }}>
        <SettingsRow
          icon="ti-moon"
          label="Dark Mode"
          right={<Toggle value={theme === 'dark'} onChange={toggleTheme} />}
        />
      </div>

      {/* ── Danger Zone ── */}
      <SectionHeader title="Danger Zone" />
      <div style={{ borderTop: '1px solid var(--color-border)' }}>
        <SettingsRow
          icon="ti-logout"
          label="Sign Out"
          danger
          onClick={() => setShowSignOutConfirm(true)}
        />
        <SettingsRow
          icon="ti-trash"
          label="Delete Account"
          danger
          onClick={() => setShowDeleteSheet(true)}
        />
      </div>

      {/* ── Sheets ── */}
      {showPasswordSheet && <ChangePasswordSheet onClose={() => setShowPasswordSheet(false)} />}
      {showNameSheet && (
        <ChangeNameSheet
          currentName={profile?.displayName}
          uid={user.uid}
          refreshProfile={refreshProfile}
          onClose={() => setShowNameSheet(false)}
        />
      )}
      {showDeleteSheet && <DeleteAccountSheet user={user} onClose={() => setShowDeleteSheet(false)} />}

      {showSignOutConfirm && (
        <BottomSheet onClose={() => setShowSignOutConfirm(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center' }}>
            <h3>Sign out of Signal?</h3>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary btn-full" onClick={() => setShowSignOutConfirm(false)}>Cancel</button>
              <button className="btn btn-full" onClick={handleSignOut} disabled={loggingOut} style={{ background: 'var(--color-danger)', color: '#fff', border: 'none', borderRadius: 12, padding: '14px', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                {loggingOut ? <span className="spinner" style={{ width: 18, height: 18 }} /> : 'Yes, Sign Out'}
              </button>
            </div>
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
