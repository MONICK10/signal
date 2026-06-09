import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import EmptyState from '../components/EmptyState';
import { subscribeFriends, removeFriend, ensureFriendChat } from '../firebase/firestore';

function Avatar({ photoURL, name, gender, size = 48 }) {
  const colors = { male: '#FF4B6E', female: '#00CC88', other: '#AA66FF' };
  const bg = colors[gender] || 'var(--color-primary)';
  if (photoURL) {
    return <img src={photoURL} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${bg}`, flexShrink: 0 }} />;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, border: `3px solid ${bg}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: size * 0.38, flexShrink: 0 }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}

function GenderBadge({ gender }) {
  const map = { male: { label: 'Male', color: '#FF4B6E' }, female: { label: 'Female', color: '#00CC88' }, other: { label: 'Other', color: '#AA66FF' } };
  const { label, color } = map[gender] || { label: gender || '', color: 'var(--color-primary)' };
  return <span className="chip" style={{ color, fontSize: 11, padding: '3px 8px' }}>{label}</span>;
}

function FriendCard({ friend, myUid, onMessage, onRemove, onViewProfile }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', position: 'relative' }}>
      <div onClick={() => onViewProfile(friend)} style={{ cursor: 'pointer' }}>
        <Avatar photoURL={friend.photoURL} name={friend.displayName} gender={friend.gender} size={52} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div onClick={() => onViewProfile(friend)} style={{ fontWeight: 600, fontSize: 15, marginBottom: 4, cursor: 'pointer' }}>{friend.displayName}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {friend.gender && <GenderBadge gender={friend.gender} />}
          {(friend.vibeTags || []).slice(0, 2).map((t) => (
            <span key={t} className="chip" style={{ fontSize: 11, padding: '3px 8px' }}>{t}</span>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          onClick={() => onMessage(friend)}
          style={{ padding: '8px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
        >
          <i className="ti ti-message" /> Message
        </button>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          style={{ width: 32, height: 32, background: 'var(--color-surface-2)', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)' }}
        >
          <i className="ti ti-dots-vertical" style={{ fontSize: 16 }} />
        </button>
      </div>

      {menuOpen && (
        <div style={{ position: 'absolute', right: 16, top: 56, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 4, zIndex: 50, minWidth: 140, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
          <button
            onClick={() => { setMenuOpen(false); onRemove(friend); }}
            style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontWeight: 600, fontSize: 14, textAlign: 'left', borderRadius: 8 }}
          >
            <i className="ti ti-user-minus" /> Remove Friend
          </button>
        </div>
      )}
    </div>
  );
}

export default function FriendsPage({ user }) {
  const navigate = useNavigate();
  const showToast = useToast();
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    return subscribeFriends(user.uid, (list) => {
      setFriends(list);
      setLoading(false);
    });
  }, [user?.uid]);

  const handleMessage = async (friend) => {
    try {
      const chatId = await ensureFriendChat(user.uid, friend.uid);
      navigate(`/messages/${chatId}`);
    } catch { showToast('Failed to open chat', 'error'); }
  };

  const handleRemove = async (friend) => {
    try {
      await removeFriend(user.uid, friend.uid);
      showToast('Friend removed');
    } catch { showToast('Failed to remove friend', 'error'); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 22, padding: 0 }}>
            <i className="ti ti-arrow-left" />
          </button>
          <h2>My Friends</h2>
        </div>
        <span style={{ fontSize: 14, color: 'var(--color-text-secondary)', fontWeight: 600 }}>
          {friends.length} friend{friends.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="page-content">
        {loading && [1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 88, borderRadius: 16 }} />)}

        {!loading && friends.length === 0 && (
          <EmptyState
            icon="ti-users"
            title="No friends yet"
            subtitle={"After a 5-minute chat,\nyou can add each other as friends"}
          />
        )}

        {!loading && friends.map((friend) => (
          <FriendCard
            key={friend.id}
            friend={friend}
            myUid={user.uid}
            onMessage={handleMessage}
            onRemove={handleRemove}
            onViewProfile={(f) => navigate(`/profile/${f.uid}`)}
          />
        ))}
      </div>
    </div>
  );
}
