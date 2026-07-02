import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import EmptyState from '../components/EmptyState';
import {
  subscribeFriends, removeFriend, ensureFriendChat,
  subscribeMyGlimpses, subscribeActiveGlimpses,
} from '../firebase/firestore';

function Avatar({ photoURL, name, gender, size = 48 }) {
  const colors = { male: '#3B82F6', female: '#A855F7', other: '#F59E0B' };
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
  const map = { male: { label: 'Male', color: '#3B82F6' }, female: { label: 'Female', color: '#A855F7' }, other: { label: 'Other', color: '#F59E0B' } };
  const { label, color } = map[gender] || { label: gender || '', color: 'var(--color-primary)' };
  return <span className="chip" style={{ color, fontSize: 11, padding: '3px 8px' }}>{label}</span>;
}

// Story ring for a single friend
function GlimpseRing({ friend, hasUnviewed, myUid, onClick }) {
  const ringColor = hasUnviewed ? 'var(--color-primary)' : 'var(--color-border)';
  return (
    <div onClick={onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer', flexShrink: 0 }}>
      <div style={{
        width: 58, height: 58, borderRadius: '50%',
        padding: 3,
        background: hasUnviewed ? 'var(--color-primary)' : 'var(--color-border)',
      }}>
        <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'var(--color-bg)', padding: 2 }}>
          <Avatar photoURL={friend.photoURL} name={friend.displayName} gender={friend.gender} size={46} />
        </div>
      </div>
      <span style={{ fontSize: 10, color: 'var(--color-text-secondary)', maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
        {friend.displayName?.split(' ')[0] || 'Friend'}
      </span>
    </div>
  );
}

// My own glimpse ring / add button
function MyGlimpseRing({ myProfile, hasGlimpse, onAdd, onView }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flexShrink: 0 }}>
      <div
        onClick={hasGlimpse ? onView : onAdd}
        style={{
          width: 58, height: 58, borderRadius: '50%',
          padding: 3,
          background: hasGlimpse ? 'var(--color-primary)' : 'var(--color-border)',
          cursor: 'pointer', position: 'relative',
        }}
      >
        <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'var(--color-bg)', padding: 2 }}>
          <Avatar photoURL={myProfile?.photoURL} name={myProfile?.displayName} gender={myProfile?.gender} size={46} />
        </div>
        {!hasGlimpse && (
          <div style={{
            position: 'absolute', bottom: 0, right: 0,
            width: 20, height: 20, borderRadius: '50%',
            background: 'var(--color-primary)', border: '2px solid var(--color-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 14, fontWeight: 700,
          }}>
            +
          </div>
        )}
      </div>
      <span style={{ fontSize: 10, color: 'var(--color-text-secondary)', textAlign: 'center' }}>
        {hasGlimpse ? 'My Glimpse' : 'Add'}
      </span>
    </div>
  );
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

export default function FriendsPage({ user, profile: myProfile }) {
  const navigate = useNavigate();
  const showToast = useToast();
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myGlimpses, setMyGlimpses] = useState([]);
  const [friendGlimpses, setFriendGlimpses] = useState([]);

  useEffect(() => {
    if (!user?.uid) return;
    return subscribeFriends(user.uid, (list) => {
      setFriends(list);
      setLoading(false);
    });
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    return subscribeMyGlimpses(user.uid, setMyGlimpses);
  }, [user?.uid]);

  // Resubscribe whenever the friends list changes
  useEffect(() => {
    const uids = friends.map((f) => f.uid);
    return subscribeActiveGlimpses(uids, setFriendGlimpses);
  }, [friends]);

  const now = new Date();
  const activeMyGlimpses = myGlimpses.filter((g) => g.expiresAt && new Date(g.expiresAt) > now);
  const activeFriendGlimpses = friendGlimpses.filter((g) => g.expiresAt && new Date(g.expiresAt) > now);

  // Which friends have active glimpses
  const friendsWithGlimpses = friends.filter((f) =>
    activeFriendGlimpses.some((g) => g.userId === f.uid)
  );

  function hasUnviewedGlimpses(friendUid) {
    return activeFriendGlimpses.some(
      (g) => g.userId === friendUid && !(g.viewedBy || []).includes(user.uid)
    );
  }

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

      {/* Glimpse story row */}
      <div style={{ borderBottom: '1px solid var(--color-border)', padding: '12px 16px', display: 'flex', gap: 14, overflowX: 'auto' }}>
        <MyGlimpseRing
          myProfile={myProfile}
          hasGlimpse={activeMyGlimpses.length > 0}
          onAdd={() => navigate('/glimpses/create')}
          onView={() => navigate(`/glimpses/${user.uid}`)}
        />
        {friendsWithGlimpses.map((f) => (
          <GlimpseRing
            key={f.uid}
            friend={f}
            hasUnviewed={hasUnviewedGlimpses(f.uid)}
            myUid={user.uid}
            onClick={() => navigate(`/glimpses/${f.uid}`)}
          />
        ))}
        {friendsWithGlimpses.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', color: 'var(--color-text-secondary)', fontSize: 13, paddingLeft: 4 }}>
            Friends' glimpses appear here
          </div>
        )}
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
