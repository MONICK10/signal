import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import VibeTagChip from '../components/VibeTagChip';
import UserActionMenu from '../components/UserActionMenu';
import {
  getUserProfile, getFriendChatId, ensureFriendChat,
  followUser, unfollowUser, subscribeUserFollowersList,
  subscribeMyFollowing,
  subscribeConnectionStatus, createFriendRequest, cancelFriendRequest,
  acceptFriendRequest, declineFriendRequest,
  subscribeVibeStatus,
} from '../firebase/firestore';
import { callSendVibeRequest } from '../firebase/functions';
import { sendSignal } from '../utils/signalLimit';

const GENDER_COLOR = { male: '#3B82F6', female: '#A855F7', other: '#F59E0B' };

function Avatar({ profile, size }) {
  const bg = GENDER_COLOR[profile?.gender] || 'var(--color-primary)';
  if (profile?.photoURL) {
    return (
      <img src={profile.photoURL} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${bg}` }} />
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, border: `3px solid ${bg}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: size * 0.38 }}>
      {(profile?.displayName || '?')[0].toUpperCase()}
    </div>
  );
}

function FollowButton({ iFollow, theyFollow, loading, onClick }) {
  let label, bg, color, border;
  if (iFollow && theyFollow) {
    label = 'Mutual'; bg = 'var(--color-surface-2)'; color = 'var(--color-text-primary)'; border = '2px solid var(--color-border)';
  } else if (iFollow) {
    label = 'Following'; bg = 'var(--color-surface)'; color = 'var(--color-text-secondary)'; border = '2px solid var(--color-border)';
  } else if (theyFollow) {
    label = 'Follow Back'; bg = 'var(--color-primary)'; color = '#fff'; border = 'none';
  } else {
    label = 'Follow'; bg = 'var(--color-primary)'; color = '#fff'; border = 'none';
  }
  return (
    <button
      className="btn"
      onClick={onClick}
      disabled={loading}
      style={{ flex: 1, background: bg, color, border, borderRadius: 12, fontWeight: 700, fontSize: 15, padding: '12px 0', cursor: 'pointer', transition: 'all 0.2s' }}
    >
      {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : label}
    </button>
  );
}

