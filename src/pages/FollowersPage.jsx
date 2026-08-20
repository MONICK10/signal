import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  subscribeUserFollowersList, getUserProfile,
  followUser, unfollowUser, subscribeMyFollowing,
} from '../lib/db';
import { useToast } from '../components/Toast';

const GENDER_COLOR = { male: '#3B82F6', female: '#A855F7', other: '#F59E0B' };

function UserRow({ uid, currentUid, iFollow, onFollowToggle, navigate }) {
  const [p, setP] = useState(null);

  useEffect(() => {
    getUserProfile(uid).then(setP).catch(() => {});
  }, [uid]);

  if (!p) return null;
  const bg = GENDER_COLOR[p.gender] || 'var(--color-primary)';
  const isMe = uid === currentUid;

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', cursor: 'pointer' }}
      onClick={() => navigate(isMe ? '/profile' : `/profile/${uid}`)}
    >
      <div style={{ width: 46, height: 46, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 18, flexShrink: 0, overflow: 'hidden', border: `2px solid ${bg}` }}>
        {p.photoURL
          ? <img src={p.photoURL} alt="" style={{ width: 46, height: 46, objectFit: 'cover' }} />
          : (p.displayName || '?')[0].toUpperCase()
        }
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{p.displayName}</div>
        {p.username && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>@{p.username}</div>}
      </div>
      {!isMe && (
        <button
          onClick={(e) => { e.stopPropagation(); onFollowToggle(uid, iFollow); }}
          style={{
            padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
            background: iFollow ? 'var(--color-surface)' : 'var(--color-primary)',
            color: iFollow ? 'var(--color-text-secondary)' : '#fff',
            border: iFollow ? '1.5px solid var(--color-border)' : 'none',
          }}
        >
          {iFollow ? 'Following' : 'Follow'}
        </button>
      )}
    </div>
  );
}

export default function FollowersPage({ user }) {
  const { uid } = useParams();
  const navigate = useNavigate();
  const showToast = useToast();
  const [followerUids, setFollowerUids] = useState([]);
  const [myFollowingSet, setMyFollowingSet] = useState(new Set());

  useEffect(() => {
    return subscribeUserFollowersList(uid, setFollowerUids);
  }, [uid]);

  useEffect(() => {
    if (!user?.uid) return;
    return subscribeMyFollowing(user.uid, setMyFollowingSet);
  }, [user?.uid]);

  const handleFollowToggle = async (targetUid, isFollowing) => {
    setMyFollowingSet((prev) => {
      const next = new Set(prev);
      if (isFollowing) next.delete(targetUid); else next.add(targetUid);
      return next;
    });
    try {
      if (isFollowing) await unfollowUser(user.uid, targetUid);
      else await followUser(user.uid, targetUid);
    } catch {
      showToast('Failed', 'error');
    }
  };

  return (
    <div className="page" style={{ paddingBottom: 80 }}>
      <div className="page-header">
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 22, padding: 0 }}>
          <i className="ti ti-arrow-left" />
        </button>
        <span style={{ fontWeight: 700, fontSize: 17 }}>Followers</span>
        <span style={{ width: 22 }} />
      </div>

      {followerUids.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '60px 20px', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
          <i className="ti ti-users" style={{ fontSize: 48 }} />
          <div style={{ fontSize: 15 }}>No followers yet</div>
        </div>
      ) : (
        <div style={{ paddingTop: 8 }}>
          {followerUids.map((fUid) => (
            <UserRow
              key={fUid}
              uid={fUid}
              currentUid={user?.uid}
              iFollow={myFollowingSet.has(fUid)}
              onFollowToggle={handleFollowToggle}
              navigate={navigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
