import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import ThemeToggle from '../components/ThemeToggle';
import { useToast } from '../components/Toast';
import { useAuth } from '../hooks/useAuth';
import { reloadUser, resendVerificationEmail, logoutUser } from '../lib/auth';

export default function VerifyEmail() {
  const navigate = useNavigate();
  const showToast = useToast();
  const { user } = useAuth();
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);

  const handleContinue = async () => {
    setChecking(true);
    try {
      const freshUser = await reloadUser();
      if (freshUser?.emailVerified) {
        const dest = localStorage.getItem('cuelyn_onboarding_complete') === 'true' ? '/map' : '/onboarding';
        navigate(dest, { replace: true });
      } else {
        showToast('Email not verified yet. Please check your inbox.', 'error');
      }
    } catch {
      showToast('Something went wrong. Try again.', 'error');
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await resendVerificationEmail();
      showToast('Verification email resent', 'success');
    } catch {
      showToast('Failed to resend email. Try again shortly.', 'error');
    } finally {
      setResending(false);
    }
  };

  const handleSignOut = async () => {
    await logoutUser();
    navigate('/splash', { replace: true });
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', padding: '0 24px', gap: 0 }}>
      <div style={{ position: 'absolute', top: 16, right: 16 }}>
        <ThemeToggle />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32, width: '100%', maxWidth: 360 }}>
        <Logo variant="icon" size={72} />

        <div style={{ textAlign: 'center' }}>
          <h2 style={{ marginBottom: 12 }}>Check your inbox</h2>
          <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            We sent a verification link to{' '}
            <strong style={{ color: 'var(--color-text-primary)' }}>{user?.email}</strong>.
            Click the link to activate your account.
          </p>
        </div>

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button className="btn btn-primary btn-full" onClick={handleContinue} disabled={checking}>
            {checking ? <span className="spinner" style={{ width: 18, height: 18 }} /> : "I've verified — Continue"}
          </button>

          <button
            className="btn btn-secondary btn-full"
            onClick={handleResend}
            disabled={resending}
            style={{ fontSize: 14 }}
          >
            {resending ? <span className="spinner" style={{ width: 16, height: 16 }} /> : 'Resend verification email'}
          </button>
        </div>

        <button
          onClick={handleSignOut}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 14, textDecoration: 'underline' }}
        >
          Sign out and use a different account
        </button>
      </div>
    </div>
  );
}
