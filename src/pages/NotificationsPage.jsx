import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '../components/Toast';
import {
  subscribeNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../firebase/firestore';
import { callRespondToVibeRequest } from '../firebase/functions';

function timeAgo(ts) {
  if (!ts) return '';
  try {
    const date = new Date(ts);
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return '';
  }
}

const NOTIF_ICON = {
  vibeRequest: 'ti-crystal-ball',
  vibeResult:  'ti-sparkles',
  friendRequest: 'ti-user-plus',
  signal:      'ti-bolt',
  chat:        'ti-message',
  friendChat:  'ti-message-2',
};

function ScoreDisplay({ score }) {
  const color = score >= 70 ? '#10b981' : score >= 40 ? 'var(--color-primary)' : 'var(--color-text-secondary)';
  const label = score >= 70 ? 'Strong alignment 🔥' : score >= 40 ? 'Some common ground ✨' : 'Different vibes — opposites attract 🌀';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 0 4px' }}>
      <div style={{ fontSize: 38, fontWeight: 800, color, lineHeight: 1 }}>{score}%</div>
      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>vibe match</div>
      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function NotifItem({ notif, uid, onVibeAccepted }) {
  const [loading, setLoading] = useState(false);
  const showToast = useToast();

  const handleRespond = async (accept) => {
    setLoading(true);
    try {
      const res = await callRespondToVibeRequest({ requestId: notif.refId, accept });
      await markNotificationRead(uid, notif.id);
      if (accept && res.data?.score !== undefined) {
        onVibeAccepted(res.data.score);
      } else if (!accept) {
        showToast('Vibe check declined', 'info');
      }
    } catch (e) {
      showToast(e.message || 'Failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const icon = NOTIF_ICON[notif.type] || 'ti-bell';

  return (
    <div style={{
      background: notif.read ? 'var(--color-surface)' : 'var(--color-surface-2)',
      borderRadius: 14, padding: '14px 16px',
      border: '1px solid var(--color-border)',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          background: notif.type.startsWith('vibe') ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'var(--color-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i className={`ti ${icon}`} style={{ fontSize: 18, color: '#fff' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-primary)', lineHeight: 1.3 }}>
            {notif.title}
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 3, lineHeight: 1.5 }}>
            {notif.body}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 4 }}>
            {timeAgo(notif.createdAt)}
          </div>
        </div>
        {!notif.read && (
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0, marginTop: 3 }} />
        )}
      </div>

      {/* Vibe result score inline */}
      {notif.type === 'vibeResult' && notif.score != null && (
        <ScoreDisplay score={notif.score} />
      )}

      {/* Inline accept / decline for pending vibe requests */}
      {notif.type === 'vibeRequest' && !notif.read && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-primary btn-sm"
            disabled={loading}
            onClick={() => handleRespond(true)}
            style={{ flex: 1, padding: '10px 0', fontWeight: 700, borderRadius: 10 }}
          >
            {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : 'Accept'}
          </button>
          <button
            className="btn btn-secondary btn-sm"
            disabled={loading}
            onClick={() => handleRespond(false)}
            style={{ flex: 1, padding: '10px 0', borderRadius: 10 }}
          >
            Decline
          </button>
        </div>
      )}
    </div>
  );
}

function ResultModal({ score, onClose }) {
  const color = score >= 70 ? '#10b981' : score >= 40 ? 'var(--color-primary)' : 'var(--color-text-secondary)';
  const label = score >= 70
    ? "Strong vibe alignment — you two might really click."
    : score >= 40
    ? "Some common ground. Worth exploring."
    : "Different vibes, but opposites can attract!";

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-bg)', borderRadius: 24, padding: '36px 28px',
          maxWidth: 320, width: '100%', textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ fontSize: 52 }}>🔮</div>
        <h2 style={{ marginTop: 10, marginBottom: 0, fontSize: 20, fontWeight: 800 }}>Vibe Check Result</h2>
        <div style={{ fontSize: 56, fontWeight: 800, color, margin: '16px 0 4px' }}>{score}%</div>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 4 }}>vibe match</div>
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6, marginTop: 10 }}>
          {label}
        </p>
        <button
          className="btn btn-primary"
          onClick={onClose}
          style={{ marginTop: 20, width: '100%', padding: '13px', fontWeight: 700, borderRadius: 14 }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}

export default function NotificationsPage({ user }) {
  const navigate = useNavigate();
  const showToast = useToast();
  const [notifications, setNotifications] = useState([]);
  const [resultModal, setResultModal] = useState(null); // score number

  useEffect(() => {
    if (!user?.uid) return;
    return subscribeNotifications(user.uid, setNotifications);
  }, [user?.uid]);

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead(user.uid);
    } catch {
      showToast('Failed', 'error');
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="page">
      <div className="page-header">
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 22, padding: 0 }}
        >
          <i className="ti ti-arrow-left" />
        </button>
        <h2 style={{ flex: 1, textAlign: 'center', margin: 0 }}>Notifications</h2>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontSize: 13, fontWeight: 600, padding: 0 }}
          >
            All read
          </button>
        )}
      </div>

      <div style={{ padding: '12px 16px 90px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {notifications.length === 0 && (
          <div className="empty-state">
            <i className="ti ti-bell-off" style={{ fontSize: 40, color: 'var(--color-text-secondary)' }} />
            <p>No notifications yet</p>
          </div>
        )}
        {notifications.map((n) => (
          <NotifItem
            key={n.id}
            notif={n}
            uid={user.uid}
            onVibeAccepted={(score) => setResultModal(score)}
          />
        ))}
      </div>

      {resultModal != null && (
        <ResultModal score={resultModal} onClose={() => setResultModal(null)} />
      )}
    </div>
  );
}
