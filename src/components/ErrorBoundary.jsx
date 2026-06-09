import React from 'react';
import Logo from './Logo';

export default class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('Signal Error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          height: '100vh', padding: '24px', textAlign: 'center',
          background: 'var(--color-bg)',
        }}>
          <Logo variant="icon" size={64} />
          <h2 style={{ marginTop: 24, fontSize: 20, fontWeight: 600, color: 'var(--color-text-primary)' }}>
            Something went wrong
          </h2>
          <p style={{ marginTop: 8, fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
            Signal ran into an error.<br />Tap below to reload.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 24,
              padding: '14px 32px',
              background: 'var(--color-primary)',
              color: 'white',
              border: 'none',
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload Signal
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
