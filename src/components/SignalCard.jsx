import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import VibeTagChip from './VibeTagChip';

function Avatar({ photoURL, name, gender, blurred, size = 48 }) {
  const colors = { male: '#3B82F6', female: '#A855F7', other: '#F59E0B' };
  const borderColor = colors[gender] || 'var(--color-primary)';

  if (blurred) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: 'var(--color-surface-2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, flexShrink: 0, border: '3px solid var(--color-border)',
      }}>
        <i className="ti ti-ghost" style={{ color: 'var(--color-text-secondary)' }} />
      </div>
    );
  }

  if (photoURL) {
    return (
      <img src={photoURL} alt="" style={{
        width: size, height: size, borderRadius: '50%', objectFit: 'cover',
        border: `3px solid ${borderColor}`, flexShrink: 0,
      }} />
    );
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: borderColor, border: `3px solid ${borderColor}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: size * 0.38, flexShrink: 0,
    }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}

export default function SignalCard({ signal, onAccept, onDecline }) {
  const [acting, setActing] = useState(false);

  const isAnon = signal.anonymous;
  const timeAgo = signal.createdAt?.toDate
    ? formatDistanceToNow(signal.createdAt.toDate(), { addSuffix: true })
    : '';

  const handleAccept = async () => {
    setActing(true);
    await onAccept(signal.id, signal.fromUid);
  };

  const handleDecline = async () => {
    setActing(true);
    await onDecline(signal.id);
  };

  return (
    <div className="signal-card">
      <div className="signal-card__header">
        <Avatar
          photoURL={isAnon ? null : signal.fromPhotoURL}
          name={isAnon ? null : signal.fromDisplayName}
          gender={signal.fromGender}
          blurred={isAnon}
          size={52}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>
            {isAnon ? 'Someone wants to talk to you' : `${signal.fromDisplayName || 'Someone'} wants to talk to you`}
          </div>

          {signal.fromVibeTag && (
            <div style={{ marginTop: 6 }}>
              <VibeTagChip label={signal.fromVibeTag} />
            </div>
          )}

          {timeAgo && (
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>{timeAgo}</div>
          )}
        </div>
      </div>

      <div className="signal-card__actions">
        <button
          className="btn btn-sm"
          style={{ background: 'var(--color-success)', color: '#fff', flex: 1, border: 'none', borderRadius: 10, padding: '8px 16px', fontWeight: 600, fontSize: 13 }}
          onClick={handleAccept}
          disabled={acting}
        >
          <i className="ti ti-check" /> Accept
        </button>
        <button
          className="btn btn-sm btn-secondary"
          style={{ flex: 1, borderRadius: 10, padding: '8px 16px', fontWeight: 600, fontSize: 13 }}
          onClick={handleDecline}
          disabled={acting}
        >
          <i className="ti ti-x" /> Decline
        </button>
      </div>
    </div>
  );
}
