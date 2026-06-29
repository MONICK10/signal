import { useState, useEffect } from 'react';
import Logo from './Logo';

const DISMISSED_KEY = 'cuelyn_install_dismissed';

export default function InstallPrompt() {
  const [prompt, setPrompt] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY) === 'true') return;

    const handler = (e) => {
      e.preventDefault();
      setPrompt(e);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!prompt) return;
    prompt.prompt();
    const result = await prompt.userChoice;
    if (result.outcome === 'accepted') {
      setVisible(false);
    }
    setPrompt(null);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, 'true');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 72,
      left: '50%',
      transform: 'translateX(-50%)',
      width: '100%',
      maxWidth: 430,
      padding: '0 12px',
      zIndex: 200,
      pointerEvents: 'none',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 14,
        padding: '10px 14px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        pointerEvents: 'all',
      }}>
        <Logo variant="icon" size={32} />
        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', lineHeight: 1.3 }}>
          Add Cuelyn to home screen
        </span>
        <button
          onClick={handleInstall}
          className="btn btn-primary btn-sm"
          style={{ padding: '6px 14px', fontSize: 13 }}
        >
          Install
        </button>
        <button
          onClick={handleDismiss}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 18, padding: '4px', lineHeight: 1, flexShrink: 0 }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
