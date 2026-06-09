import { useState, useEffect } from 'react';

export default function NetworkBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showBackOnline, setShowBackOnline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowBackOnline(true);
      const t = setTimeout(() => setShowBackOnline(false), 2500);
      return () => clearTimeout(t);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setShowBackOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showBackOnline) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      width: '100%',
      maxWidth: 430,
      zIndex: 9999,
      background: isOnline ? '#00C8A0' : '#FF5A6A',
      color: '#fff',
      textAlign: 'center',
      fontSize: 13,
      fontWeight: 600,
      height: 36,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      transition: 'background 0.3s ease',
    }}>
      <i className={`ti ${isOnline ? 'ti-wifi' : 'ti-wifi-off'}`} style={{ fontSize: 16 }} />
      {isOnline ? 'Back online' : 'No internet connection'}
    </div>
  );
}
