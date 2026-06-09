import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import BottomSheet from '../components/BottomSheet';
import EmptyState from '../components/EmptyState';
import { useToast } from '../components/Toast';
import {
  updateUserProfile, getTotalSignalsReceived,
  getTotalMatches, setUsername, checkUsernameAvailable, subscribeUserPosts,
  subscribeFriends, subscribeFriendRequests,
  acceptFriendRequest, declineFriendRequest, getUserProfile,
} from '../firebase/firestore';
import { uploadFile } from '../firebase/storage';

const GENDER_COLORS = { male: 'var(--color-male)', female: 'var(--color-female)', other: 'var(--color-other)' };

function Avatar({ photoURL, displayName, gender, size }) {
  const bg = GENDER_COLORS[gender] || 'var(--color-primary)';
  if (photoURL) {
    return <img src={photoURL} alt="" loading="lazy" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${bg}` }} />;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: size * 0.38, border: `3px solid ${bg}`, flexShrink: 0 }}>
      {(displayName || '?')[0].toUpperCase()}
    </div>
  );
}

// Username-must-be-set blocker sheet (cannot be dismissed)
function UsernameRequiredSheet({ uid, onDone }) {
  const showToast = useToast();
  const [input, setInput] = useState('');
  const [status, setStatus] = useState(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef(null);
  const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

  const handleChange = (val) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setInput(clean);
    setStatus(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!USERNAME_REGEX.test(clean)) { setStatus('invalid'); return; }
    setChecking(true);
    debounceRef.current = setTimeout(async () => {
      const available = await checkUsernameAvailable(clean);
      setStatus(available ? 'available' : 'taken');
      setChecking(false);
    }, 500);
  };

  const handleSave = async () => {
    if (status !== 'available') return;
    setSaving(true);
    try {
      await setUsername(uid, null, input);
      onDone(input);
    } catch {
      showToast('Failed to set username', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet onClose={null}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <h3>Choose your username</h3>
          <p className="caption" style={{ marginTop: 4 }}>3–20 characters, letters, numbers and underscores only</p>
        </div>
        <div className="input-group">
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)', fontSize: 15 }}>@</span>
            <input
              className="input-field"
              style={{ paddingLeft: 28, borderColor: status === 'available' ? 'var(--color-success)' : status === 'taken' || status === 'invalid' ? 'var(--color-danger)' : undefined }}
              placeholder="yourname"
              value={input}
              onChange={(e) => handleChange(e.target.value)}
              maxLength={20}
              autoFocus
            />
            <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)' }}>
              {checking && <span className="spinner" style={{ width: 16, height: 16 }} />}
              {!checking && status === 'available' && <i className="ti ti-circle-check" style={{ color: 'var(--color-success)', fontSize: 18 }} />}
              {!checking && (status === 'taken' || status === 'invalid') && <i className="ti ti-circle-x" style={{ color: 'var(--color-danger)', fontSize: 18 }} />}
            </span>
          </div>
          {status === 'taken' && <span style={{ fontSize: 12, color: 'var(--color-danger)' }}>Username is already taken</span>}
          {status === 'invalid' && input.length > 0 && <span style={{ fontSize: 12, color: 'var(--color-danger)' }}>3–20 chars, letters/numbers/underscore only</span>}
          {status === 'available' && <span style={{ fontSize: 12, color: 'var(--color-success)' }}>Available!</span>}
        </div>
        <button className="btn btn-primary btn-full" onClick={handleSave} disabled={status !== 'available' || saving}>
          {saving ? <span className="spinner" style={{ width: 18, height: 18 }} /> : 'Set Username'}
        </button>
      </div>
    </BottomSheet>
  );
}

function FriendRequestCard({ request, onAccept, onDecline }) {
  const [senderProfile, setSenderProfile] = useState(null);
  useEffect(() => {
    getUserProfile(request.fromUid).then(setSenderProfile).catch(() => {});
  }, [request.fromUid]);

  const name = senderProfile?.displayName || 'Someone';
  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', marginBottom: 8 }}>
      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16, flexShrink: 0, overflow: 'hidden' }}>
        {senderProfile?.photoURL
          ? <img src={senderProfile.photoURL} alt="" style={{ width: 44, height: 44, objectFit: 'cover' }} />
          : name[0]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{name} wants to be friends</div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={onAccept} style={{ padding: '6px 14px', background: 'var(--color-success)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Accept</button>
        <button onClick={onDecline} style={{ padding: '6px 10px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer', color: 'var(--color-text-primary)' }}>Decline</button>
      </div>
    </div>
  );
}

export default function ProfilePage({ user, profile, refreshProfile }) {
  const navigate = useNavigate();
  const showToast = useToast();
  const coverInputRef = useRef(null);
  const avatarInputRef = useRef(null);

  const [showUsernameSheet, setShowUsernameSheet] = useState(false);
  const [stats, setStats] = useState({ receivedTotal: 0, matchesTotal: 0 });
  const [posts, setPosts] = useState([]);
  const [uploading, setUploading] = useState(null);
  const [friendCount, setFriendCount] = useState(0);
  const [friendRequests, setFriendRequests] = useState([]);

  const bgColor = GENDER_COLORS[profile?.gender] || 'var(--color-primary)';

  useEffect(() => {
    if (!profile) return;
    if (!profile.username) setShowUsernameSheet(true);
  }, [profile?.username]);

  useEffect(() => {
    if (!user?.uid) return;
    Promise.all([
      getTotalSignalsReceived(user.uid),
      getTotalMatches(user.uid),
    ]).then(([received, matches]) => setStats({ receivedTotal: received, matchesTotal: matches })).catch(() => {});
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    return subscribeUserPosts(user.uid, setPosts);
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    return subscribeFriends(user.uid, (list) => setFriendCount(list.length));
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    return subscribeFriendRequests(user.uid, setFriendRequests);
  }, [user?.uid]);

  const handleAcceptFriendRequest = async (req) => {
    try {
      await acceptFriendRequest(req.id, user.uid, profile, req.fromUid);
      showToast('Friend added!', 'success');
    } catch { showToast('Failed', 'error'); }
  };

  const handleDeclineFriendRequest = async (req) => {
    try { await declineFriendRequest(req.id); }
    catch { showToast('Failed', 'error'); }
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading('cover');
    try {
      const url = await uploadFile(`covers/${user.uid}`, file);
      await updateUserProfile(user.uid, { coverURL: url });
      await refreshProfile();
    } catch { showToast('Failed to upload cover photo', 'error'); }
    finally { setUploading(null); }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading('avatar');
    try {
      const url = await uploadFile(`avatars/${user.uid}`, file);
      await updateUserProfile(user.uid, { photoURL: url });
      await refreshProfile();
    } catch { showToast('Failed to upload photo', 'error'); }
    finally { setUploading(null); }
  };

  return (
    <div className="page" style={{ paddingBottom: 80 }}>
      {/* Top bar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '12px 16px', background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)', gap: 12 }}>
        <button onClick={() => navigate('/settings')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 22, padding: 4 }}>
          <i className="ti ti-settings" />
        </button>
        <ThemeToggle />
      </div>

      {/* Cover + Avatar */}
      <div style={{ position: 'relative', marginBottom: 52 }}>
        <div style={{ height: 130, background: 'linear-gradient(135deg, #0050CC, #00A3FF)', position: 'relative', overflow: 'hidden' }}>
          {profile?.coverURL && <img src={profile.coverURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
          {uploading === 'cover' && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="spinner" style={{ width: 28, height: 28 }} />
            </div>
          )}
          <button onClick={() => coverInputRef.current?.click()} style={{ position: 'absolute', bottom: 10, right: 12, width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,0,0,0.4)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <i className="ti ti-camera" style={{ fontSize: 16 }} />
          </button>
          <input ref={coverInputRef} type="file" accept="image/*" hidden onChange={handleCoverUpload} />
        </div>
        {/* Avatar overlapping cover */}
        <div style={{ position: 'absolute', bottom: -44, left: 20 }}>
          <div style={{ position: 'relative', width: 88, height: 88 }}>
            <Avatar photoURL={profile?.photoURL} displayName={profile?.displayName} gender={profile?.gender} size={88} />
            {uploading === 'avatar' && (
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="spinner" style={{ width: 22, height: 22 }} />
              </div>
            )}
            <button onClick={() => avatarInputRef.current?.click()} style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: '50%', background: bgColor, border: '2px solid var(--color-bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <i className="ti ti-camera" style={{ fontSize: 13 }} />
            </button>
            <input ref={avatarInputRef} type="file" accept="image/*" hidden onChange={handleAvatarUpload} />
          </div>
        </div>
        {/* Edit Profile button — top-right of the info area */}
        <div style={{ position: 'absolute', bottom: -38, right: 20 }}>
          <button
            onClick={() => navigate('/edit-profile')}
            className="btn btn-secondary btn-sm"
            style={{ padding: '7px 18px', fontSize: 14 }}
          >
            <i className="ti ti-pencil" style={{ fontSize: 14 }} /> Edit Profile
          </button>
        </div>
      </div>

      {/* Name + username + bio */}
      <div style={{ padding: '0 20px 14px' }}>
        <div style={{ fontWeight: 700, fontSize: 20, color: 'var(--color-text-primary)' }}>{profile?.displayName || 'You'}</div>
        {profile?.username && (
          <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginTop: 2 }}>@{profile.username}</div>
        )}
        {profile?.bio && (
          <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginTop: 6, lineHeight: 1.5 }}>{profile.bio}</div>
        )}
        {/* Vibe tags display */}
        {(profile?.vibeTags || []).length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {profile.vibeTags.map((t) => (
              <span key={t} className="chip" style={{ fontSize: 12, padding: '3px 10px' }}>{t}</span>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ padding: '12px 20px 14px', borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)' }}>
        <div className="stats-row">
          <div className="stat-card">
            <span className="stat-value">{posts.length}</span>
            <span className="stat-label">Quicks</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats.receivedTotal}</span>
            <span className="stat-label">Signals</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats.matchesTotal}</span>
            <span className="stat-label">Matches</span>
          </div>
        </div>

        {/* Friends */}
        <button
          onClick={() => navigate('/friends')}
          style={{ marginTop: 12, width: '100%', padding: '10px 14px', background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', color: 'var(--color-text-primary)' }}
        >
          <span style={{ fontWeight: 600, fontSize: 14 }}>
            <i className="ti ti-users" style={{ marginRight: 8, color: 'var(--color-primary)' }} />
            {friendCount} Friend{friendCount !== 1 ? 's' : ''}
          </span>
          <i className="ti ti-chevron-right" style={{ color: 'var(--color-text-secondary)', fontSize: 16 }} />
        </button>
      </div>

      {/* Pending friend requests */}
      {friendRequests.length > 0 && (
        <div style={{ padding: '16px 20px 0' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Friend Requests
          </div>
          {friendRequests.map((req) => (
            <FriendRequestCard
              key={req.id}
              request={req}
              onAccept={() => handleAcceptFriendRequest(req)}
              onDecline={() => handleDeclineFriendRequest(req)}
            />
          ))}
        </div>
      )}

      {/* Quick links */}
      <div style={{ margin: '16px 20px', borderRadius: 16, border: '1px solid var(--color-border)', overflow: 'hidden' }}>
        <div onClick={() => navigate('/signal-history')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
          <i className="ti ti-history" style={{ color: 'var(--color-primary)', fontSize: 18 }} />
          <span style={{ fontWeight: 500, fontSize: 15, flex: 1 }}>Signal History</span>
          <i className="ti ti-chevron-right" style={{ color: 'var(--color-text-secondary)', fontSize: 16 }} />
        </div>
        <div onClick={() => navigate('/analytics')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer', background: 'var(--color-surface)' }}>
          <i className="ti ti-chart-bar" style={{ color: 'var(--color-primary)', fontSize: 18 }} />
          <span style={{ fontWeight: 500, fontSize: 15, flex: 1 }}>My Signal Stats</span>
          <i className="ti ti-chevron-right" style={{ color: 'var(--color-text-secondary)', fontSize: 16 }} />
        </div>
      </div>

      {/* Quicks grid */}
      <div style={{ padding: '4px 20px 0' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
          Quicks
        </div>

        {posts.length === 0 ? (
          <EmptyState
            icon="ti-bolt"
            title="No quicks yet"
            subtitle="Share your first quick on the feed"
            actionLabel="Post a Quick"
            onAction={() => navigate('/create-post')}
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
            {posts.map((post) => (
              <div key={post.id} style={{ aspectRatio: '1', overflow: 'hidden', borderRadius: 6 }}>
                {post.type === 'photo' && post.imageURL ? (
                  <img src={post.imageURL} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
                    <span style={{ color: '#fff', fontSize: 11, textAlign: 'center', lineHeight: 1.3, overflow: 'hidden' }}>{(post.content || '').slice(0, 20)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Username required blocker */}
      {showUsernameSheet && (
        <UsernameRequiredSheet
          uid={user.uid}
          onDone={async (uname) => {
            setShowUsernameSheet(false);
            await refreshProfile();
            showToast(`@${uname} is yours!`, 'success');
          }}
        />
      )}
    </div>
  );
}