export default function UserProfilePage({ user, profile: myProfile }) {
  const { uid: targetUid } = useParams();
  const navigate = useNavigate();
  const showToast = useToast();

  const [targetProfile, setTargetProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sendingSignal, setSendingSignal] = useState(false);
  const [messagingFriend, setMessagingFriend] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [connLoading, setConnLoading] = useState(false);

  const [followerCount, setFollowerCount] = useState(0);
  const [iFollow, setIFollow] = useState(false);
  const [theyFollow, setTheyFollow] = useState(false);

  // Real-time connection status: isFriend, outgoing request, incoming request
  const [conn, setConn] = useState({ isFriend: false, outgoing: null, incoming: null });

  // Vibe check state
  const [vibePhase, setVibePhase] = useState('none'); // 'none'|'pending-out'|'pending-in'|'result'
  const [vibeScore, setVibeScore] = useState(null);
  const [vibeLoading, setVibeLoading] = useState(false);

  const isOwnProfile = targetUid === user?.uid;

  useEffect(() => {
    if (!targetUid || !user?.uid) return;
    if (isOwnProfile) { navigate('/profile', { replace: true }); return; }
    getUserProfile(targetUid)
      .then(setTargetProfile)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [targetUid, user?.uid, isOwnProfile, navigate]);

  useEffect(() => {
    if (!user?.uid || !targetUid || isOwnProfile) return;
    return subscribeConnectionStatus(user.uid, targetUid, setConn);
  }, [user?.uid, targetUid, isOwnProfile]);

  useEffect(() => {
    if (!targetUid) return;
    return subscribeUserFollowersList(targetUid, (uids) => {
      setFollowerCount(uids.length);
      setTheyFollow(uids.includes(user?.uid));
    });
  }, [targetUid, user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    return subscribeMyFollowing(user.uid, (set) => setIFollow(set.has(targetUid)));
  }, [user?.uid, targetUid]);

  useEffect(() => {
    if (!user?.uid || !targetUid || isOwnProfile) return;
    return subscribeVibeStatus(user.uid, targetUid, ({ phase, score }) => {
      setVibePhase(phase);
      setVibeScore(score ?? null);
    });
  }, [user?.uid, targetUid, isOwnProfile]);

  const handleFollowToggle = async () => {
    setFollowLoading(true);
    try {
      if (iFollow) await unfollowUser(user.uid, targetUid);
      else await followUser(user.uid, targetUid);
    } catch {
      showToast('Failed to update follow', 'error');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleSignal = async () => {
    if (!targetProfile || !user || !myProfile) return;
    setSendingSignal(true);
    const enriched = { ...myProfile, toDisplayName: targetProfile.displayName || null };
    const signalId = await sendSignal(user.uid, targetUid, false, enriched, showToast);
    setSendingSignal(false);
    if (signalId) showToast('Signal sent!', 'success');
  };

  const handleMessage = async () => {
    if (!conn.isFriend) return;
    setMessagingFriend(true);
    try {
      await ensureFriendChat(user.uid, targetUid);
      navigate(`/messages/${getFriendChatId(user.uid, targetUid)}`);
    } catch {
      showToast('Failed to open chat', 'error');
    } finally {
      setMessagingFriend(false);
    }
  };

  const handleAddFriend = async () => {
    setConnLoading(true);
    try {
      await createFriendRequest(user.uid, targetUid);
      showToast('Friend request sent!', 'success');
    } catch { showToast('Failed to send request', 'error'); }
    finally { setConnLoading(false); }
  };

  const handleCancelRequest = async () => {
    setConnLoading(true);
    try {
      await cancelFriendRequest(conn.outgoing.id);
      showToast('Request cancelled', 'info');
    } catch { showToast('Failed', 'error'); }
    finally { setConnLoading(false); }
  };

  const handleAccept = async () => {
    setConnLoading(true);
    try {
      await acceptFriendRequest(conn.incoming.id, user.uid, myProfile, targetUid);
      showToast('You are now friends!', 'success');
    } catch { showToast('Failed', 'error'); }
    finally { setConnLoading(false); }
  };

  const handleDecline = async () => {
    setConnLoading(true);
    try {
      await declineFriendRequest(conn.incoming.id);
      showToast('Request declined', 'info');
    } catch { showToast('Failed', 'error'); }
    finally { setConnLoading(false); }
  };

  const handleVibeCheck = async () => {
    setVibeLoading(true);
    try {
      await callSendVibeRequest({ toUserId: targetUid });
      showToast('Vibe check sent!', 'success');
    } catch (e) {
      showToast(e.message || 'Failed to send vibe check', 'error');
    } finally {
      setVibeLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  if (!targetProfile) {
    return (
      <div className="page">
        <div className="page-header">
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 22 }}>
            <i className="ti ti-arrow-left" />
          </button>
        </div>
        <div className="empty-state">
          <i className="ti ti-user-off" style={{ fontSize: 48, color: 'var(--color-text-secondary)' }} />
          <p>User not found</p>
        </div>
      </div>
    );
  }

  const genderColor = GENDER_COLOR[targetProfile.gender] || 'var(--color-primary)';
  const { isFriend, outgoing, incoming } = conn;
  const isPrivate = targetProfile.isPrivate && !iFollow && !isFriend;

  function renderVibeButton() {
    if (vibePhase === 'result' && vibeScore != null) {
      const color = vibeScore >= 70 ? '#10b981' : vibeScore >= 40 ? 'var(--color-primary)' : 'var(--color-text-secondary)';
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '12px 16px', background: 'var(--color-surface-2)', borderRadius: 14, border: '1px solid var(--color-border)' }}>
          <span style={{ fontSize: 20 }}>🔮</span>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: 22, color, lineHeight: 1 }}>{vibeScore}%</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>vibe match</div>
          </div>
        </div>
      );
    }
    if (vibePhase === 'pending-out') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: 'var(--color-surface-2)', borderRadius: 14, border: '1px solid var(--color-border)' }}>
          <i className="ti ti-clock" style={{ fontSize: 16, color: 'var(--color-text-secondary)' }} />
          <span style={{ fontSize: 14, color: 'var(--color-text-secondary)', fontWeight: 500 }}>Vibe check pending…</span>
        </div>
      );
    }
    if (vibePhase === 'pending-in') {
      return (
        <button
          onClick={() => navigate('/notifications')}
          className="btn btn-secondary"
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <span>🔮</span> Respond to Vibe Check
        </button>
      );
    }
    return (
      <button
        onClick={handleVibeCheck}
        disabled={vibeLoading}
        className="btn btn-secondary"
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
      >
        {vibeLoading
          ? <span className="spinner" style={{ width: 18, height: 18 }} />
          : <><span>🔮</span> Vibe Check</>}
      </button>
    );
  }

  function renderFriendButton() {
    if (isFriend) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'var(--color-surface-2)', border: '1.5px solid var(--color-border)', borderRadius: 12, fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
          <i className="ti ti-users" style={{ fontSize: 16 }} /> Friends
        </div>
      );
    }
    if (incoming) {
      return (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleAccept}
            disabled={connLoading}
            className="btn btn-primary btn-sm"
            style={{ padding: '10px 18px', fontWeight: 700 }}
          >
            {connLoading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : 'Accept'}
          </button>
          <button
            onClick={handleDecline}
            disabled={connLoading}
            className="btn btn-secondary btn-sm"
            style={{ padding: '10px 18px' }}
          >
            Decline
          </button>
        </div>
      );
    }
    if (outgoing) {
      return (
        <button
          onClick={handleCancelRequest}
          disabled={connLoading}
          className="btn btn-secondary btn-sm"
          style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <i className="ti ti-clock" style={{ fontSize: 14 }} />
          {connLoading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Requested · Cancel'}
        </button>
      );
    }
    return (
      <button
        onClick={handleAddFriend}
        disabled={connLoading}
        className="btn btn-secondary btn-sm"
        style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <i className="ti ti-user-plus" style={{ fontSize: 14 }} />
        {connLoading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Add Friend'}
      </button>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 22, padding: 0 }}>
          <i className="ti ti-arrow-left" />
        </button>
        <UserActionMenu myUid={user?.uid} targetUid={targetUid} targetName={targetProfile.displayName} onBlock={() => navigate(-1)} />
      </div>

      <div style={{ padding: '0 16px 80px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Avatar + name */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, paddingTop: 16 }}>
          <Avatar profile={targetProfile} size={96} />
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ marginBottom: 4 }}>{targetProfile.displayName}</h2>
            {targetProfile.username && (
              <span style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>@{targetProfile.username}</span>
            )}
          </div>

          {/* Gender + vibe tags */}
          {!isPrivate && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {targetProfile.gender && (
                <span className="chip" style={{ color: genderColor, fontSize: 13, padding: '5px 12px' }}>
                  {targetProfile.gender.charAt(0).toUpperCase() + targetProfile.gender.slice(1)}
                </span>
              )}
              {(targetProfile.vibeTags || []).map((tag) => (
                <VibeTagChip key={tag} label={tag} />
              ))}
            </div>
          )}

          {/* Bio */}
          {!isPrivate && targetProfile.bio && (
            <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6, maxWidth: 280 }}>
              {targetProfile.bio}
            </p>
          )}
        </div>

        {/* Private profile notice */}
        {isPrivate && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '20px 16px', background: 'var(--color-surface)', borderRadius: 16, border: '1px solid var(--color-border)', textAlign: 'center' }}>
            <i className="ti ti-lock" style={{ fontSize: 36, color: 'var(--color-text-secondary)' }} />
            <div style={{ fontWeight: 600 }}>Private Profile</div>
            <div style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>Follow this person to see their profile</div>
          </div>
        )}

        {/* Incoming request banner */}
        {incoming && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--color-surface-2)', borderRadius: 12, border: '1px solid var(--color-border)' }}>
            <i className="ti ti-user-heart" style={{ fontSize: 18, color: 'var(--color-primary)' }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-primary)', flex: 1 }}>
              {targetProfile.displayName} sent you a friend request
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Friend request row */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {renderFriendButton()}
            {isFriend ? (
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleMessage} disabled={messagingFriend}>
                {messagingFriend ? <span className="spinner" style={{ width: 18, height: 18 }} /> : <><i className="ti ti-message" /> Message</>}
              </button>
            ) : (
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={handleSignal} disabled={sendingSignal}>
                {sendingSignal ? <span className="spinner" style={{ width: 18, height: 18 }} /> : <><i className="ti ti-send" /> Signal</>}
              </button>
            )}
          </div>
          {/* Follow row */}
          <FollowButton iFollow={iFollow} theyFollow={theyFollow} loading={followLoading} onClick={handleFollowToggle} />
          {/* Vibe Check row */}
          {!isPrivate && renderVibeButton()}
        </div>

        {/* Stats */}
        {!isPrivate && (
          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-evenly', padding: '16px 8px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 20, color: 'var(--color-text-primary)' }}>{targetProfile.signalsReceivedTotal || 0}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Signals</div>
            </div>
            <div style={{ width: 1, height: 32, background: 'var(--color-border)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 20, color: 'var(--color-text-primary)' }}>{followerCount}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Followers</div>
            </div>
            <div style={{ width: 1, height: 32, background: 'var(--color-border)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 20, color: 'var(--color-text-primary)' }}>{targetProfile.friendsCount || 0}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Friends</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
