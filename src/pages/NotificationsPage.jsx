import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '../components/Toast';
import {
  subscribeNotifications,
  markAllNotificationsRead,
} from '../lib/db';

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
  friendRequest: 'ti-user-plus',
  signal:      'ti-bolt',
  chat:        'ti-message',
  friendChat:  'ti-message-2',
};

function NotifItem({ notif }) {
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
          background: 'var(--color-primary)',
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
    </div>
  );
}

export default function NotificationsPage({ user }) {
  const navigate = useNavigate();
  const showToast = useToast();
  const [notifications, setNotifications] = useState([]);

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
          <NotifItem key={n.id} notif={n} />
        ))}
      </div>
    </div>
  );
}
