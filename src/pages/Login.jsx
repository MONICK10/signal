import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Logo from '../components/Logo';
import ThemeToggle from '../components/ThemeToggle';
import BottomSheet from '../components/BottomSheet';
import { useToast } from '../components/Toast';
import { loginUser, resetPassword } from '../firebase/auth';

const ATTEMPTS_KEY = 'signal_login_attempts';
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

function getAttempts() {
  try {
    const raw = localStorage.getItem(ATTEMPTS_KEY);
    if (!raw) return { count: 0, reset: 0 };
    const data = JSON.parse(raw);
    if (Date.now() > data.reset) return { count: 0, reset: 0 };
    return data;
  } catch { return { count: 0, reset: 0 }; }
}

function addAttempt() {
  const data = getAttempts();
  const updated = { count: data.count + 1, reset: data.reset || Date.now() + LOCKOUT_MS };
  localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(updated));
  return updated;
}

function resetAttempts() {
  localStorage.removeItem(ATTEMPTS_KEY);
}

export default function Login() {
  const navigate = useNavigate();
  const showToast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showResetSheet, setShowResetSheet] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const attempts = getAttempts();
  const isLocked = attempts.count >= MAX_ATTEMPTS;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password || isLocked) return;
    setLoading(true);
    try {
      await loginUser(email, password, remember);
      resetAttempts();
      navigate('/map', { replace: true });
    } catch (err) {
      const updated = addAttempt();
      const remaining = MAX_ATTEMPTS - updated.count;
      const msg = updated.count >= MAX_ATTEMPTS
        ? 'Too many attempts. Try again in 15 minutes.'
        : err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password'
          ? `Invalid email or password. ${remaining} attempt${remaining !== 1 ? 's' : ''} left.`
          : 'Sign in failed. Please try again.';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const openResetSheet = () => {
    setResetEmail(email);
    setShowResetSheet(true);
  };

  const handleResetSubmit = async () => {
    if (!resetEmail.trim()) return;
    setResetLoading(true);
    try {
      await resetPassword(resetEmail.trim());
      setShowResetSheet(false);
      showToast(`Reset link sent to ${resetEmail.trim()}`, 'success');
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        showToast('No account found with this email', 'error');
      } else {
        showToast('Failed to send reset link. Try again.', 'error');
      }
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--color-bg)', padding: '0 24px' }}>
      <div style={{ position: 'absolute', top: 16, right: 16 }}>
        <ThemeToggle />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 64, paddingBottom: 32 }}>
        <Logo variant="full" size={40} />
      </div>

      {isLocked && (
        <div style={{ background: 'rgba(255,90,106,0.1)', border: '1px solid var(--color-danger)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 14, color: 'var(--color-danger)', textAlign: 'center' }}>
          Too many failed attempts. Try again in 15 minutes.
        </div>
      )}

      <form onSubmit={handleSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="input-group">
          <label className="input-label">Email</label>
          <input className="input-field" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required disabled={isLocked} />
        </div>

        <div className="input-group">
          <label className="input-label">Password</label>
          <input className="input-field" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required disabled={isLocked} />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, color: 'var(--color-text-secondary)' }}>
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--color-primary)' }} />
          Remember me
        </label>

        <button className="btn btn-primary btn-full" type="submit" disabled={loading || !email || !password || isLocked} style={{ marginTop: 4 }}>
          {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : 'Sign In'}
        </button>

        <div style={{ textAlign: 'right' }}>
          <button
            type="button"
            onClick={openResetSheet}
            style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 13, cursor: 'pointer', padding: 0 }}
          >
            Forgot password?
          </button>
        </div>
      </form>

      <p style={{ textAlign: 'center', marginTop: 24, color: 'var(--color-text-secondary)', fontSize: 15 }}>
        Don&apos;t have an account?{' '}
        <Link to="/signup" style={{ color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}>Get started</Link>
      </p>

      {showResetSheet && (
        <BottomSheet onClose={() => setShowResetSheet(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <h3>Reset your password</h3>
              <p className="caption" style={{ marginTop: 6 }}>Enter your email and we&apos;ll send you a reset link</p>
            </div>
            <div className="input-group">
              <label className="input-label">Email</label>
              <input
                className="input-field"
                type="email"
                placeholder="you@example.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                autoFocus
              />
            </div>
            <button
              className="btn btn-primary btn-full"
              onClick={handleResetSubmit}
              disabled={resetLoading || !resetEmail.trim()}
            >
              {resetLoading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : 'Send Reset Link'}
            </button>
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
