import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { useAuth } from '../hooks/useAuth';

const MIN_DISPLAY_MS = 2000;

export default function Splash() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [phase, setPhase] = useState(0); // 0=icon, 1=wordmark, 2=tagline, 3=bar
  const [barWidth, setBarWidth] = useState(0);
  const [exiting, setExiting] = useState(false);
  const startTime = useRef(Date.now());
  const resolvedRef = useRef(null);

  // Animation sequence
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 600);  // wordmark after icon pulse
    const t2 = setTimeout(() => setPhase(2), 1000); // tagline
    const t3 = setTimeout(() => { setPhase(3); setBarWidth(100); }, 1200); // progress bar start
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  // Capture auth resolution
  useEffect(() => {
    if (!loading && resolvedRef.current === null) {
      resolvedRef.current = Date.now();
    }
  }, [loading]);

  // Navigate once both min time and auth are resolved
  useEffect(() => {
    if (loading) return;
    const elapsed = Date.now() - startTime.current;
    const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);

    const go = () => {
      setExiting(true);
      setTimeout(() => {
        if (!user) { navigate('/login', { replace: true }); return; }
        if (!user.emailVerified) { navigate('/verify-email', { replace: true }); return; }
        const isOnboardingDone = localStorage.getItem('signal_onboarding_complete') === 'true';
        navigate(isOnboardingDone ? '/feed' : '/onboarding', { replace: true });
      }, 300);
    };

    const t = setTimeout(go, remaining);
    return () => clearTimeout(t);
  }, [loading, user, navigate]);

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg)',
      opacity: exiting ? 0 : 1,
      transition: 'opacity 0.3s ease',
      gap: 0,
    }}>
      <style>{`
        @keyframes splashScale {
          0%   { transform: scale(0.8); opacity: 0; }
          60%  { transform: scale(1.0); opacity: 1; }
          80%  { transform: scale(1.08); }
          100% { transform: scale(1.0); }
        }
        @keyframes splashFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes barGrow {
          from { width: 0%; }
          to   { width: 100%; }
        }
      `}</style>

      {/* Logo icon */}
      <div style={{ animation: 'splashScale 0.9s ease-out forwards', opacity: 0 }}>
        <Logo variant="icon" size={80} />
      </div>

      {/* Wordmark */}
      <div style={{
        marginTop: 20,
        opacity: phase >= 1 ? 1 : 0,
        transform: phase >= 1 ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
      }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--color-text-primary)' }}>Signal</h1>
      </div>

      {/* Tagline */}
      <div style={{
        marginTop: 8,
        opacity: phase >= 2 ? 1 : 0,
        transform: phase >= 2 ? 'translateY(0)' : 'translateY(6px)',
        transition: 'opacity 0.3s ease 0.1s, transform 0.3s ease 0.1s',
      }}>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', letterSpacing: '2px', textTransform: 'uppercase' }}>
          notice. signal. connect.
        </p>
      </div>

      {/* Progress bar */}
      <div style={{
        marginTop: 40,
        width: 160,
        height: 2,
        background: 'var(--color-border)',
        borderRadius: 9999,
        overflow: 'hidden',
        opacity: phase >= 3 ? 1 : 0,
        transition: 'opacity 0.2s ease',
      }}>
        <div style={{
          height: '100%',
          background: 'var(--color-primary)',
          borderRadius: 9999,
          width: barWidth + '%',
          transition: barWidth === 100 ? 'width 1.5s linear' : 'none',
        }} />
      </div>
    </div>
  );
}
