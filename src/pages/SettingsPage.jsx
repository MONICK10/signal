import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomSheet from '../components/BottomSheet';
import { useToast } from '../components/Toast';
import { useTheme } from '../hooks/useTheme';
import { updateUserProfile, submitProblemReport } from '../lib/db';
import { supabase } from '../lib/supabase';
import { logoutUser, changePassword, deleteAccount } from '../lib/auth';
import { deleteFriendList, deleteLocation } from '../lib/db';

// ─── How Cuelyn Works content ────────────────────────────────────
const HOW_IT_WORKS = [
  {
    title: 'What is Open/Closed?',
    body: 'When you are Open, people within 1km can see you on the map and send you a signal. When you are Closed (ghost mode), you are completely invisible. Nobody can find you. You control this anytime.',
  },
  {
    title: 'What is a Signal?',
    body: 'A signal is a quiet nudge to someone nearby you are curious about. You can only send one signal per hour total. Make it count.',
  },
  {
    title: 'Anonymous Signals',
    body: 'You can signal someone anonymously. If you do, the receiver sees you as Anon1, Anon2 etc. The same anonymous person always keeps their same number. You can choose to reveal yourself during the 5 minute chat window.',
  },
  {
    title: 'The 5 Minute Chat',
    body: 'When someone accepts your signal, you both get a 5 minute chat window. Within this window, either person can reveal their identity. If the other person accepts the reveal — you become friends and can chat freely with no time limit. If nobody reveals or the other person doesn\'t accept — the chat ends and disappears forever.',
  },
  {
    title: 'How to Become Friends',
    body: 'During the 5 minute chat, tap Reveal to show who you are. If the other person accepts, you are now friends. If you miss the window, you can send another signal later and try again.',
  },
  {
    title: 'Friend Nearby Alert',
    body: 'If a friend is within 20m of you and both of you are Open, you will get a notification. Friends can see each other on the map only when both are Open.',
  },
  {
    title: 'Signal History',
    body: 'Every signal you send or receive is saved in your Signal History in the Me tab. Anonymous senders appear as Anon1, Anon2 etc.',
  },
];

const GUIDELINES = [
  'Cuelyn is not a dating app. Keep it respectful.',
  'Do not send unwanted or repeated signals.',
  "Do not share anyone's location or personal information without their consent.",
  'Do not harass, threaten, or abuse anyone.',
  'Misuse will result in a warning, then a 30 day ban, then permanent removal.',
  'Extreme cases will be reported to authorities.',
];

