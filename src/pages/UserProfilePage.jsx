import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import VibeTagChip from '../components/VibeTagChip';
import UserActionMenu from '../components/UserActionMenu';
import {
  getUserProfile,
  checkIsFriend,
  getFriendChatId,
  ensureFriendChat,
} from '../firebase/firestore';
import { sendSignal } from '../utils/signalLimit';

const GENDER_COLOR = { male: '#FF4B6E', female: '#00CC88', other: '#AA66FF' };

function Avatar({ profile, size }) {
  const bg = GENDER_COLOR[profile?.gender] || 'var(--color-primary)';
  if (profile?.photoURL) {
    return (
      <img
        src={profile.photoURL}
        alt=""
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${bg}` }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: bg, border: `3px solid ${bg}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: size * 0.38,
    }}>
      {(profile?.displayName || '?')[0].toUpperCase()}
    </div>
  );
}

export default function UserProfilePage({ user, profile: myProfile }) {
  const { uid: targetUid } = useParams();
  const navigate = useNavigate();
  const showToast = useToast();

  const [targetProfile, setTargetProfile] = useState(null);
  const [isFriend, setIsFriend] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sendingSignal, setSendingSignal] = useState(false);
  const [messagingFriend, setMessagingFriend] = useState(false);

  const isOwnProfile = targetUid === user?.uid;

  useEffect(() => {
    if (!targetUid || !user?.uid) return;
    if (isOwnProfile) { navigate('/profile', { replace: true }); return; }

    Promise.all([
      getUserProfile(targetUid),
      checkIsFriend(user.uid, targetUid),
    ]).then(([p, friend]) => {
      setTargetProfile(p);
      setIsFriend(friend);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [targetUid, user?.uid, isOwnProfile, navigate]);

  const handleSignal = async () => {
    if (!targetProfile || !user || !myProfile) return;
    setSendingSignal(true);
    const signalId = await sendSignal(user.uid, targetUid, false, myProfile, showToast);
    setSendingSignal(false);
    if (signalId) showToast('Signal sent!', 'success');
  };

  const handleMessage = async () => {
    if (!isFriend) return;
    setMessagingFriend(true);
    try {
      await ensureFriendChat(user.uid, targetUid);
      const chatId = getFriendChatId(user.uid, targetUid);
      navigate(`/messages/${chatId}`);
    } catch {
      showToast('Failed to open chat', 'error');
    } finally {
      setMessagingFriend(false);
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

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 22, padding: 0 }}>
          <i className="ti ti-arrow-left" />
        </button>
        <UserActionMenu
          myUid={user?.uid}
          targetUid={targetUid}
          targetName={targetProfile.displayName}
          onBlock={() => navigate(-1)}
        />
      </div>

      <div style={{ padding: '0 16px 80px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Avatar + name */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, paddingTop: 16 }}>
          <Avatar profile={targetProfile} size={96} />
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ marginBottom: 4 }}>{targetProfile.displayName}</h2>
            {targetProfile.username && (
              <span style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>@{targetProfile.username}</span>
            )}
          </div>
          {/* Gender + vibe tags */}
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
          {/* Bio */}
          {targetProfile.bio && (
            <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6, maxWidth: 280 }}>
              {targetProfile.bio}
            </p>
          )}
        </div>

        {/* Friend badge */}
        {isFriend && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px', background: 'rgba(0,200,160,0.1)', borderRadius: 12, border: '1px solid rgba(0,200,160,0.3)' }}>
            <i className="ti ti-users" style={{ color: '#00C8A0', fontSize: 18 }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#00C8A0' }}>You're friends</span>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          {isFriend ? (
            <button
              className="btn btn-primary btn-full"
              onClick={handleMessage}
              disabled={messagingFriend}
            >
              {messagingFriend
                ? <span className="spinner" style={{ width: 18, height: 18 }} />
                : <><i className="ti ti-message" /> Message</>
              }
            </button>
          ) : (
            <button
              className="btn btn-primary btn-full"
              onClick={handleSignal}
              disabled={sendingSignal}
            >
              {sendingSignal
                ? <span className="spinner" style={{ width: 18, height: 18 }} />
                : <><i className="ti ti-send" /> Send Signal</>
              }
            </button>
          )}
        </div>

        {/* Stats */}
        {targetProfile.signalsReceivedTotal > 0 && (
          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '14px' }}>
            <i className="ti ti-radar" style={{ fontSize: 20, color: 'var(--color-primary)' }} />
            <span style={{ fontWeight: 700, fontSize: 18 }}>{targetProfile.signalsReceivedTotal}</span>
            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>signals received</span>
          </div>
        )}
      </div>
    </div>
  );
}
