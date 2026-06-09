import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// ─── Animated SVGs ───────────────────────────────────────────────

function MapBubblesIllustration() {
  return (
    <svg viewBox="0 0 280 220" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', maxWidth: 300 }}>
      {/* Map grid lines */}
      <rect x="20" y="20" width="240" height="180" rx="16" fill="var(--color-surface)" />
      {[60, 100, 140].map((y) => (
        <line key={y} x1="20" y1={y} x2="260" y2={y} stroke="var(--color-border)" strokeWidth="1" />
      ))}
      {[80, 140, 200].map((x) => (
        <line key={x} x1={x} y1="20" x2={x} y2="200" stroke="var(--color-border)" strokeWidth="1" />
      ))}
      {/* Bubble 1 - blue */}
      <g style={{ animation: 'bubbleIn1 0.4s ease forwards', opacity: 0, animationDelay: '0.2s' }}>
        <circle cx="100" cy="90" r="24" fill="#0066FF" opacity="0.15" />
        <circle cx="100" cy="90" r="20" fill="#0066FF" />
        <text x="100" y="95" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold" fontFamily="Inter,sans-serif">A</text>
      </g>
      {/* Bubble 2 - green */}
      <g style={{ animation: 'bubbleIn1 0.4s ease forwards', opacity: 0, animationDelay: '0.6s' }}>
        <circle cx="170" cy="120" r="24" fill="#00C8A0" opacity="0.15" />
        <circle cx="170" cy="120" r="20" fill="#00C8A0" />
        <text x="170" y="125" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold" fontFamily="Inter,sans-serif">S</text>
      </g>
      {/* Bubble 3 - purple */}
      <g style={{ animation: 'bubbleIn1 0.4s ease forwards', opacity: 0, animationDelay: '1.0s' }}>
        <circle cx="130" cy="155" r="24" fill="#A855F7" opacity="0.15" />
        <circle cx="130" cy="155" r="20" fill="#A855F7" />
        <text x="130" y="160" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold" fontFamily="Inter,sans-serif">K</text>
      </g>
      {/* You dot */}
      <circle cx="140" cy="110" r="8" fill="var(--color-primary)" />
      <circle cx="140" cy="110" r="14" fill="var(--color-primary)" opacity="0.2" style={{ animation: 'pulseRing 1.5s ease-in-out infinite' }} />
    </svg>
  );
}

function SignalWaveIllustration() {
  return (
    <svg viewBox="0 0 280 200" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', maxWidth: 300 }}>
      {/* Left phone */}
      <rect x="20" y="40" width="70" height="120" rx="10" fill="var(--color-surface)" stroke="var(--color-border)" strokeWidth="2" />
      <rect x="30" y="55" width="50" height="90" rx="6" fill="var(--color-surface-2)" />
      <circle cx="55" cy="150" r="4" fill="var(--color-border)" />
      {/* Right phone */}
      <rect x="190" y="40" width="70" height="120" rx="10" fill="var(--color-surface)" stroke="var(--color-border)" strokeWidth="2" />
      <rect x="200" y="55" width="50" height="90" rx="6" fill="var(--color-surface-2)" />
      {/* Notification card on right phone */}
      <g style={{ animation: 'notifAppear 0.4s ease forwards', opacity: 0, animationDelay: '1.2s' }}>
        <rect x="198" y="68" width="54" height="30" rx="6" fill="var(--color-primary)" />
        <circle cx="210" cy="83" r="6" fill="white" opacity="0.9" />
        <rect x="220" y="78" width="24" height="4" rx="2" fill="white" opacity="0.8" />
        <rect x="220" y="85" width="18" height="3" rx="1.5" fill="white" opacity="0.5" />
      </g>
      <circle cx="55" cy="150" r="4" fill="var(--color-border)" />
      <circle cx="225" cy="150" r="4" fill="var(--color-border)" />
      {/* Signal arcs */}
      {[0, 1, 2].map((i) => (
        <path
          key={i}
          d={`M ${110 + i * 14} 100 Q ${140} ${85 - i * 8} ${170 - i * 14} 100`}
          stroke="var(--color-primary)"
          strokeWidth={2 - i * 0.4}
          fill="none"
          strokeLinecap="round"
          style={{ animation: `arcPulse 1.8s ease-in-out infinite`, animationDelay: `${i * 0.2}s`, opacity: 0 }}
        />
      ))}
    </svg>
  );
}