// ─── Password strength ───────────────────────────────────────────
function checkStrength(pw) {
  return {
    length:    pw.length >= 8,
    uppercase: /[A-Z]/.test(pw),
    number:    /[0-9]/.test(pw),
    special:   /[!@#$%^&*]/.test(pw),
  };
}
const STRENGTH_COLORS = ['', '#FF5A6A', '#FF8C42', '#F5C518', '#16A34A'];
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

// ─── Reusable components ─────────────────────────────────────────
function SectionHeader({ title }) {
  return (
    <div style={{ padding: '20px 20px 8px', fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
      {title}
    </div>
  );
}

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

function Toggle({ value, onChange }) {
  return (
    <label className="toggle-switch" style={{ flexShrink: 0 }}>
      <input type="checkbox" checked={!!value} onChange={onChange} />
      <span className="toggle-switch__slider" />
    </label>
  );
}

// Notification row with optional time picker
function NotifRow({ icon, label, toggled, onToggle, timeValue, onTimeChange }) {
  return (
    <div style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px' }}>
        {icon && <i className={`ti ${icon}`} style={{ fontSize: 20, color: 'var(--color-text-secondary)', flexShrink: 0 }} />}
        <div style={{ flex: 1, fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)' }}>{label}</div>
        <Toggle value={toggled} onChange={onToggle} />
      </div>
      {toggled && onTimeChange && (
        <div style={{ padding: '0 20px 12px', marginLeft: 34, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Remind me at</span>
          <input
            type="time"
            value={timeValue || '09:00'}
            onChange={(e) => onTimeChange(e.target.value)}
            style={{
              fontSize: 14, padding: '6px 10px',
              border: '1.5px solid var(--color-border)', borderRadius: 8,
              background: 'var(--color-surface)', color: 'var(--color-text-primary)',
              outline: 'none', fontFamily: 'inherit',
            }}
          />
        </div>
      )}
    </div>
  );
}

// Accordion for HOW CUELYN WORKS
function HowItWorksAccordion() {
  const [open, setOpen] = useState(null);
  return (
    <div style={{ borderTop: '1px solid var(--color-border)' }}>
      {HOW_IT_WORKS.map((item, i) => (
        <div key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
          >
            <div style={{ flex: 1, fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)' }}>{item.title}</div>
            <i
              className={`ti ti-chevron-${open === i ? 'up' : 'down'}`}
              style={{ fontSize: 16, color: 'var(--color-text-secondary)', flexShrink: 0 }}
            />
          </button>
          {open === i && (
            <div style={{ padding: '0 20px 16px', paddingLeft: 20, fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
              {item.body}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Change Password sheet ───────────────────────────────────────
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

// ─── Delete Account sheet ────────────────────────────────────────
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
        supabase.from('profiles').delete().eq('id', user.uid),
        deleteLocation(user.uid),
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
              <h3 style={{ color: 'var(--color-danger)' }}>Delete account?</h3>
              <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginTop: 10, lineHeight: 1.6 }}>
                Your account and all data will be permanently removed within 30 days.
                This action cannot be undone.
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

// ─── Report a Problem sheet ──────────────────────────────────────
function ReportProblemSheet({ uid, onClose }) {
  const showToast = useToast();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      await submitProblemReport(uid, text);
      onClose();
      showToast('Report submitted. Thank you!', 'success');
    } catch {
      showToast('Failed to submit. Try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <h3>Report a Problem</h3>
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginTop: 4 }}>
            Tell us what&apos;s wrong. We&apos;ll look into it.
          </p>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 500))}
          placeholder="Describe what happened..."
          rows={5}
          style={{
            width: '100%', padding: '12px', borderRadius: 12,
            border: '1.5px solid var(--color-border)',
            background: 'var(--color-surface)', color: 'var(--color-text-primary)',
            fontSize: 14, resize: 'none', outline: 'none', fontFamily: 'inherit',
            boxSizing: 'border-box', lineHeight: 1.5,
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -8 }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{text.length}/500</span>
        </div>
        <button className="btn btn-primary btn-full" onClick={handleSubmit} disabled={!text.trim() || loading}>
          {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : 'Submit Report'}
        </button>
      </div>
    </BottomSheet>
  );
}

// ─── Main ────────────────────────────────────────────────────────
export default function SettingsPage({ user, profile, refreshProfile }) {
  const navigate = useNavigate();
  const showToast = useToast();
  const { theme, toggleTheme } = useTheme();

  const [showPasswordSheet, setShowPasswordSheet]   = useState(false);
  const [showDeleteSheet, setShowDeleteSheet]       = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showReportSheet, setShowReportSheet]       = useState(false);
  const [loggingOut, setLoggingOut]                 = useState(false);

  const notifPrefs = profile?.notificationPrefs || {};

  const togglePref = async (key) => {
    try {
      await updateUserProfile(user.uid, {
        notificationPrefs: { ...notifPrefs, [key]: !(notifPrefs[key] !== false) },
      });
      await refreshProfile();
    } catch { showToast('Failed to save preference', 'error'); }
  };

  const updatePrefTime = async (key, value) => {
    try {
      await updateUserProfile(user.uid, {
        notificationPrefs: { ...notifPrefs, [key]: value },
      });
      await refreshProfile();
    } catch { showToast('Failed to save', 'error'); }
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

  return (
    <div className="page" style={{ paddingBottom: 60 }}>
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
          icon="ti-user-edit"
          label="Edit Profile"
          subtitle="Photo, bio, vibe tags"
          onClick={() => navigate('/edit-profile')}
          right={<i className="ti ti-chevron-right" style={{ color: 'var(--color-text-secondary)', fontSize: 16 }} />}
        />
        <SettingsRow
          icon="ti-lock"
          label="Change Password"
          onClick={() => setShowPasswordSheet(true)}
          right={<i className="ti ti-chevron-right" style={{ color: 'var(--color-text-secondary)', fontSize: 16 }} />}
        />
        <SettingsRow
          icon="ti-trash"
          label="Delete Account"
          danger
          onClick={() => setShowDeleteSheet(true)}
          right={<i className="ti ti-chevron-right" style={{ color: 'var(--color-danger)', fontSize: 16 }} />}
        />
      </div>

      {/* ── Privacy & Safety ── */}
      <SectionHeader title="Privacy & Safety" />
      <div style={{ borderTop: '1px solid var(--color-border)' }}>
        <SettingsRow
          icon="ti-lock"
          label="Private Account"
          subtitle="Only friends can see your profile details"
          right={<Toggle value={profile?.isPrivate} onChange={() => togglePrivacy('isPrivate')} />}
        />
        <SettingsRow
          icon="ti-ban"
          label="Block List"
          subtitle="Manage who you've blocked"
          onClick={() => navigate('/settings/blocked')}
          right={<i className="ti ti-chevron-right" style={{ color: 'var(--color-text-secondary)', fontSize: 16 }} />}
        />
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 20px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
          <i className="ti ti-radar" style={{ fontSize: 20, color: 'var(--color-text-secondary)', flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)' }}>Anyone nearby can signal you</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 3, lineHeight: 1.5 }}>
              When you are Open, anyone within 1km can send you a Signal. This cannot be restricted.
            </div>
          </div>
        </div>
      </div>

      {/* ── Notifications ── */}
      <SectionHeader title="Notifications" />
      <div style={{ borderTop: '1px solid var(--color-border)' }}>
        <NotifRow
          icon="ti-radar"
          label="Someone signaled you"
          toggled={notifPrefs.signalReceived !== false}
          onToggle={() => togglePref('signalReceived')}
        />
        <NotifRow
          icon="ti-check"
          label="Signal accepted"
          toggled={notifPrefs.signalAccepted !== false}
          onToggle={() => togglePref('signalAccepted')}
        />
        <NotifRow
          icon="ti-user-heart"
          label="Friend nearby alert"
          toggled={notifPrefs.friendNearbyAlert !== false}
          onToggle={() => togglePref('friendNearbyAlert')}
        />
        <NotifRow
          icon="ti-sun"
          label="Daily Open reminder"
          toggled={notifPrefs.dailyOpenReminder !== false}
          onToggle={() => togglePref('dailyOpenReminder')}
          timeValue={notifPrefs.dailyOpenReminderTime || '09:00'}
          onTimeChange={(v) => updatePrefTime('dailyOpenReminderTime', v)}
        />
        <NotifRow
          icon="ti-moon"
          label="Daily Close reminder"
          toggled={notifPrefs.dailyCloseReminder !== false}
          onToggle={() => togglePref('dailyCloseReminder')}
          timeValue={notifPrefs.dailyCloseReminderTime || '21:00'}
          onTimeChange={(v) => updatePrefTime('dailyCloseReminderTime', v)}
        />
      </div>

      {/* ── How Cuelyn Works ── */}
      <SectionHeader title="How Cuelyn Works" />
      <HowItWorksAccordion />

      {/* ── Community Guidelines ── */}
      <SectionHeader title="Community Guidelines" />
      <div style={{ borderTop: '1px solid var(--color-border)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, borderBottom: '1px solid var(--color-border)' }}>
        {GUIDELINES.map((g, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--color-primary)', fontWeight: 700, flexShrink: 0, lineHeight: 1.6 }}>→</span>
            <span style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>{g}</span>
          </div>
        ))}
      </div>

      {/* ── Support ── */}
      <SectionHeader title="Support" />
      <div style={{ borderTop: '1px solid var(--color-border)' }}>
        <SettingsRow
          icon="ti-file-description"
          label="Terms of Service"
          subtitle="Read what you agreed to"
          onClick={() => navigate('/terms')}
          right={<i className="ti ti-chevron-right" style={{ color: 'var(--color-text-secondary)', fontSize: 16 }} />}
        />
        <SettingsRow
          icon="ti-alert-circle"
          label="Report a Problem"
          subtitle="Tell us what's not working"
          onClick={() => setShowReportSheet(true)}
          right={<i className="ti ti-chevron-right" style={{ color: 'var(--color-text-secondary)', fontSize: 16 }} />}
        />
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

      {/* ── Log Out ── */}
      <SectionHeader title="Log Out" />
      <div style={{ borderTop: '1px solid var(--color-border)' }}>
        <SettingsRow
          icon="ti-logout"
          label="Sign Out"
          danger
          onClick={() => setShowSignOutConfirm(true)}
        />
      </div>

      {/* ── Sheets ── */}
      {showPasswordSheet && <ChangePasswordSheet onClose={() => setShowPasswordSheet(false)} />}
      {showDeleteSheet   && <DeleteAccountSheet  user={user} onClose={() => setShowDeleteSheet(false)} />}
      {showReportSheet   && <ReportProblemSheet  uid={user.uid} onClose={() => setShowReportSheet(false)} />}

      {showSignOutConfirm && (
        <BottomSheet onClose={() => setShowSignOutConfirm(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center' }}>
            <h3>Sign out of Cuelyn?</h3>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary btn-full" onClick={() => setShowSignOutConfirm(false)}>Cancel</button>
              <button
                className="btn btn-full"
                onClick={handleSignOut}
                disabled={loggingOut}
                style={{ background: 'var(--color-danger)', color: '#fff', border: 'none', borderRadius: 12, padding: '14px', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
              >
                {loggingOut ? <span className="spinner" style={{ width: 18, height: 18 }} /> : 'Yes, Sign Out'}
              </button>
            </div>
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
