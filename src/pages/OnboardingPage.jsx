import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateUserProfile } from '../firebase/firestore';

const SCREENS = [
  {
    emoji: '👋',
    title: 'Welcome to Cuelyn',
    body: "This is not a dating app.\n\nCuelyn is for curious people who see someone interesting nearby but are too shy to say hi.\n\nBreak the ice. Make a connection. That's all.",
    button: 'Next',
  },
  {
    emoji: '👻',
    title: "You're invisible by default",
    body: "You are INVISIBLE by default. Nobody can see you until YOU choose to be Open.\n\nThe moment you feel uncomfortable, go back to ghost mode. Instantly.\n\nYour location is never shown exactly — only that you're somewhere nearby.",
    button: 'Next',
  },
  {
    emoji: '📡',
    title: 'How Signals work',
    body: "See someone nearby you're curious about? Send them a Signal — a quiet, simple nudge.\n\nIf they're curious too, you both connect. If they ignore it, that's okay too.\n\nNo awkwardness. No pressure.",
    button: 'Next',
  },
  {
    emoji: '🔒',
    title: 'Your safety first',
    body: "→ Your exact location is never revealed\n→ Block anyone instantly, they won't know\n→ Every report is taken seriously\n→ Misuse = banned. Extreme cases = authorities.\n\nYou are always in control here.",
    button: 'Next',
  },
  {
    emoji: '✨',
    title: 'One last thing',
    body: "Let people nearby know who you are.\n\nAdd your photo, a one line bio, and a few vibe tags.\n\nThe more real you are, the better connections you'll make.",
    button: 'Set up my profile',
  },
];

function DotIndicator({ count, current }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            width: i === current ? 20 : 8,
            height: 8,
            borderRadius: 9999,
            background: i === current ? 'var(--color-primary)' : 'var(--color-border)',
            transition: 'all 0.3s ease',
          }}
        />
      ))}
    </div>
  );
}

export default function OnboardingPage({ user }) {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const touchStartX = useRef(null);

  const isLast = current === SCREENS.length - 1;

  const handleNext = () => {
    if (!isLast) setCurrent((c) => c + 1);
  };

  const handleFinish = async () => {
    if (finishing) return;
    setFinishing(true);
    localStorage.setItem('cuelyn_onboarding_complete', 'true');
    try {
      if (user?.uid) await updateUserProfile(user.uid, { onboardingComplete: true });
    } catch (_) {}
    navigate('/edit-profile', { replace: true });
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

  return (
    <div
      style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--color-bg)', overflow: 'hidden', userSelect: 'none' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Dot indicator */}
      <div style={{ padding: '24px 28px 0', flexShrink: 0 }}>
        <DotIndicator count={SCREENS.length} current={current} />
      </div>

      {/* Slide container */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {SCREENS.map((s, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              padding: '0 28px 36px',
              transform: `translateX(${(i - current) * 100}%)`,
              transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
              willChange: 'transform',
            }}
          >
            {/* Centered content */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <div style={{
                width: 100,
                height: 100,
                borderRadius: '50%',
                background: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 46,
                marginBottom: 28,
                flexShrink: 0,
              }}>
                {s.emoji}
              </div>
              <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.25, marginBottom: 14 }}>
                {s.title}
              </h1>
              <p style={{ fontSize: 15, color: 'var(--color-text-secondary)', lineHeight: 1.75, whiteSpace: 'pre-line' }}>
                {s.body}
              </p>
            </div>

            {/* Action button */}
            <button
              className="btn btn-primary btn-full"
              onClick={isLast ? handleFinish : handleNext}
              disabled={isLast && finishing}
            >
              {isLast && finishing
                ? <span className="spinner" style={{ width: 20, height: 20 }} />
                : s.button}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