function TimerChatIllustration() {
  const [secs, setSecs] = useState(300);

  useEffect(() => {
    const id = setInterval(() => setSecs((s) => (s <= 0 ? 300 : s - 1)), 100);
    return () => clearInterval(id);
  }, []);

  const mins = Math.floor(secs / 60);
  const s = secs % 60;
  const ratio = secs / 300;
  const timerColor = ratio > 0.5 ? 'var(--color-success)' : ratio > 0.2 ? '#FF8C42' : 'var(--color-danger)';

  return (
    <svg viewBox="0 0 280 220" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', maxWidth: 300 }}>
      {/* Chat window */}
      <rect x="30" y="20" width="220" height="180" rx="16" fill="var(--color-surface)" stroke="var(--color-border)" strokeWidth="1.5" />
      {/* Timer bar */}
      <rect x="30" y="20" width={220 * ratio} height="8" rx="4" fill={timerColor} style={{ transition: 'width 0.1s linear, fill 0.3s' }} />
      {/* Timer text */}
      <text x="140" y="50" textAnchor="middle" fill={timerColor} fontSize="22" fontWeight="800" fontFamily="Inter,sans-serif">
        {mins}:{String(s).padStart(2, '0')}
      </text>
      {/* Chat bubbles */}
      <g style={{ animation: 'bubbleIn1 0.3s ease forwards', opacity: 0, animationDelay: '0.3s' }}>
        <rect x="50" y="70" width="100" height="32" rx="12" fill="var(--color-primary)" />
        <text x="100" y="91" textAnchor="middle" fill="white" fontSize="12" fontFamily="Inter,sans-serif">Hey! I noticed you 👋</text>
      </g>
      <g style={{ animation: 'bubbleIn1 0.3s ease forwards', opacity: 0, animationDelay: '0.8s' }}>
        <rect x="130" y="115" width="100" height="32" rx="12" fill="var(--color-surface-2)" stroke="var(--color-border)" strokeWidth="1" />
        <text x="180" y="136" textAnchor="middle" fill="var(--color-text-primary)" fontSize="12" fontFamily="Inter,sans-serif">haha hey! same tbh</text>
      </g>
      {/* Add as friend button - glows when timer is low */}
      <g style={{ animation: ratio <= 0.2 ? 'glowPulse 1s ease-in-out infinite' : 'none' }}>
        <rect x="70" y="165" width="140" height="28" rx="14" fill="var(--color-success)" opacity={ratio <= 0.5 ? 1 : 0.3} />
        <text x="140" y="184" textAnchor="middle" fill="white" fontSize="12" fontWeight="600" fontFamily="Inter,sans-serif">Add as Friend</text>
      </g>
    </svg>
  );
}

// ─── Screen data ─────────────────────────────────────────────────
const SCREENS = [
  {
    illustration: <MapBubblesIllustration />,
    title: 'Notice someone nearby',
    body: 'Signal shows you people within 10 meters.\nEvery bubble is a real person near you right now.',
    buttonLabel: 'Next',
  },
  {
    illustration: <SignalWaveIllustration />,
    title: 'Send a Signal',
    body: 'Tap anyone on the map to signal them.\nSend as yourself or stay anonymous.\nThey decide if they want to talk.',
    buttonLabel: 'Next',
  },
  {
    illustration: <TimerChatIllustration />,
    title: '5 minutes to connect',
    body: 'You get 5 minutes to talk.\nNo pressure. No history.\nBecome friends or let it pass.',
    buttonLabel: 'Get Started',
  },
];

// ─── Dot indicator ───────────────────────────────────────────────
function DotIndicator({ count, current, onDotClick }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          onClick={() => onDotClick(i)}
          style={{
            width: i === current ? 20 : 8, height: 8,
            borderRadius: 9999,
            background: i === current ? 'var(--color-primary)' : 'var(--color-border)',
            border: 'none', cursor: 'pointer', padding: 0,
            transition: 'all 0.3s ease',
          }}
        />
      ))}
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const touchStartX = useRef(null);

  const finish = () => {
    localStorage.setItem('signal_onboarding_complete', 'true');
    navigate('/map', { replace: true });
    // Show visibility prompt after landing on map
    setTimeout(() => {
      localStorage.removeItem('signal_visibility_prompted'); // ensure it shows
    }, 50);
  };

  const next = () => {
    if (current < SCREENS.length - 1) {
      setCurrent((c) => c + 1);
    } else {
      finish();
    }
  };

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && current < SCREENS.length - 1) setCurrent((c) => c + 1);
      else if (diff < 0 && current > 0) setCurrent((c) => c - 1);
    }
    touchStartX.current = null;
  };

  const screen = SCREENS[current];

  return (
    <div
      style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--color-bg)', overflow: 'hidden', position: 'relative', userSelect: 'none' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <style>{`
        @keyframes bubbleIn1 {
          from { opacity: 0; transform: scale(0.6); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes pulseRing {
          0%, 100% { transform: scale(1); opacity: 0.2; }
          50%       { transform: scale(1.4); opacity: 0.05; }
        }
        @keyframes arcPulse {
          0%   { opacity: 0; }
          30%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes notifAppear {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes glowPulse {
          0%, 100% { filter: drop-shadow(0 0 0px #00C8A0); }
          50%       { filter: drop-shadow(0 0 8px #00C8A0); }
        }
      `}</style>

      {/* Skip button */}
      <button
        onClick={finish}
        style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--color-text-secondary)', fontWeight: 500, zIndex: 10, padding: '8px 12px' }}
      >
        Skip
      </button>

      {/* Slides container */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {SCREENS.map((s, i) => (
          <div
            key={i}
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              transform: `translateX(${(i - current) * 100}%)`,
              transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
              willChange: 'transform',
            }}
          >
            {/* Illustration — top 55% */}
            <div style={{ flex: '0 0 55%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 32px 16px' }}>
              {s.illustration}
            </div>

            {/* Content — bottom 45% */}
            <div style={{ flex: '0 0 45%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '0 32px 32px', gap: 16, textAlign: 'center' }}>
              <DotIndicator count={SCREENS.length} current={current} onDotClick={setCurrent} />
              <h1 style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2, color: 'var(--color-text-primary)' }}>{s.title}</h1>
              <p style={{ fontSize: 16, fontWeight: 400, color: 'var(--color-text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{s.body}</p>
              <button
                className="btn btn-primary btn-full"
                onClick={next}
                style={{ marginTop: 8 }}
              >
                {s.buttonLabel}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
