import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { getBlockedUsersWithProfiles, unblockUser } from '../firebase/firestore';

function Avatar({ name, photoURL, gender, size = 44 }) {
  const colors = { male: '#FF4B6E', female: '#00CC88', other: '#AA66FF' };
  const bg = colors[gender] || 'var(--color-primary)';
  if (photoURL) {
    return <img src={photoURL} alt="" loading="lazy" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${bg}`, flexShrink: 0 }} />;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, border: `2px solid ${bg}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: size * 0.38, flexShrink: 0 }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}

export default function BlockedUsersPage({ user }) {
  const navigate = useNavigate();
  const showToast = useToast();
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unblocking, setUnblocking] = useState(null);

  const loadBlocked = async () => {
    if (!user?.uid) return;
    try {
      const list = await getBlockedUsersWithProfiles(user.uid);
      setBlockedUsers(list);
    } catch {
      showToast('Failed to load blocked users', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadBlocked(); }, [user?.uid]);

  const handleUnblock = async (targetUid, name) => {
    setUnblocking(targetUid);
    try {
      await unblockUser(user.uid, targetUid);
      setBlockedUsers((prev) => prev.filter((u) => u.uid !== targetUid));
      showToast(`${name} unblocked`, 'success');
    } catch {
      showToast('Failed to unblock', 'error');
    } finally {
      setUnblocking(null);
    }
  };

  return (
    <div className="page" style={{ paddingBottom: 40 }}>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 22, padding: 0 }}>
            <i className="ti ti-arrow-left" />
          </button>
          <h2>Blocked Users</h2>
        </div>
      </div>

      <div className="page-content">
        {loading && [1, 2, 3].map((i) => (
          <div key={i} className="skeleton" style={{ height: 68, borderRadius: 16 }} />
        ))}

        {!loading && blockedUsers.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', gap: 12, textAlign: 'center' }}>
            <i className="ti ti-ban" style={{ fontSize: 48, color: 'var(--color-text-secondary)', opacity: 0.4 }} />
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)', marginTop: 4 }}>No blocked users</div>
            <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.5, maxWidth: 240 }}>Users you block will appear here</div>
          </div>
        )}

        {!loading && blockedUsers.map((u) => (
          <div key={u.uid} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px' }}>
            <Avatar name={u.displayName} photoURL={u.photoURL} gender={u.gender} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{u.displayName}</div>
            </div>
            <button
              onClick={() => handleUnblock(u.uid, u.displayName)}
              disabled={unblocking === u.uid}
              style={{ padding: '8px 16px', background: 'var(--color-surface-2)', border: '1.5px solid var(--color-border)', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer', color: 'var(--color-text-primary)', flexShrink: 0 }}
            >
              {unblocking === u.uid ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Unblock'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
