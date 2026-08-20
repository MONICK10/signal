import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  subscribeUserFollowingList, getUserProfile,
  unfollowUser, subscribeMyFollowing,
} from '../lib/db';
import { useToast } from '../components/Toast';

const GENDER_COLOR = { male: '#3B82F6', female: '#A855F7', other: '#F59E0B' };

function UserRow({ uid, currentUid, iFollow, onUnfollow, navigate }) {
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
      {!isMe && iFollow && (
        <button
          onClick={(e) => { e.stopPropagation(); onUnfollow(uid); }}
          style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0, background: 'var(--color-surface)', color: 'var(--color-text-secondary)', border: '1.5px solid var(--color-border)' }}
        >
          Following
        </button>
      )}
    </div>
  );
}

export default function FollowingPage({ user }) {
  const { uid } = useParams();
  const navigate = useNavigate();
  const showToast = useToast();
  const [followingUids, setFollowingUids] = useState([]);
  const [myFollowingSet, setMyFollowingSet] = useState(new Set());

  // Only the account owner can see their following list
  useEffect(() => {
    if (uid !== user?.uid) { navigate(-1); return; }
    return subscribeUserFollowingList(uid, setFollowingUids);
  }, [uid, user?.uid, navigate]);

  useEffect(() => {
    if (!user?.uid) return;
    return subscribeMyFollowing(user.uid, setMyFollowingSet);
  }, [user?.uid]);

  const handleUnfollow = async (targetUid) => {
    setMyFollowingSet((prev) => {
      const next = new Set(prev); next.delete(targetUid); return next;
    });
    try {
      await unfollowUser(user.uid, targetUid);
    } catch {
      showToast('Failed to unfollow', 'error');
    }
  };

  return (
    <div className="page" style={{ paddingBottom: 80 }}>
      <div className="page-header">
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 22, padding: 0 }}>
          <i className="ti ti-arrow-left" />
        </button>
        <span style={{ fontWeight: 700, fontSize: 17 }}>Following</span>
        <span style={{ width: 22 }} />
      </div>

      {followingUids.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '60px 20px', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
          <i className="ti ti-user-plus" style={{ fontSize: 48 }} />
          <div style={{ fontSize: 15 }}>Not following anyone yet</div>
        </div>
      ) : (
        <div style={{ paddingTop: 8 }}>
          {followingUids.map((fUid) => (
            <UserRow
              key={fUid}
              uid={fUid}
              currentUid={user?.uid}
              iFollow={myFollowingSet.has(fUid)}
              onUnfollow={handleUnfollow}
              navigate={navigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
