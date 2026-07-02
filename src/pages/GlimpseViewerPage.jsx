import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { subscribeMyGlimpses, markGlimpseViewed, getUserProfile } from '../firebase/firestore';

function formatTimeLeft(expiresAt) {
  if (!expiresAt) return '';
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'Expired';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h left`;
  return `${m}m left`;
}

export default function GlimpseViewerPage({ user }) {
  const { uid: targetUid } = useParams();
  const navigate = useNavigate();

  const [glimpses, setGlimpses] = useState([]);
  const [index, setIndex] = useState(0);
  const [ownerProfile, setOwnerProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const now = new Date();

  useEffect(() => {
    if (!targetUid) return;
    getUserProfile(targetUid).then(setOwnerProfile).catch(() => {});
  }, [targetUid]);

  useEffect(() => {
    if (!targetUid) return;
    return subscribeMyGlimpses(targetUid, (all) => {
      const active = all.filter((g) => g.expiresAt && new Date(g.expiresAt) > now);
      active.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
      setGlimpses(active);
      setLoading(false);
    });
  }, [targetUid]);

  // Mark current glimpse viewed
  useEffect(() => {
    if (!user?.uid || glimpses.length === 0) return;
    const current = glimpses[index];
    if (!current) return;
    if (!(current.viewedBy || []).includes(user.uid)) {
      markGlimpseViewed(current.id, user.uid).catch(() => {});
    }
  }, [index, glimpses, user?.uid]);

  const goNext = useCallback(() => {
    if (index < glimpses.length - 1) setIndex((i) => i + 1);
    else navigate(-1);
  }, [index, glimpses.length, navigate]);

  const goPrev = useCallback(() => {
    if (index > 0) setIndex((i) => i - 1);
  }, [index]);

  const handleTap = (e) => {
    const x = e.clientX;
    const w = window.innerWidth;
    if (x < w / 3) goPrev();
    else goNext();
  };

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="spinner" style={{ width: 36, height: 36, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
      </div>
    );
  }

  if (!loading && glimpses.length === 0) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#111', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', gap: 12 }}>
        <i className="ti ti-eye-off" style={{ fontSize: 48, opacity: 0.5 }} />
        <div style={{ fontWeight: 600, fontSize: 18 }}>No active Glimpses</div>
        <div style={{ fontSize: 14, opacity: 0.6 }}>This person's glimpses have expired</div>
        <button onClick={() => navigate(-1)} style={{ marginTop: 16, padding: '10px 24px', borderRadius: 12, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
          Go back
        </button>
      </div>
    );
  }

  const current = glimpses[index] || glimpses[0];

  return (
    <div
      onClick={handleTap}
      style={{ position: 'fixed', inset: 0, background: '#000', cursor: 'pointer', userSelect: 'none' }}
    >
      {/* Progress bars */}
      <div style={{ position: 'absolute', top: 12, left: 12, right: 12, zIndex: 10, display: 'flex', gap: 4 }}>
        {glimpses.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 9999, background: i <= index ? '#fff' : 'rgba(255,255,255,0.35)' }} />
        ))}
      </div>

      {/* Header */}
      <div style={{ position: 'absolute', top: 28, left: 16, right: 16, zIndex: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
        {ownerProfile?.photoURL
          ? <img src={ownerProfile.photoURL} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid #fff' }} />
          : <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>
              {(ownerProfile?.displayName || '?')[0].toUpperCase()}
            </div>
        }
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>{ownerProfile?.displayName || 'Friend'}</div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>{formatTimeLeft(current?.expiresAt)}</div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); navigate(-1); }}
          style={{ background: 'rgba(0,0,0,0.4)', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}
        >
          <i className="ti ti-x" style={{ fontSize: 16 }} />
        </button>
      </div>

      {/* Media */}
      {current?.mediaUrl && (
        <img
          src={current.mediaUrl}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
          draggable={false}
        />
      )}

      {/* Tap hint on first view */}
      {glimpses.length > 1 && (
        <div style={{ position: 'absolute', bottom: 40, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', background: 'rgba(0,0,0,0.3)', padding: '6px 14px', borderRadius: 20 }}>
            Tap sides to navigate · {index + 1} / {glimpses.length}
          </span>
        </div>
      )}
    </div>
  );
}
